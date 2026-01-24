#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pakana Node Azure Appliance Deployment ===${NC}"
echo "This script will deploy the Pakana Node CE infrastructure to your Azure subscription."
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

read -p "Enter Resource Group Name (e.g., rg-pakana-node): " RG_NAME
read -p "Enter Region (default: eastus): " LOCATION
LOCATION=${LOCATION:-eastus}
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
SSH_KEY=${SSH_KEY_INPUT:-$DEFAULT_SSH_KEY}

if [ -z "$SSH_KEY" ]; then
    echo "Error: No SSH key provided or found."
    exit 1
fi

read -p "Enter Domain Name (e.g., node.example.com): " DOMAIN_NAME
read -p "Enter Admin Email (for SSL certificates): " ADMIN_EMAIL

# 3. Create Resource Group
echo ""
echo -e "${BLUE}Creating Resource Group '$RG_NAME' in '$LOCATION'...${NC}"
az group create --name "$RG_NAME" --location "$LOCATION"

# 4. Deploy Bicep Template
echo ""
echo -e "${BLUE}Deploying Infrastructure (this may take a few minutes)...${NC}"
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file deploy/main.bicep \
  --parameters \
    adminUsername="$ADMIN_USER" \
    adminPasswordOrKey="$SSH_KEY" \
    domainName="$DOMAIN_NAME" \
    adminEmail="$ADMIN_EMAIL"

# 5. Output Results
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
IP_ADDRESS=$(az deployment group show --resource-group "$RG_NAME" --name main --query properties.outputs.publicIP.value -o tsv)
HOSTNAME=$(az deployment group show --resource-group "$RG_NAME" --name main --query properties.outputs.hostname.value -o tsv)
SSH_CMD=$(az deployment group show --resource-group "$RG_NAME" --name main --query properties.outputs.sshCommand.value -o tsv)

echo "VM Public IP: $IP_ADDRESS"
echo "VM Hostname: $HOSTNAME"
echo "SSH Connection: $SSH_CMD"
echo ""
echo "Next Steps:"
echo "1. Connect to your VM: $SSH_CMD"
echo "2. Clone the repo: git clone https://github.com/your-org/pakana-node-ce.git"
echo "3. Run setup: cd pakana-node-ce && ./setup.sh"
echo "4. Start: docker compose up -d"
