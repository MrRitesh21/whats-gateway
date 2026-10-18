# WebotApp WhatsGateway — Installation Manual & Deployment Guide

WebotApp WhatsGateway is an enterprise-grade multi-device WhatsApp gateway, chatbot builder, and REST API platform built on Next.js 16, Baileys, Prisma, and Socket.IO.

## 📞 Problems in Installing?
> **WhatsApp Us at +91 7002484119**  
> We provide complete installation, server setup, and configuration at as low as **at min price**.  
> Direct Chat Link: [https://wa.me/917002484119](https://wa.me/917002484119)

---

## 🔑 How to Get & Activate Your License Key

### A. Purchased on CodeCanyon, Codester, or Other Marketplaces
If you purchased this software on **CodeCanyon (Envato)**, **Codester**, or an authorized reseller:
1. Open the official WebotApp License Portal:  
   👉 **[https://lab.webotapp.com/activate](https://lab.webotapp.com/activate)**
2. Select your marketplace (**CodeCanyon** or **Codester**).
3. Select Product: **WebotApp WhatsGateway**.
4. Enter your **Marketplace Purchase Code** or **Order ID** (found in your marketplace Downloads page).
5. Enter your **Name**, **Email**, and **WhatsApp Phone Number**.
6. Click **"Verify Order & Issue Official License Key"**.
7. Your official license key (e.g. `WEBOT-WA-REG-XXXX-XXXX-XXXX`) will be displayed instantly on screen.
8. Paste this license key into Step 2 of the Web Activation Wizard.

### B. Purchased Directly on WebotApp Lab
If you purchased directly from WebotApp Lab:
1. Log in to your account at [https://lab.webotapp.com/dashboard](https://lab.webotapp.com/dashboard).
2. Go to the **Downloads / Products** tab.
3. Your dedicated License Key is listed next to WebotApp WhatsGateway.

---

## 📋 System Prerequisites
- **Node.js**: v18.18+ or v20.x LTS
- **Database**: MySQL 8.0+ or PostgreSQL 14+
- **Process Manager**: PM2
- **Memory**: Minimum 1GB RAM (2GB recommended)

---

## 🚀 Step-by-Step Installation

### 1. Extract and Install
```bash
unzip whats-gateway-v1.0.0.zip -d /var/www/whats-gateway
cd /var/www/whats-gateway
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Open Web Activation Wizard
Run the development/install server:
```bash
npm run dev
```
Open `http://your-domain-or-ip:3000/install` in your browser:
1. Verify system environment.
2. Enter your WebotApp Purchase Code (`WEBOT-WA-REG-...` or `WEBOT-WA-EXT-...`).
3. Connect your MySQL/PostgreSQL database.
4. Create your superadmin credentials.

---

## 🔐 4. Default Administrator Login Credentials

Once installation or database setup is complete, access your dashboard with:

- **Login URL**: `http://your-server-ip:3000/login`
- **Default Username / Email**: `admin@example.com`
- **Default Password**: `admin123`

### Create / Reset Admin via Command Line:
You can quickly create or update the superadmin credentials via terminal at any time:
```bash
node scripts/setup-admin.js admin@example.com admin123
```

---

## ⚡ 5. Production Deployment with PM2
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📞 Support & Verification
- Portal: https://lab.webotapp.com
- Support: support@webotapp.com
- WhatsApp VIP Support: +91 7002484119
