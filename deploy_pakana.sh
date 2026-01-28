#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pakana Node Azure Appliance Deployment ===${NC}"
echo "This script will deploy the Pakana Node CE infrastructure to your Azure subscription"
echo "and bootstrap the software stack."
echo ""

# Check for Azure CLI
if ! command -v az &> /dev/null; then
    echo "Azure CLI could not be found. Please install it first."
    exit 1
fi

# 1. Login check
echo "Checking Azure login status..."
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please login to Azure:"
    az login
fi

# 2. Gather Inputs
echo ""
echo -e "${GREEN}--- Configuration ---${NC}"
read -p "Enter Azure Subscription ID (optional, press Enter to skip if default is set): " SUBSCRIPTION_ID
if [ ! -z "$SUBSCRIPTION_ID" ]; then
    az account set --subscription "$SUBSCRIPTION_ID"
fi

while [[ -z "$RG_NAME" ]]; do
    read -p "Enter Resource Group Name (e.g., rg-pakana-node): " RG_NAME
done
read -p "Enter Region (default: westus3): " LOCATION
LOCATION=${LOCATION:-westus3}
read -p "Enter Admin Username (default: pakanaadmin): " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-pakanaadmin}


# SSH Key Handling
if [ -f ~/.ssh/id_rsa.pub ]; then
    DEFAULT_SSH_KEY=$(cat ~/.ssh/id_rsa.pub)
elif [ -f ~/.ssh/id_ed25519.pub ]; then
    DEFAULT_SSH_KEY=$(cat ~/.ssh/id_ed25519.pub)
else
    DEFAULT_SSH_KEY=""
fi

echo "Enter SSH Public Key (Press Enter to use default from ~/.ssh/*.pub if available):"
read -r SSH_KEY_INPUT

# 1. If input is empty, use default
if [ -z "$SSH_KEY_INPUT" ]; then
    SSH_KEY="$DEFAULT_SSH_KEY"
else
    # 2. Handle tilde expansion manually
    # If starts with ~/, replace with $HOME/
    if [[ "$SSH_KEY_INPUT" == ~* ]]; then
        SSH_KEY_INPUT="${SSH_KEY_INPUT/#\~/$HOME}"
    fi

    # 3. Check if it is a file
    if [ -f "$SSH_KEY_INPUT" ]; then
        echo "Reading SSH key from file: $SSH_KEY_INPUT"
        SSH_KEY=$(cat "$SSH_KEY_INPUT")
    else
        # 4. Otherwise assume it is the raw key content
        SSH_KEY="$SSH_KEY_INPUT"
    fi
fi

if [ -z "$SSH_KEY" ]; then
    echo "Error: No SSH key provided or found."
    exit 1
fi

read -p "Enter Domain Name (default: build.lockb0x.dev): " DOMAIN_NAME
read -p "Enter Admin Email (for SSL certificates): " ADMIN_EMAIL

# 3. Create Resource Group
echo ""
echo -e "${BLUE}Creating Resource Group '$RG_NAME' in '$LOCATION'...${NC}"
az group create --name "$RG_NAME" --location "$LOCATION"

# 4. Dry-Run / Validation
echo ""
echo -e "${BLUE}Validating Bicep Template...${NC}"
if ! az bicep build --file deploy/main.bicep; then
    echo "Bicep validation failed! Aborting deployment."
    exit 1
fi
echo "Validation successful."

# 5. Deploy Bicep Template
echo ""
echo -e "${BLUE}Deploying Infrastructure (This may take several minutes)...${NC}"
echo "You can monitor the deployment status in the Azure Portal or by running:"
echo "  az deployment group show --resource-group $RG_NAME --name main --query properties.provisioningState"
# Generate a semi-random unique DNS label to avoid conflicts
RANDOM_SUFFIX=$(openssl rand -hex 4)
DNS_LABEL="pakana-ce-${RANDOM_SUFFIX}"
echo "Generated DNS Label: $DNS_LABEL"

az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file deploy/main.bicep \
  --parameters \
    adminUsername="$ADMIN_USER" \
    adminPasswordOrKey="$SSH_KEY" \
    dnsLabel="$DNS_LABEL"

# 5. Output Results & Post-Deploy
echo ""
echo -e "${GREEN}=== Infrastructure Deployed ===${NC}"
IP_ADDRESS=$(az deployment group show --resource-group "$RG_NAME" --name main --query properties.outputs.publicIP.value -o tsv)
HOSTNAME=$(az deployment group show --resource-group "$RG_NAME" --name main --query properties.outputs.fqdn.value -o tsv)
SSH_CMD="ssh $ADMIN_USER@$HOSTNAME"

echo "VM Public IP: $IP_ADDRESS"
echo "VM Hostname: $HOSTNAME"
echo ""

