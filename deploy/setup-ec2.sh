#!/usr/bin/env bash
# ==============================================================================
# AI-Interview-System: Automated 1-Click AWS EC2 Setup Script (Ubuntu 22.04 / 24.04)
# ==============================================================================

set -e

echo "=========================================================="
echo " Starting AI-Interview-System AWS EC2 Deployment Setup..."
echo "=========================================================="

APP_DIR="/home/ubuntu/AI-Interview-System"

# 1. Update OS and install system prerequisites
echo "[1/7] Updating system packages & installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y python3-pip python3-venv ffmpeg libsndfile1 nginx git curl certbot python3-certbot-nginx

# 2. Configure 2GB Swap Memory (ensures Whisper model runs smoothly on Free Tier instances)
if [ ! -f /swapfile ]; then
    echo "[2/7] Creating 2GB swap space for PyTorch & Whisper..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap space enabled successfully."
else
    echo "[2/7] Swapfile already exists. Skipping."
fi

# 3. Install Node.js 20.x LTS (for React frontend build)
if ! command -v node &> /dev/null; then
    echo "[3/7] Installing Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[3/7] Node.js is already installed ($(node -v)). Skipping."
fi

# 4. Setup Python Virtual Environment & Backend
echo "[4/7] Setting up Python backend virtual environment..."
cd "$APP_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

venv/bin/pip install --upgrade pip setuptools wheel
venv/bin/pip install -r requirements.txt

# Ensure .env exists in backend
if [ ! -f "$APP_DIR/backend/.env" ]; then
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$APP_DIR/backend/.env"
    else
        echo "Creating default backend/.env from template..."
        cp "$APP_DIR/.env.example" "$APP_DIR/backend/.env"
        echo "⚠️ IMPORTANT: Please edit $APP_DIR/backend/.env and add your GEMINI_API_KEY!"
    fi
fi

# Ensure database directory exists
mkdir -p "$APP_DIR/database"

# 5. Build React Frontend
echo "[5/7] Building React frontend for production..."
cd "$APP_DIR/frontend"
if [ ! -f ".env" ]; then
    echo "REACT_APP_API_URL=" > .env
    echo "CI=false" >> .env
fi
npm install --legacy-peer-deps
npm run build

# 6. Configure Systemd Service for Gunicorn Backend
echo "[6/7] Configuring systemd service for backend..."
sudo cp "$APP_DIR/deploy/ai-interview.service" /etc/systemd/system/ai-interview.service
sudo systemctl daemon-reload
sudo systemctl enable ai-interview
sudo systemctl restart ai-interview

# 7. Configure Nginx Reverse Proxy
echo "[7/7] Configuring Nginx reverse proxy..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/ai-interview
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/ai-interview /etc/nginx/sites-enabled/ai-interview
sudo nginx -t
sudo systemctl restart nginx

echo "=========================================================="
echo " ✅ AI-Interview-System deployment setup complete!"
echo "=========================================================="
echo ""
echo "Next steps:"
echo "1. Verify backend status: sudo systemctl status ai-interview"
echo "2. Visit your EC2 Public IP in browser to test HTTP: http://YOUR_EC2_PUBLIC_IP"
echo "3. To enable HTTPS (REQUIRED for webcam & microphone permissions):"
echo "   - Point your domain or use a free nip.io domain (e.g. YOUR_EC2_IP.nip.io)"
echo "   - Run: sudo certbot --nginx -d YOUR_DOMAIN"
echo "=========================================================="

