# WebotApp WhatsGateway (v1.5.4) — Complete Installation & Setup Guide

Multi-Device WhatsApp Marketing, Chatbot, Customer Support & REST API Gateway.

---

## Table of Contents
1. [System Requirements](#1-system-requirements)
2. [Quickstart: Localhost Installation (macOS / Windows / Linux)](#2-quickstart-localhost-installation)
3. [Production Installation: Ubuntu / Debian VPS](#3-production-installation-ubuntu--debian-vps)
4. [Docker & Docker Compose Deployment](#4-docker--docker-compose-deployment)
5. [License Activation Process](#5-license-activation-process)
6. [Creating Administrator Account](#6-creating-administrator-account)
7. [Production Best Practices & Nginx SSL Configuration](#7-production-best-practices--nginx-ssl-configuration)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. System Requirements

- **Node.js**: `v18.18+` or `v20.x` or `v22.x` (LTS recommended)
- **Database**: PostgreSQL 14+ (Local, Amazon RDS, Supabase, Neon, or Railway)
- **Memory (RAM)**: Minimum 1GB RAM (2GB+ recommended for 10+ concurrent WhatsApp sessions)
- **Operating System**: macOS, Linux (Ubuntu, Debian, CentOS, AlmaLinux), or Windows 10/11
- **Process Manager**: PM2 (for 24/7 background uptime in production)

---

## 2. Quickstart: Localhost Installation

### Step 1: Extract Source Code
Extract the downloaded zip file and navigate into the project directory:
```bash
cd whats-gateway
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` in any text editor and update your settings:
```env
PORT=3000
NODE_ENV=development
BASE_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="use-a-strong-random-32-character-secret-key-here"

# Your PostgreSQL Database URL:
DATABASE_URL="postgresql://username:password@localhost:5432/wa_gateway_db?schema=public"

# WebotApp Lab Licensing API:
LAB_API_BASE="https://lab.webotapp.com/api"
```

### Step 4: Setup Database
Run Prisma to automatically create all database tables:
```bash
npx prisma db push
```

### Step 5: Create Super Admin Account
Use the built-in setup script to initialize your administrator account:
```bash
node scripts/setup-admin.js admin@example.com admin123
```
*(Replace `admin@example.com` and `admin123` with your desired login credentials).*

### Step 6: Start Server
- **Development Mode**:
  ```bash
  npm run dev
  ```
- **Production Mode (Recommended for testing production speed)**:
  ```bash
  npm run build
  npm start
  ```

Open your browser at: `http://localhost:3000`

---

## 3. Production Installation (Ubuntu / Debian VPS)

### Step 1: Install Node.js & PostgreSQL
```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git nginx postgresql postgresql-contrib

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Setup PostgreSQL Database
```bash
sudo -u postgres psql
```
In the PostgreSQL prompt, run:
```sql
CREATE DATABASE wa_gateway_db;
CREATE USER wa_user WITH ENCRYPTED PASSWORD 'StrongSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE wa_gateway_db TO wa_user;
ALTER DATABASE wa_gateway_db OWNER TO wa_user;
\q
```

### Step 3: Deploy Application Code
Upload the source code to `/var/www/whats-gateway`:
```bash
cd /var/www/whats-gateway
npm install
cp .env.example .env
```
Edit `.env` for production:
```env
PORT=3000
NODE_ENV=production
BASE_URL="https://yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_TRUST_HOST="true"

DATABASE_URL="postgresql://wa_user:StrongSecurePassword123!@localhost:5432/wa_gateway_db?schema=public"
LAB_API_BASE="https://lab.webotapp.com/api"
```

### Step 4: Migrate Database & Setup Super Admin
```bash
npx prisma db push
node scripts/setup-admin.js admin@yourdomain.com StrongAdminPassword123!
```

### Step 5: Build & Run with PM2
```bash
npm run build

# Start using PM2
pm2 start npm --name "whats-gateway" -- start

# Save PM2 startup list to auto-start on server reboot
pm2 save
pm2 startup
```

---

## 4. Docker & Docker Compose Deployment

If you prefer containerized deployment:
```bash
# Clone or copy files
cd whats-gateway

# Copy .env
cp .env.example .env

# Start with Docker Compose
docker compose up -d
```

---

## 5. License Activation Process

This software is protected by **WebotApp Single-Domain Licensing**. Immediately after installation, you must activate your license to unlock the dashboard and WhatsApp engine:

1. Visit **`https://lab.webotapp.com/activate`** in your browser.
2. In the registration form:
   - **Marketplace**: Select **Direct / Agency** (or CodeCanyon/Codester if purchased there).
   - **Order ID / Purchase Code**: Enter your Order ID or Receipt number.
   - **Product**: Select **WhatsGateway — Multi-Device WhatsApp Marketing, Chatbot & REST API Gateway**.
   - **Customer Details**: Enter your Name, Email, and Phone Number.
   - Click **Generate License Key**.
3. You will receive your official license key in the format:
   ```
   WEBOT-WA-REG-XXXX-XXXX-XXXX
   ```
4. Now, open your installed gateway in your browser:
   - Localhost: `http://localhost:3000/auth/login`
   - Production: `https://yourdomain.com/auth/login`
5. Log in with your Super Admin credentials.
6. The system will automatically direct you to the **/activate** screen:
   - Enter your `WEBOT-WA-...` license key.
   - Click **Authorize & Unlock Dashboard**.
7. Once verified, your installation will be cryptographically unlocked and bound to your domain!

---

## 6. Creating Administrator Account

You can create or promote any user to **SUPERADMIN** anytime using the CLI:
```bash
node scripts/setup-admin.js <email> <password>
```
If the user already exists, it will upgrade them to Super Admin. If not, it will create a new Super Admin account.

---

## 7. Production Nginx Reverse Proxy with SSL & WebSockets

Create `/etc/nginx/sites-available/whats-gateway`:
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support (Crucial for Socket.IO & WhatsApp QR live updates)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-lived WhatsApp connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable site and install free SSL with Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/whats-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 8. Troubleshooting & FAQs

### Q: Why does the terminal show "[FATAL LICENSE LOCK]"?
**A**: This is the expected anti-tamper security behavior on a fresh install before license activation. Simply log into the web dashboard and enter your valid `WEBOT-WA-...` license key on the `/activate` page.

### Q: Port 3000 is already in use
**A**: Change `PORT="3030"` in `.env`, or kill the process using port 3000:
```bash
lsof -i :3000
kill -9 <PID>
```

### Q: WhatsApp QR Code is not updating / connecting
**A**: Ensure your Nginx configuration includes `Upgrade` and `Connection "upgrade"` headers for WebSocket traffic (`/api/socket/io`).

### Q: Database connection error `P1001: Can't reach database server`
**A**: Verify that PostgreSQL is running (`sudo systemctl status postgresql`) and that your credentials in `DATABASE_URL` are correct.

---

## Support & Assistance
- **Official Portal**: https://lab.webotapp.com
- **License Activation**: https://lab.webotapp.com/activate
- **Email Support**: support@webotapp.com
