# Azure Appliance Deployment Guide

This guide explains how to deploy a sovereign **Pakana Node CE** appliance to your Azure subscription using our automated Bicep workflow.

## Overview

The deployment process uses **Azure Bicep** and `cloud-init` to provision a hardened, production-ready virtual appliance.

**What gets deployed?**
- **VM**: Standard_F2s_v2 (2 vCPU, 4GB RAM)
- **OS**: Ubuntu 24.04 LTS
- **Storage**: Premium SSD
- **Network**: Public IP with DNS label
- **Security**: NSG allowing only SSH (22), HTTP (80), and HTTPS (443)

## Prerequisites

1. **Azure CLI**: Install the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).
2. **Azure Account**: Active subscription with permissions to create Resource Groups.
3. **SSH Key**: An SSH public key (e.g., `~/.ssh/id_rsa.pub`).

## Deployment Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/pakana-node-ce.git
   cd pakana-node-ce
   ```

2. **Run the Deployment Script**
   ```bash
   ./deploy_pakana.sh
   ```

3. **Follow the Prompts**
   The script will ask for:
   - **Subscription ID**: (Optional)
   - **Resource Group**: Name for the new group (e.g., `pakana-node-rg`)
   - **Region**: Azure region (default: `eastus`)
   - **Admin Username**: SSH user (default: `pakanaadmin`)
   - **SSH Key**: Path to your public key.
   - **Domain Name**: Your node's domain (e.g., `node.example.com`).
   - **Admin Email**: For automatic Let's Encrypt SSL.

4. **Connect to Your Node**
   Once deployment finishes, the script outputs the connection string.
   ```bash
   ssh pakanaadmin@<your-node-ip>
   ```

5. **Start the Appliance**
   Inside the VM:
   ```bash
   # Clone the repo inside the VM
   git clone https://github.com/your-org/pakana-node-ce.git
   cd pakana-node-ce

   # Run setup
   ./setup.sh

   # Start services
   docker compose up -d
   ```

## Configuration Details

The deployment process automatically injects your configuration into `/etc/environment`. The Pakana containers read these global variables:

- `DOMAIN_NAME`: Used by Caddy for reverse proxy configuration.
- `ADMIN_EMAIL`: Used by Caddy for SSL certificate registration.

## Troubleshooting

- **Deployment Fails**: Check your Azure quota for `Standard_F2s_v2` in the selected region.
- **SSL Issues**: Ensure your DNS A Method points to the VM's Public IP *before* starting Docker Compose. Caddy needs to verify domain ownership.
