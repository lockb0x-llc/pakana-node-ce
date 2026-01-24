# **Repository Integration: Azure Appliance Deployment**

This walkthrough outlines the exact steps to incorporate the Azure Bicep deployment process into the pakana-node-ce repository.

## **1\. Directory Structure Setup**

Ensure your repository follows this layout to support the automated scripts:

pakana-node-ce/  
├── deploy/  
│   └── main.bicep           \# Infrastructure definition  
├── docs/  
│   └── README\_AZURE.md      \# User guide  
├── deploy\_pakana.sh         \# Main entry point for operators  
├── setup.sh                 \# Post-provisioning setup (existing)  
└── docker-compose.yml       \# Appliance orchestration

## **2\. Integration Steps**

### **Step A: Initialize the Deployment Folder**

Create the directory to house the Bicep logic.

mkdir \-p deploy

### **Step B: Finalize Environment Variable Injection**

The Bicep customData script writes DOMAIN\_NAME and ADMIN\_EMAIL to /etc/environment. Update your Caddyfile to use these variables:

{$DOMAIN\_NAME} {  
    reverse\_proxy api-report:8080  
    tls {$ADMIN\_EMAIL}  
}

### **Step C: Git Staging & Push**

Once the files are created, commit them to your main branch:

git add deploy/main.bicep deploy\_pakana.sh docs/README\_AZURE.md  
git commit \-m "feat: add automated Azure F2s\_v2 appliance deployment"  
git push origin main

## **3\. Operator Workflow (For Users)**

A user following your repo would simply do the following:

1. **Fork/Clone** the repo.  
2. **Login** to Azure: az login.  
3. **Execute**: ./deploy\_pakana.sh.  
4. **Point DNS**: Map their domain to the resulting IP.  
5. **Start Node**: SSH and run docker compose up \-d.