echo -e "${BLUE}Configuring System (Disk, Docker, Tuning)...${NC}"
# Logic previously in Bicep Cloud-Init, now explicit for reliability
SYSTEM_SETUP_CMD=$(cat <<EOF
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# 1. Kernel Tuning for YottaDB
sysctl -w kernel.sem="250 32000 100 128"
if ! grep -q "kernel.sem" /etc/sysctl.conf; then echo "kernel.sem=250 32000 100 128" >> /etc/sysctl.conf; fi

# 2. Prepare Data Disk at /data (LUN 0)
# Check if mounted first to support idempotency
if ! mountpoint -q /data; then
    echo "Configuring Data Disk..."
    # Wait for device to appear if needed (Azure disk attach can be async)
    sleep 5
    
    # Identify device (usually /dev/sdc or /dev/disk/azure/scsi1/lun0)
    # Using LUN logic is safer
    DISK_PATH="/dev/disk/azure/scsi1/lun0"
    
    if [ -e "\$DISK_PATH" ]; then
        parted "\$DISK_PATH" --script mklabel gpt mkpart primary ext4 0% 100%
        sleep 5
        mkfs.ext4 -F "\$DISK_PATH-part1"
        mkdir -p /data
        echo "\$DISK_PATH-part1 /data ext4 defaults,noatime,discard 0 2" >> /etc/fstab
        mount -a
    else
        echo "WARNING: Data disk at \$DISK_PATH not found! Falling back to /dev/sdc"
        # Fallback for some VM sizes
        parted /dev/sdc --script mklabel gpt mkpart primary ext4 0% 100%
        sleep 5
        mkfs.ext4 -F /dev/sdc1
        mkdir -p /data
        echo "/dev/sdc1 /data ext4 defaults,noatime,discard 0 2" >> /etc/fstab
        mount -a
    fi
else
    echo "/data is already mounted."
fi

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release apt-transport-https
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker $ADMIN_USER
fi

# 4. YottaDB & Systemd Setup
mkdir -p /etc/docker
# Configure Docker to use the NVMe disk for all data
printf "{\n  \"features\": {\"buildkit\": true},\n  \"data-root\": \"/data/docker\"\n}\n" > /etc/docker/daemon.json
# Ensure /data exists (created by disk setup) and is ready for Docker
mkdir -p /data/docker

systemctl enable docker
systemctl restart docker

# Bind Mount - REMOVED because data-root is now /data/docker
# All volumes will naturally reside on the NVMe disk.

# Systemd Service
mkdir -p /opt/pakana
cat <<SERVICEEOF >/etc/systemd/system/pakana-compose.service
[Unit]
Description=Pakana Docker Compose Stack
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/pakana
ExecStart=/usr/bin/docker compose up -d
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable pakana-compose.service

echo "System Configuration Complete."
EOF
)

# Execute System Setup
az vm run-command invoke \
  --resource-group "$RG_NAME" \
  --name "pakana-ce-node" \
  --command-id RunShellScript \
  --scripts "$SYSTEM_SETUP_CMD"


echo -e "${BLUE}Bootstrapping Pakana Software...${NC}"
# Logic consolidated from db-init.sh
BOOTSTRAP_CMD=$(cat <<EOF
#!/bin/bash
set -e
[ -f /etc/environment ] && source /etc/environment
export HOME=/root

# Bicep sets up /opt/pakana for the systemd service
TARGET_DIR="/opt/pakana"
mkdir -p \$TARGET_DIR

if [ ! -d "\$TARGET_DIR/.git" ]; then
    echo "Cloning repository to \$TARGET_DIR..."
    git clone https://github.com/lockb0x-llc/pakana-node-ce.git \$TARGET_DIR
    
    # Configure git safety for the repo
    git config --global --add safe.directory \$TARGET_DIR
    
    # Ensure admin user owns it for SSH access convenience
    chown -R $ADMIN_USER:$ADMIN_USER \$TARGET_DIR
else
    echo "Repository already exists. Pulling latest changes..."
    cd \$TARGET_DIR
    git config --global --add safe.directory \$TARGET_DIR
    git pull
    chown -R $ADMIN_USER:$ADMIN_USER \$TARGET_DIR
fi

cd \$TARGET_DIR
echo "Starting YottaDB container..."
docker compose up -d yottadb
sleep 10

echo "Initializing Database..."
# Run init logic inside the container
docker exec pakana-yottadb bash -c '
source /opt/yottadb/current/ydb_env_set
if [ ! -f /data/r2.03_x86_64/g/yottadb.dat ]; then
    echo "Creating new global directory and database..."
    mkdir -p /data/r2.03_x86_64/g /data/r2.03_x86_64/r /data/r2.03_x86_64/o /data/r2.03_x86_64/o/utf8
    export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld
    export ydb_rel=r2.03_x86_64
    export ydb_dist=/opt/yottadb/current
    
    # Generate GDE
    \$ydb_dist/mumps -run GDE <<GDEEOF
change -region DEFAULT -key_size=256 -record_size=16384
change -segment DEFAULT -file=/data/r2.03_x86_64/g/yottadb.dat
exit
GDEEOF
    
    # Create DB
    \$ydb_dist/mupip create
    \$ydb_dist/mupip set -journal="enable,on,before" -region DEFAULT
    chmod 666 /data/r2.03_x86_64/g/yottadb.gld
    chmod 666 /data/r2.03_x86_64/g/yottadb.dat
    echo "Database initialized."
else
    echo "Database already exists."
fi
'

echo "Starting remaining services..."
docker compose up -d

echo "Bootstrap complete."
EOF
)

# Execute Bootstrap
az vm run-command invoke \
  --resource-group "$RG_NAME" \
  --name "pakana-ce-node" \
  --command-id RunShellScript \
  --scripts "$BOOTSTRAP_CMD"

echo ""
echo -e "${GREEN}=== Deployment & Setup Complete ===${NC}"
echo "You can now connect to your node:"
echo "$SSH_CMD"
echo ""
echo "To check logs: ssh $ADMIN_USER@$HOSTNAME 'cd /opt/pakana && docker compose logs -f'"
