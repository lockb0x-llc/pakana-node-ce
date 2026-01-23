#!/bin/bash
# Install Docker and Docker Compose on Ubuntu 24.04
# Run with: sudo ./install_docker.sh

set -e

echo "Updating package index..."
apt-get update

echo "Installing prerequisites..."
apt-get install -y ca-certificates curl gnupg

echo "Adding Docker's official GPG key..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "Setting up the repository..."
echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "Updating package index (again)..."
apt-get update

echo "Installing Docker Engine, containerd, and Docker Compose..."
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Verifying Docker installation..."
docker --version
docker compose version

echo "Adding current user to docker group..."
# Assumes the script is run with sudo, so $SUDO_USER is the user who invoked it
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
    echo "Added $SUDO_USER to docker group. You may need to log out and back in for this to take effect."
else
    echo "Warning: Could not determine SUDO_USER. Please manually add your user to the docker group: sudo usermod -aG docker \$USER"
fi

echo "Docker installation complete!"
