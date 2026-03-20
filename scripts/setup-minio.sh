#!/bin/bash
set -e

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  echo "MinIO is unavailable - sleeping"
  sleep 2
done

echo "MinIO is ready!"

# Install mc (MinIO client) if not available
if ! command -v mc &> /dev/null; then
  echo "Installing MinIO client (mc)..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install minio/stable/mc
  else
    wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
    chmod +x /tmp/mc
    sudo mv /tmp/mc /usr/local/bin/
  fi
fi

# Configure MinIO client
echo "Configuring MinIO client..."
mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true

# Create bucket if it doesn't exist
BUCKET_NAME="workived-files"
if mc ls local/$BUCKET_NAME 2>/dev/null; then
  echo "Bucket '$BUCKET_NAME' already exists"
else
  echo "Creating bucket '$BUCKET_NAME'..."
  mc mb local/$BUCKET_NAME
  echo "Bucket '$BUCKET_NAME' created successfully!"
fi

# Set public download policy (optional - for development only)
# mc anonymous set download local/$BUCKET_NAME

echo "MinIO setup complete!"
