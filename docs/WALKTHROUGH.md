# Walkthrough: Deployment & Verification

## 1. Deployment (The "One-Shot" Process)
We have transitioned to a unified deployment model using `deploy_pakana.sh`.

### Steps Performed by Script:
1.  **Azure Provisioning**: Deploys `deploy/main.bicep` to create the Resource Group, VNet, Public IP, and VM.
2.  **VM Tuning**: Executes `vm_tuning.sh` via Azure RunCommand to set kernel semaphores and mount options.
3.  **Bootstrap**:
    *   Clones the repository to `/home/pakanaadmin`.
    *   Starts the `yottadb` container.
    *   Executes the M code to initialize the `yottadb.gld` (Global Directory) and `yottadb.dat` (Database File).
    *   Starts `api-go`, `core-rust`, `api-report`, and `reverse-proxy`.

## 2. Verification Checklist

### System Health
```bash
# Check container status
docker compose ps
# Expected: All services "Up" or "Healthy"
```

### Database Connectivity
```bash
# Check api-go logs for ingestion
docker compose logs -f api-go
# Expected: "Ingesting ledger 12345..."
```

### API Access
```bash
# Test the local endpoint
curl http://127.0.0.1:8080/health
# Expected: {"status": "ok"}
```

## 3. Manual Interventions (If Needed)

### Reseeding the Database
If the volume becomes corrupted or you wish to start fresh:
1.  `docker compose down -v` (Destroys the volume!)
2.  `docker compose up -d yottadb`
3.  Manually run the init commands (refer to `deploy_pakana.sh` logic).

### SSH Tunneling for SQL
To use DBeaver:
*   **SSH**: User `pakanaadmin` @ Node IP.
*   **Port Forward**: L:9080 -> 127.0.0.1:9080.
*   **DB Connection**: PostgreSQL Driver, Host: `localhost`, Port: `9080`, DB: `OCTO`.
