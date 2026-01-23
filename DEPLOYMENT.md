# Deploying the Pakana Node Appliance

This guide covers the manual deployment of the Pakana Node on a standard Ubuntu 24.04 environment. This "Appliance-First" approach ensures maximum reliability and control over your sovereign ledger.

## 1. Prerequisites

### Infrastructure
- **OS**: Ubuntu 24.04 LTS (Native or VM)
- **Cores**: 2+ vCPU
- **Memory**: 4GB RAM Minimum (8GB+ Recommended)
- **Disk**: 64GB OS Disk Minimum; 100GB+ recommended for growth.

### Dependencies
Ensure Docker and Docker Compose are installed:
```bash
# Quick install if missing
sudo apt update && sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Log out and back in
```

## 2. Deployment Steps

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-repo/pakana-node.git
cd pakana-node
```

### Step 2: Configure Environment
Create a `.env` file or ensure variables are set in your environment:
```bash
# Example .env
API_KEY=your_secret_key_here
HORIZON_URL=https://horizon-testnet.stellar.org
```

### Step 3: Execute Deployment
Run the optimized deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

## 3. Maintenance & Operations

### YottaDB Integrity
The Pakana Node uses YottaDB for high-performance state storage. If the system crashes or is shut down abruptly, you may need to "rundown" the database to clear shared memory segments:
```bash
docker exec pakana-yottadb sh -c "export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld && /opt/yottadb/current/mupip rundown -region DEFAULT"
```
*Note: `deploy.sh` handles this automatically.*

### Backups
To back up your ledger state, copy the `/data` directory:
```bash
tar -czf pakana-data-backup.tar.gz /var/lib/docker/volumes/pakana-node_yottadb-data/_data
```

## 4. Verification
Once deployed, verify the health of the node:
- **Health Check**: `http://<node-ip>:8080/health`
- **Interactive API Docs**: `http://<node-ip>:8080/docs`
- **Dashboard**: `http://<node-ip>:8080`
