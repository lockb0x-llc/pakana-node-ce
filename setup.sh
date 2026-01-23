#!/bin/bash

# Pakana Private Ledger Setup Script
# For Ubuntu 20.04+ / WSL2
# Installs Go, Rust, and YottaDB for local development

set -e  # Exit on error

echo "=================================="
echo "Pakana Private Ledger Setup"
echo "Installing: Go, Rust, YottaDB"
echo "=================================="

# Check if running on Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    echo "Error: This script requires apt-get (Ubuntu/Debian)"
    exit 1
fi

# Update system packages
echo ""
echo "[1/4] Updating system packages..."
sudo apt-get update
sudo apt-get install -y wget curl git build-essential

# Install Go
echo ""
echo "[2/4] Installing Go 1.21.6..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}')
    echo "Go is already installed: $GO_VERSION"
else
    cd /tmp
    wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
    rm go1.21.6.linux-amd64.tar.gz
    
    # Add Go to PATH
    if ! grep -q "/usr/local/go/bin" ~/.bashrc; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
        echo 'export GOPATH=$HOME/go' >> ~/.bashrc
        echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc
    fi
    
    export PATH=$PATH:/usr/local/go/bin
    export GOPATH=$HOME/go
    
    echo "Go installed: $(go version)"
fi

# Install Rust
echo ""
echo "[3/4] Installing Rust..."
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo "Rust is already installed: $RUST_VERSION"
else
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo "Rust installed: $(rustc --version)"
fi

# Install YottaDB
echo ""
echo "[4/4] Installing YottaDB..."
if command -v ydb &> /dev/null; then
    echo "YottaDB is already installed"
else
    cd /tmp
    
    # Install YottaDB dependencies
    sudo apt-get install -y pkg-config libelf-dev libicu-dev libncurses-dev
    
    # Download and install YottaDB
    wget https://gitlab.com/YottaDB/DB/YDB/-/archive/master/YDB-master.tar.gz
    tar -xzf YDB-master.tar.gz
    cd YDB-master
    
    # Build and install YottaDB
    sudo mkdir -p /opt/yottadb
    sudo ./ydbinstall --utf8 default --force-install
    
    # Set up YottaDB environment
    # Detect installed YottaDB version
    YDB_VERSION=$(ls -1 /usr/local/lib/yottadb/ | head -1)
    if ! grep -q "ydb_dist" ~/.bashrc; then
        echo '' >> ~/.bashrc
        echo '# YottaDB Environment' >> ~/.bashrc
        echo "export ydb_dist=/usr/local/lib/yottadb/$YDB_VERSION" >> ~/.bashrc
        echo 'export ydb_gbldir=$HOME/.yottadb/yottadb.gld' >> ~/.bashrc
        echo 'export ydb_routines="$HOME/.yottadb/r $ydb_dist/libyottadbutil.so"' >> ~/.bashrc
        echo 'export ydb_ci=$HOME/.yottadb/callin.ci' >> ~/.bashrc
        echo 'export PATH=$PATH:$ydb_dist' >> ~/.bashrc
    fi
    
    # Create YottaDB data directory
    mkdir -p "$HOME/.yottadb/r"
    
    # Initialize global directory
    export ydb_dist=/usr/local/lib/yottadb/$YDB_VERSION
    export ydb_gbldir=$HOME/.yottadb/yottadb.gld
    export ydb_routines="$HOME/.yottadb/r $ydb_dist/libyottadbutil.so"
    
    cd "$HOME/.yottadb"
    $ydb_dist/ydb -run GDE << EOF
change -segment DEFAULT -file_name=$HOME/.yottadb/yottadb.dat
exit
EOF
    $ydb_dist/mupip create
    
    cd /tmp
    rm -rf YDB-master YDB-master.tar.gz
    
    echo "YottaDB installed successfully"
fi

echo ""
echo "=================================="
echo "Installation Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Restart your shell or run: source ~/.bashrc"
echo "2. Navigate to api-go: cd api-go"
echo "3. Install Go dependencies: go mod download"
echo "4. Run Go service: go run main.go"
echo ""
echo "In another terminal:"
echo "1. Navigate to core-rust: cd core-rust"
echo "2. Build Rust service: cargo build"
echo "3. Run Rust service: cargo run"
echo ""
echo "Or use Docker:"
echo "  docker-compose up --build"
echo ""
echo "=================================="
