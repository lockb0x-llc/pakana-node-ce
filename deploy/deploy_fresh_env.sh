#!/bin/bash
set -e

# Configuration
RG_UNIQUE="5840"
RG_NAME="rg-pakana-node-ce-test-${RG_UNIQUE}"
LOCATION="westus2"
BRANCH="ui-enrichment"
DOMAIN="build.lockb0x.dev"
EMAIL="steven@thefirm.codes"
SSH_KEY_PATH="${HOME}/.ssh/id_pakana_deploy.pub"

echo "🚀 Starting fresh environment deployment for Pakana Node CE..."
echo "📍 Resource Group: ${RG_NAME}"
echo "🌏 Region: ${LOCATION}"
echo "🌿 Branch: ${BRANCH}"

# 1. Create Resource Group
echo "➕ Creating resource group..."
az group create --name "${RG_NAME}" --location "${LOCATION}"

# 2. Deploy Bicep Template
echo "🏗️ Deploying infrastructure via Bicep..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "${RG_NAME}" \
  --template-file deploy/main.bicep \
  --parameters \
    adminPasswordOrKey="$(cat ${SSH_KEY_PATH})" \
    branchName="${BRANCH}" \
    domainName="${DOMAIN}" \
    adminEmail="${EMAIL}" \
  --query "properties.outputs" -o json)

# 3. Extract Outputs
PUBLIC_IP=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.publicIP.value')
FQDN=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.fqdn.value')

echo "✅ Deployment Complete!"
echo "🌐 Public IP: ${PUBLIC_IP}"
echo "🔗 Azure FQDN: ${FQDN}"
echo ""
echo "📢 ACTION REQUIRED: Update your DNS A-Record for '${DOMAIN}' to point to ${PUBLIC_IP}"
echo "⏳ After DNS propagates, the node will be accessible at https://${DOMAIN}"
echo "🔍 Monitor progress: ssh pakanaadmin@${PUBLIC_IP} 'tail -f /var/log/cloud-init-output.log'"
