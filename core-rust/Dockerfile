FROM yottadb/yottadb-base:latest-master

RUN apt-get update --fix-missing && apt-get install -y --no-install-recommends curl build-essential pkg-config libssl-dev libclang-dev clang ca-certificates && rm -rf /var/lib/apt/lists/*

# Install Rust via rustup to get latest stable version (needed for edition 2024 and lockfile v4)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set YottaDB environment (paths provided by docker-compose)
ENV ydb_dist=/opt/yottadb/current



# Create app directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml ./

# Create a dummy main to cache dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY . .
RUN rm -f Cargo.lock

# Force rebuild by touching source files
RUN touch src/main.rs src/validator.rs

# Build the application
RUN cargo build --release

# Initialize YottaDB data directory
RUN mkdir -p /data/routines

CMD ["./target/release/pakana-core-rust"]
