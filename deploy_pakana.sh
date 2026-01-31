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

# Gather Resource Group Name (with default)
read -p "Enter Resource Group Name (default: rg-pakana-node-ce-$(openssl rand -hex 3)): " RG_NAME_INPUT
RG_NAME=${RG_NAME_INPUT:-"rg-pakana-node-ce-$(openssl rand -hex 3)"}
echo "Using Resource Group: $RG_NAME"

read -p "Enter Region (default: westus2): " LOCATION
LOCATION=${LOCATION:-westus2}
read -p "Enter Admin Username (default: pakanaadmin): " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-pakanaadmin}


# SSH Key Handling
if [ -f ~/.ssh/id_pakana_deploy.pub ]; then
    DEFAULT_SSH_KEY=$(cat ~/.ssh/id_pakana_deploy.pub)
elif [ -f ~/.ssh/id_rsa.pub ]; then
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
DOMAIN_NAME=${DOMAIN_NAME:-build.lockb0x.dev}
read -p "Enter Target Branch (default: main): " DEPLOY_BRANCH
DEPLOY_BRANCH=${DEPLOY_BRANCH:-main}
read -p "Enter Admin Email (default: steven@thefirm.codes): " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-steven@thefirm.codes}

echo ""
echo -e "${BLUE}--- Deployment Mode ---${NC}"
echo "Staging mode uses Let's Encrypt Staging (untrusted, high rate limits). Use for dev/testing."
read -p "Enable Staging Mode? (y/N): " STAGING_INPUT
if [[ "$STAGING_INPUT" =~ ^[Yy]$ ]]; then
    PAKANA_STAGING="true"
    PAKANA_ACME_CA="https://acme-staging-v02.api.letsencrypt.org/directory"
    echo "Staging Mode: ENABLED (Using Let's Encrypt Staging)"
else
    PAKANA_STAGING="false"
    PAKANA_ACME_CA="https://acme-v02.api.letsencrypt.org/directory"
    echo "Staging Mode: DISABLED (Production)"
fi

echo ""
echo -e "${GREEN}--- Namecheap DNS Automation (Optional) ---${NC}"
echo "If provided, the script will automatically update the A record for the domain."
read -p "Enter Namecheap API Key (leave empty to skip): " NC_API_KEY
if [ ! -z "$NC_API_KEY" ]; then
    read -p "Enter Namecheap Username: " NC_USERNAME
    read -p "Enter Whitelisted Client IP (default: 66.10.231.68): " NC_CLIENT_IP
    NC_CLIENT_IP=${NC_CLIENT_IP:-"66.10.231.68"}
fi

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

