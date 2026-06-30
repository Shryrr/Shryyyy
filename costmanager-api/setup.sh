#!/bin/bash
set -e
echo "Setting up CostManager API..."

if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

cd "$(dirname "$0")"
mkdir -p data

npm install

if [ ! -f .env ]; then
  echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
  echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> .env
  echo "PORT=3001" >> .env
  echo "DB_PATH=./data/costmanager.db" >> .env
  echo "CORS_ORIGIN=http://91.107.249.240" >> .env
  echo "PLATFORM_OWNER_USERNAME=platform_admin" >> .env
  echo "PLATFORM_OWNER_PASSWORD=$(openssl rand -base64 16)" >> .env
  echo "" >> .env
  echo ".env file created. Platform owner password:"
  grep PLATFORM_OWNER_PASSWORD .env
  echo "Save this password now — it will not be shown again."
fi

node -e "require('./db').migrate()"

echo "Setup complete!"
