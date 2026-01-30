# Deploying the Pakana Node Appliance

## Executive Summary
The deployment architecture of the **Pakana Node CE** is designed around the concept of an **"Idempotent Appliance"**. This means the entire infrastructure—cloud resources, networking, storage, and software—is defined as code and can be deployed, upgraded, or repaired with a single command. 

This approach minimizes "configuration drift" and ensures that every Pakana node runs with the exact performance tuning and security hardening required for sovereign financial operations.

## Infrastructure as Code (IaC)
We use **Azure Bicep** to define the cloud environment. This provides a rigorous, repeatable specification for the underlying hardware.

**Key Infrastructure Components:**
*   **Compute-Optimized VM (Standard_F2s_v2)**: Selected for high CPU clock speeds (3.4Ghz+) to maximize Go and Rust execution throughput.
*   **Premium SSD v2 Storage**: A dedicated high-I/O NVMe tier disk, mounted at `/data`, ensures that YottaDB latency is kept to sub-millisecond levels.
*   **Static Networking**: A reserved public IP address and NSG (Network Security Group) rules that lock down all ports except SSH (22), HTTP (80), and HTTPS (443).

## The "Appliance-First" Workflow

The deployment is orchestrated by the `deploy_pakana.sh` script, which acts as the "Master Controller".

### 1. Provisioning (Bicep)
Calls the [main.bicep](./main.bicep) definition to create/update resources in Azure. This step is idempotent; running it multiple times will simply confirm the valid state.

### 2. DNS Automation (Namecheap)
Instead of requiring manual DNS updates (a common source of outages), the script integrates directly with the **Namecheap API**. 
*   **Safety**: It performs a "Read-Merge-Write" operation, fetching your existing DNS records, merging the new appliance IP, and requiring operator confirmation before applying changes.
*   **Result**: Your domain (e.g., `build.lockb0x.dev`) is live and pointing to the new node within seconds of boot.

### 3. System Tuning (JIT Configuration)
The appliance configures the Linux kernel on-the-fly (`vm_tuning.sh`):
*   **Kernel Semaphores**: Tuned for YottaDB's shared memory requirements.
*   **Disk Mounting**: Configures `noatime` to reduce write wear and latency on the database volume.

### 4. Software Bootstrapping
Finally, the script pulls the latest Docker images for `api-go`, `core-rust`, and `api-report`, launching them in a coordinated mesh with `ipc: host` shared memory.

## Usage

To deploy or update your node, simply run from the repository root:

```bash
sudo bash ./deploy_pakana.sh
```

Follow the interactive prompts to authenticate with Azure and Namecheap. The process takes approximately 3-5 minutes from "Clean Slate" to "Live Appliance".

---
*For a detailed technical breakdown of the Bicep template, see [main.bicep](./main.bicep).*
