#!/bin/bash
# Setup symlink for Site to Site File Transfer node development

echo "Setting up symlink for Site to Site File Transfer node..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Build the node first
echo "Building node..."
yarn build

# Ensure custom directory exists
mkdir -p ~/.n8n/custom

# Remove old copy if it exists
rm -rf ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer

# Create symlink to dist folder (so updates are automatic)
ln -sfn "$PROJECT_DIR/dist" ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer

echo "✓ Symlink created: ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer -> $PROJECT_DIR/dist"
echo ""
echo "Now when you run 'yarn build:watch' in this folder:"
echo "  1. TypeScript watch will rebuild to dist/"
echo "  2. Symlink automatically points to latest dist/"
echo "  3. n8n loads from ~/.n8n/custom/ (standard location)"
echo "  4. Changes are picked up automatically"
echo ""
echo "Note: Make sure N8N_DEV_RELOAD=true is set in your n8n environment for hot reload."