# --- Namecheap DNS Update Logic ---
if [ ! -z "$NC_API_KEY" ]; then
    echo ""
    echo -e "${BLUE}=== Automated DNS Update (Namecheap) ===${NC}"
    
    # Split domain name
    # e.g. build.lockb0x.dev -> build, lockb0x, dev
    # e.g. lockb0x.dev -> @, lockb0x, dev
    IFS='.' read -ra ADDR <<< "$DOMAIN_NAME"
    if [ ${#ADDR[@]} -eq 2 ]; then
        NC_HOST="@"
        NC_SLD=${ADDR[0]}
        NC_TLD=${ADDR[1]}
    elif [ ${#ADDR[@]} -eq 3 ]; then
        NC_HOST=${ADDR[0]}
        NC_SLD=${ADDR[1]}
        NC_TLD=${ADDR[2]}
    else
        echo "WARNING: Complex domain structure detected ($DOMAIN_NAME). Manual DNS update required."
        NC_API_KEY=""
    fi

    if [ ! -z "$NC_API_KEY" ]; then
        echo "Fetching current host records for $DOMAIN_NAME..."
        
        # Use curl to fetch existing hosts
        GET_HOSTS_URL="https://api.namecheap.com/xml.response?ApiUser=$NC_USERNAME&ApiKey=$NC_API_KEY&UserName=$NC_USERNAME&Command=namecheap.domains.dns.getHosts&ClientIp=$NC_CLIENT_IP&SLD=$NC_SLD&TLD=$NC_TLD"
        RESPONSE_XML=$(curl -s "$GET_HOSTS_URL")
        
        if echo "$RESPONSE_XML" | grep -q "Status=\"ERROR\""; then
            ERROR_MSG=$(echo "$RESPONSE_XML" | sed -n 's/.*<Error.*>\(.*\)<\/Error>.*/\1/p')
            echo -e "${RED}Namecheap API Error: $ERROR_MSG${NC}"
        else
            # Python helper to parse XML, merge, and show snapshots
            PYTHON_LOGIC=$(cat <<'PYEOF'
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlencode

xml_data = sys.stdin.read()
target_host = sys.argv[1]
new_ip = sys.argv[2]

try:
    root = ET.fromstring(xml_data)
    namespace = {'ns': 'http://api.namecheap.com/xml.response'}
    
    # Find the CommandResponse section
    command_response = root.find('.//ns:CommandResponse', namespace)
    if command_response is None:
        print("ERROR: Could not parse Namecheap response.")
        sys.exit(1)
        
    domain_dns_get_hosts = command_response.find('.//ns:DomainDNSGetHostsResult', namespace)
    hosts = domain_dns_get_hosts.findall('ns:host', namespace) if domain_dns_get_hosts is not None else []
    
    print("\n--- DNS Snapshot: BEFORE ---")
    current_records = []
    found_target = False
    
    for h in hosts:
        host = h.get('Name') or h.get('Host') or "@"
        rtype = h.get('Type')
        address = h.get('Address')
        mxpref = h.get('MXPref', '10')
        ttl = h.get('TTL', '1799')
        
        print(f"[{rtype}] {host} -> {address}")
        
        record = {
            'HostName': host,
            'RecordType': rtype,
            'Address': address,
            'MXPref': mxpref,
            'TTL': ttl
        }
        
        if host == target_host and rtype == 'A':
            found_target = True
            record['Address'] = new_ip
        
        current_records.append(record)
        
    if not found_target:
        current_records.append({
            'HostName': target_host,
            'RecordType': 'A',
            'Address': new_ip,
            'MXPref': '10',
            'TTL': '1799'
        })
        
    print("\n--- DNS Snapshot: PROJECTED AFTER ---")
    for r in current_records:
        marker = " [UPDATED]" if r['HostName'] == target_host else ""
        print(f"[{r['RecordType']}] {r['HostName']} -> {r['Address']}{marker}")
        
    # Generate query string params for setHosts
    params = {}
    for i, r in enumerate(current_records, 1):
        params[f'HostName{i}'] = r['HostName']
        params[f'RecordType{i}'] = r['RecordType']
        params[f'Address{i}'] = r['Address']
        params[f'MXPref{i}'] = r['MXPref']
        params[f'TTL{i}'] = r['TTL']
        
    print("\n--- PARAMS_START ---")
    print(urlencode(params))
    
except Exception as e:
    print(f"ERROR: Python parsing failed: {e}")
    sys.exit(1)
PYEOF
)
            # Run the python helper and capture output
            PY_OUTPUT=$(echo "$RESPONSE_XML" | python3 -c "$PYTHON_LOGIC" "$NC_HOST" "$IP_ADDRESS")
            
            if [[ $PY_OUTPUT == ERROR* ]]; then
                echo -e "${RED}$PY_OUTPUT${NC}"
            else
                echo "$PY_OUTPUT" | sed '/--- PARAMS_START ---/q' | sed '$d'
                
                SET_PARAMS=$(echo "$PY_OUTPUT" | sed -n '/--- PARAMS_START ---/,$p' | sed '1d')
                
                echo ""
                read -p "Apply these changes to Namecheap DNS? (y/N): " CONFIRM_DNS
                if [[ "$CONFIRM_DNS" =~ ^[Yy]$ ]]; then
                    echo "Updating DNS records..."
                    SET_HOSTS_URL="https://api.namecheap.com/xml.response?ApiUser=$NC_USERNAME&ApiKey=$NC_API_KEY&UserName=$NC_USERNAME&Command=namecheap.domains.dns.setHosts&ClientIp=$NC_CLIENT_IP&SLD=$NC_SLD&TLD=$NC_TLD&$SET_PARAMS"
                    
                    SET_RESPONSE=$(curl -s "$SET_HOSTS_URL")
                    if echo "$SET_RESPONSE" | grep -q "Status=\"OK\""; then
                        echo -e "${GREEN}DNS update successful! $DOMAIN_NAME now points to $IP_ADDRESS${NC}"
                    else
                        SET_ERROR=$(echo "$SET_RESPONSE" | sed -n 's/.*<Error.*>\(.*\)<\/Error>.*/\1/p')
                        echo -e "${RED}Failed to update DNS: $SET_ERROR${NC}"
                    fi
                else
                    echo "DNS update skipped."
                fi
            fi
        fi
    fi
fi

SSH_CMD="ssh $ADMIN_USER@$HOSTNAME"

echo ""
echo "VM Public IP: $IP_ADDRESS"
echo "VM Hostname: $HOSTNAME"
echo ""

echo -e "${BLUE}Configuring System (Disk, Docker, Tuning)...${NC}"
# Logic previously in Bicep Cloud-Init, now explicit for reliability
SYSTEM_SETUP_CMD=$(cat <<EOF
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# 0. Wait for apt lock (Azure auto-updates)
wait_for_apt() {
    echo "Waiting for apt lock..."
    while fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 ; do
        sleep 2
    done
}

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
    wait_for_apt
    apt-get update
    wait_for_apt
    apt-get install -y ca-certificates curl gnupg lsb-release apt-transport-https
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    wait_for_apt
    apt-get update
    wait_for_apt
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
WorkingDirectory=/opt/pakana/deploy
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
    
    # Switch to the requested branch for testing
    cd \$TARGET_DIR
    git checkout $DEPLOY_BRANCH
    
    # Ensure admin user owns it for SSH access convenience
    chown -R \$ADMIN_USER:\$ADMIN_USER \$TARGET_DIR
else
    echo "Repository already exists. Pulling latest changes..."
    cd \$TARGET_DIR
    git config --global --add safe.directory \$TARGET_DIR
    git fetch
    git checkout $DEPLOY_BRANCH
    git pull origin $DEPLOY_BRANCH
    chown -R \$ADMIN_USER:\$ADMIN_USER \$TARGET_DIR
fi

echo "Configuring environment..."
echo "DOMAIN_NAME=$DOMAIN_NAME" > \$TARGET_DIR/.env
echo "ADMIN_EMAIL=$ADMIN_EMAIL" >> \$TARGET_DIR/.env
echo "PAKANA_STAGING=$PAKANA_STAGING" >> \$TARGET_DIR/.env
echo "PAKANA_ACME_CA=$PAKANA_ACME_CA" >> \$TARGET_DIR/.env

# DNS Propagation Check
echo "Checking DNS propagation for $DOMAIN_NAME (Target: $IP_ADDRESS)..."
MAX_RETRIES=30
RETRY_COUNT=0
DNS_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Try to resolve IP. Use getent or dig if available.
    RESOLVED_IP=\$(getent hosts $DOMAIN_NAME | awk '{print \$1}')
    if [ "$IP_ADDRESS" == "\$RESOLVED_IP" ]; then
        echo "DNS propagated successfully."
        DNS_READY=true
        break
    fi
    echo "Waiting for DNS... (Attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 10
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$DNS_READY" = false ]; then
    echo "WARNING: DNS did not propagate in time. Caddy might fail initial TLS validation."
    echo "Proceeding anyway, Caddy will retry automatically."
fi

cd \$TARGET_DIR

echo "Initializing YottaDB & SQL Schema..."
# Use ephemeral container to initialize the DB files and SQL DDL
docker run --rm -v pakana_yottadb-data:/data \
  -v \$TARGET_DIR/deploy/init.sql:/init.sql \
  -e ydb_dist=/opt/yottadb/current \
  -e ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld \
  -e ydb_rel=r2.03_x86_64 \
  yottadb/yottadb-base:latest-master bash -c '
    export ydb_dist=/opt/yottadb/current
    
    if [ ! -f /data/r2.03_x86_64/g/yottadb.dat ]; then
        echo "Creating new global directory and database..."
        mkdir -p /data/r2.03_x86_64/g /data/r2.03_x86_64/r /data/r2.03_x86_64/o /data/r2.03_x86_64/o/utf8
        
        export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld
        
        # Generate GDE configuraiton
        echo "change -region DEFAULT -key_size=256 -record_size=64000" > /tmp/gde.txt
        echo "change -segment DEFAULT -file=/data/r2.03_x86_64/g/yottadb.dat" >> /tmp/gde.txt
        echo "exit" >> /tmp/gde.txt
        
        \$ydb_dist/mumps -run GDE < /tmp/gde.txt
        
        # Create DB
        \$ydb_dist/mupip create
        \$ydb_dist/mupip set -journal="enable,on,before" -region DEFAULT
        
        # Ensure permissions for container user
        chmod -R 777 /data/r2.03_x86_64
        echo "Database initialized."
    fi

    # Initialize SQL Schema via Octo
    # Now that .gld exists, we can source env_set safely
    source \$ydb_dist/ydb_env_set
    if [ -f /usr/local/bin/octo ] || [ -f \$ydb_dist/plugin/octo/octo ]; then
        OCTO_BIN=\$(which octo || echo "\$ydb_dist/plugin/octo/octo")
        echo "Loading DDL from /init.sql..."
        \$OCTO_BIN -f /init.sql
    else
        echo "WARNING: Octo not found, skipping SQL initialization."
    fi
'

echo "Starting all services..."
# Ensure permissions are correct before starting
docker run --rm -v pakana_yottadb-data:/data alpine sh -c "chmod -R 777 /data"

cd \$TARGET_DIR/deploy
docker compose up -d --build

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
echo "To check logs: ssh $ADMIN_USER@$HOSTNAME 'cd /opt/pakana/deploy && docker compose logs -f'"
