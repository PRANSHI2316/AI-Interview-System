# AI-Interview-System: Complete AWS Deployment Guide

This guide walks you through deploying your **AI-Interview-System** to **Amazon Web Services (AWS)** step-by-step.

---

## 1. Why AWS EC2 is the Best Choice for This Project

| Service | Suitability | Reason |
| :--- | :--- | :--- |
| **AWS EC2 (Recommended)** | ✅ **Best Fit** | • Supports Python PyTorch, ffmpeg, and OpenAI Whisper without container size limits.<br>• EBS volume keeps your SQLite database permanently persistent.<br>• Free Let's Encrypt SSL HTTPS via Certbot (essential for browser camera/mic permissions).<br>• Eligible for AWS Free Tier (`t2.micro` or `t3.micro` with swap). |
| **AWS Elastic Beanstalk** | ⚠️ Not Recommended | Requires an Application Load Balancer (ALB) to enable HTTPS, which costs \$16-\$22/month even on Free Tier. Multi-container & Whisper dependency setup is complex and fragile. |
| **AWS Lambda (Serverless)** | ❌ Unsuitable | PyTorch + Whisper model exceeds the 250MB Lambda package limit; 15-minute execution limit; cannot keep SQLite database persistent. |

> [!IMPORTANT]
> **Webcam & Microphone Browser Security:** Modern web browsers (Google Chrome, Microsoft Edge, Safari, Firefox) **strictly block webcam and microphone access on non-localhost HTTP connections**. For your mock interview video and speech transcription to work on a public link, your deployment **must have HTTPS (SSL) enabled**. This guide includes free 1-click SSL setup via Let's Encrypt.

---

## 2. Prerequisites

1. An **AWS Account** ([aws.amazon.com](https://aws.amazon.com/)).
2. Your **Google Gemini API Key** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
3. Your GitHub repository: [https://github.com/PRANSHI2316/AI-Interview-System](https://github.com/PRANSHI2316/AI-Interview-System).

---

## 3. Step-by-Step AWS Deployment Walkthrough

### Step 1: Launch an AWS EC2 Instance

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **EC2** and click on the **EC2** service.
3. In the EC2 Dashboard, click the orange **Launch Instance** button.
4. Configure the instance settings:
   - **Name:** `AI-Interview-System`
   - **Application and OS Images:** Select **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS, 64-bit x86).
   - **Instance Type:**
     - **Free Tier:** `t2.micro` or `t3.micro` (our setup script automatically provisions 2GB swap space so Whisper runs smoothly).
     - **Optimal Performance:** `t3.small` (2 vCPU, 2GB RAM) or `t3.medium` (~$0.02 - $0.04/hr).
   - **Key pair (login):**
     - Select **Proceed without a key pair** (easiest, as we can connect directly using the browser-based **EC2 Instance Connect**), OR select/create a `.pem` key pair if you prefer local SSH.
   - **Network settings (Firewall / Security Group):**
     - Select **Create security group**.
     - Check ✅ **Allow SSH traffic from** -> `Anywhere (0.0.0.0/0)` or `My IP`.
     - Check ✅ **Allow HTTPS traffic from the internet** (Port 443).
     - Check ✅ **Allow HTTP traffic from the internet** (Port 80).
   - **Configure Storage:**
     - Change storage from 8 GiB to **20 GiB gp3** (Free Tier accounts include up to 30 GiB of free EBS storage).
5. Click **Launch instance** in the bottom right panel.

---

### Step 2: Connect to Your EC2 Instance via Browser

1. Go to the **Instances** page in the EC2 Console.
2. Click on your newly launched instance (`AI-Interview-System`).
3. Click the **Connect** button at the top of the page.
4. Choose the **EC2 Instance Connect** tab and click **Connect**.
5. A browser terminal will open directly inside your AWS console.

---

### Step 3: Clone Your GitHub Repository & Configure Environment

In the EC2 browser terminal, execute the following commands:

```bash
# 1. Clone your repository into /home/ubuntu/AI-Interview-System
git clone https://github.com/PRANSHI2316/AI-Interview-System.git
cd AI-Interview-System

# 2. Create your secure backend environment file
nano backend/.env
```

Paste your production configuration into `nano` (replace `your_actual_gemini_api_key_here` with your key):

```ini
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
FLASK_SECRET_KEY=production-secure-interview-secret-change-me-7788
WHISPER_MODEL=base
FLASK_DEBUG=false
```

Press `Ctrl + O`, then `Enter` to save, and `Ctrl + X` to exit.

---

### Step 4: Run the 1-Click Setup Script

Run the automated installer script included in the repository:

```bash
chmod +x deploy/setup-ec2.sh
./deploy/setup-ec2.sh
```

**What this script does automatically:**
- Updates system packages and installs `ffmpeg`, `nginx`, `libsndfile1`, and `python3-venv`.
- Creates a 2GB swap space for Whisper audio AI processing.
- Sets up Node.js 20 LTS and builds the production React frontend.
- Sets up Python 3.12 virtual environment and installs PyTorch CPU & dependencies.
- Configures Gunicorn backend as a background systemd service (`ai-interview`).
- Configures Nginx reverse proxy on port 80.

Once finished, test your server by visiting:
`http://YOUR_EC2_PUBLIC_IPV4_ADDRESS`

---

### Step 5: Enable Free HTTPS (SSL) for Camera & Microphone

Because browsers require HTTPS for camera and microphone access, you need an SSL certificate.

#### Option A — If you own a custom domain (e.g. `interview.yourdomain.com`):
1. In your domain provider (GoDaddy, Namecheap, Cloudflare, Route53), add an **A Record**:
   - **Type:** `A`
   - **Name:** `interview` (or `@`)
   - **Value:** Your EC2 Public IPv4 Address
2. On your EC2 terminal, run:
   ```bash
   sudo certbot --nginx -d interview.yourdomain.com
   ```
3. Enter your email and agree to terms. Certbot will automatically install SSL and redirect HTTP to HTTPS!

#### Option B — Free Instant Domain with `nip.io` or `sslip.io` (No purchase required!):
If you do not own a custom domain, you can use the free wildcard DNS service `nip.io`.
For example, if your EC2 IP is `13.233.50.120`, your free domain name is:
`13.233.50.120.nip.io`

Run:
```bash
sudo certbot --nginx -d YOUR_EC2_IP.nip.io
```
Certbot will issue a valid, trusted SSL certificate immediately, giving you a live HTTPS link!

---

## 4. Useful Management Commands on EC2

- **Check backend status:**
  ```bash
  sudo systemctl status ai-interview
  ```
- **View live backend logs:**
  ```bash
  sudo journalctl -u ai-interview -f
  ```
- **Restart backend after code updates:**
  ```bash
  sudo systemctl restart ai-interview
  ```
- **Check Nginx status:**
  ```bash
  sudo systemctl status nginx
  ```
- **Pull latest code from GitHub & rebuild:**
  ```bash
  cd ~/AI-Interview-System
  git pull origin main
  cd frontend && npm run build
  sudo systemctl restart ai-interview
  ```
