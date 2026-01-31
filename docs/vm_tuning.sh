#!/bin/bash

# Azure VM Tuning Script for Pakana Node
This script's functionality is now integrated int he deploy_pakana.sh script.

# Run with: sudo ./vm_tuning.sh

echo "Applying kernel tuning..."
# Update kernel semaphores for YottaDB
sysctl -w kernel.sem="250 32000 100 128"

# Persist to sysctl.conf if not already present
if ! grep -q "kernel.sem" /etc/sysctl.conf; then
    echo "kernel.sem=250 32000 100 128" >> /etc/sysctl.conf
    echo "Added kernel.sem to /etc/sysctl.conf"
else
    echo "kernel.sem already in /etc/sysctl.conf"
fi

echo "Optimizing storage mount..."
# Remount /data with noatime
if mountpoint -q /data; then
    mount -o remount,noatime /data
    echo "Remounted /data with noatime"
else
    echo "WARNING: /data is not a mountpoint. Please check your storage configuration."
fi

echo "VM tuning verification:"
sysctl kernel.sem
findmnt -n -o OPTIONS --target /data
