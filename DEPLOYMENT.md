# 🚀 VPS Deployment & WhatsApp Integration Guide

This guide explains how to deploy the **Anveek Store** application on a VPS (Ubuntu / Debian / any Linux VPS) with automated WhatsApp order confirmation messages using **Baileys**.

---

## 📋 Features

1. **Supabase Database**: Stores all orders directly in your Supabase database (`public.orders`).
2. **Baileys WhatsApp Bot**: Automatically sends an order confirmation message to the customer's phone number as soon as they confirm an order.
3. **Web QR Scanner in Admin**: Scan your WhatsApp QR code directly from the `/admin` dashboard without needing to use terminal ASCII QR codes.
4. **Persistent Session**: Your WhatsApp login session is stored in `./whatsapp-auth/` so you don't have to rescan the QR code on server reboots.

---

## 🛠️ Prerequisites on Your VPS

- Ubuntu 20.04 / 22.04 / 24.04 (or Debian)
- Git
- Either **Docker & Docker Compose** (Option 1 - Recommended) OR **Node.js 22 + Bun + PM2** (Option 2)

---

## 🐳 Option 1: Deploy with Docker Compose (Recommended)

### 1. Connect to your VPS:
```bash
ssh root@your-vps-ip
```

### 2. Install Docker & Docker Compose (if not already installed):
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 3. Clone or copy your project:
```bash
git clone <your-git-repo-url> /opt/anveek
cd /opt/anveek
```

### 4. Create your `.env` file:
```bash
nano .env
```
Paste your configuration:
```env
SUPABASE_PROJECT_ID="cxfycxurzjsegbpbbmsq"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_URL="https://cxfycxurzjsegbpbbmsq.supabase.co"
VITE_SUPABASE_PROJECT_ID="cxfycxurzjsegbpbbmsq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://cxfycxurzjsegbpbbmsq.supabase.co"

# Supabase Service Role Key (from Supabase Dashboard > Project Settings > API)
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# Admin Dashboard Password (used to view orders at /admin)
ADMIN_PASSWORD="your_admin_password"
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 5. Start the App:
```bash
docker compose up -d --build
```

### 6. View Logs & Scan WhatsApp QR Code:
```bash
docker logs -f anveek-store
```
*Note:* You can also open `http://your-vps-ip:3000/admin` in your browser, enter your admin password, and scan the QR code right from the web page!

---

## ⚡ Option 2: Deploy with PM2 & Bun/Node (Without Docker)

### 1. Install Node.js & Bun on VPS:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
npm install -g pm2
```

### 2. Clone project & install dependencies:
```bash
cd /opt/anveek
bun install
```

### 3. Build project:
```bash
bun run build
```

### 4. Start with PM2:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 5. View Logs:
```bash
pm2 logs anveek-store
```

---

## 🌐 Linking Domain & Free SSL (Nginx + Certbot)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp nginx.conf /etc/nginx/sites-available/anveek
# Edit yourdomain.com in /etc/nginx/sites-available/anveek
sudo ln -s /etc/nginx/sites-available/anveek /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Free SSL certificate:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 📱 How WhatsApp Confirmation Works

1. Customer places an order on your site (`/`).
2. Order is saved to Supabase (`public.orders`).
3. Baileys sends a WhatsApp message in Gujarati to the customer's phone:
   ```
   🌿 *Anveek શુદ્ધ સીંગતેલ* 🌿

   નમસ્તે *[Name]* જી,
   તમારો ઓર્ડર સફળતાપૂર્વક નોંધાઈ ગયો છે! 🙏

   📦 *ઓર્ડર વિગતો:*
   • જથ્થો: *[Qty] બોક્સ (5 લીટર)*
   • કુલ રકમ: *₹[Amount]* (કેશ ઓન ડિલિવરી - COD)
   • ડિલિવરી સરનામું: *[Address]*
   • મોબાઈલ નંબર: *[Phone]*

   તમારો ઓર્ડર ટૂંક સમયમાં તૈયાર કરીને તમારા સરનામે રવાના કરવામાં આવશે.
   ડિલિવરી સમયે તમે રોકડ ચૂકવણી (COD) કરી શકો છો.

   કોઈપણ પ્રશ્ન હોય તો આ જ નંબર પર સંપર્ક કરી શકો છો.

   આભાર,
   *Anveek ટીમ* ✨
   ```
4. If WhatsApp is temporarily disconnected, the order in Supabase is **never affected or lost**!
