# Quick Start: Deploy Workived to Production in 30 Minutes

This guide gets you from zero to production-ready Workived deployment.

## Prerequisites

- Domain name configured with Cloudflare (free tier)
- VPS account (Hetzner/Vultr/DigitalOcean)
- Supabase account (free tier)
- Cloudflare R2 account (pay-as-you-go, ~$0.15/GB/month)
- AWS account for SES (optional, for email)

**Total expected cost:** $7–30/month depending on usage

---

## Step 1: Provision VPS (5 minutes)

### Option A: Hetzner (cheapest, Germany/Finland)
1. Go to https://www.hetzner.com/cloud
2. Create CX21 server:
   - Location: Nuremberg (for UAE) or Helsinki
   - Image: Ubuntu 22.04
   - SSH key: Upload your public key
3. Note the IP address

### Option B: Vultr (Singapore available)
1. Go to https://www.vultr.com
2. Deploy High Frequency Compute:
   - Location: Singapore (for Indonesia)
   - Plan: 2GB RAM, 1 vCPU ($12/month)
   - OS: Ubuntu 22.04
   - SSH key: Add your public key
3. Note the IP address

---

## Step 2: Setup VPS (10 minutes)

SSH into your VPS and run the setup script:

```bash
# SSH as root
ssh root@<your-vps-ip>

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/your-org/workived/main/scripts/setup-production-vps.sh -o setup.sh
chmod +x setup.sh
sudo bash setup.sh

# This will:
# - Create deployment user 'workived'
# - Install Docker, Docker Compose
# - Configure firewall (UFW)
# - Setup automatic security updates
# - Install migration tools

# Logout and login as the deployment user
exit
ssh workived@<your-vps-ip>
```

---

## Step 3: Setup PostgreSQL Database (3 minutes)

1. Go to https://supabase.com
2. Click "New Project"
   - Organization: Create or select
   - Name: workived-production
   - Database Password: Generate strong password (save it!)
   - Region: Singapore or Frankfurt (match your VPS)
   - Plan: Free (upgrades automatically to $25/month after 500MB)

3. Copy the connection string:
   - Go to Project Settings → Database
   - Find "Connection pooling" (port 6543)
   - Copy the connection string (URI format)
   - Example: `postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## Step 4: Setup Cloudflare R2 Storage (3 minutes)

1. Go to Cloudflare Dashboard → R2
2. Create bucket: `workived-files-production`
3. Go to "Manage R2 API Tokens"
4. Create API token:
   - Name: workived-production
   - Permissions: Object Read & Write
   - TTL: Forever
5. Save Access Key ID and Secret Access Key
6. Note your account ID from the R2 dashboard URL

---

## Step 5: Setup Amazon SES for Email (5 minutes)

1. Go to AWS Console → SES (Simple Email Service)
2. Select region: ap-southeast-1 (Singapore)
3. Verify domain: workived.com
   - Add DNS records to Cloudflare (DKIM, SPF, DMARC)
4. Request production access (initially in sandbox mode)
5. Create SMTP credentials:
   - Go to SMTP Settings → Create SMTP Credentials
   - Save the username and password

**Alternative:** Use SendGrid, Mailgun, or Postmark if you prefer.

---

## Step 6: Configure DNS (2 minutes)

In Cloudflare DNS settings, add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | api | `<your-vps-ip>` | ✅ Proxied |
| A | app | `<your-vps-ip>` | ✅ Proxied |

Wait 1-2 minutes for DNS to propagate.

---

## Step 7: Deploy Application (7 minutes)

SSH back into your VPS:

```bash
# Clone the repository
cd /home/workived
git clone https://github.com/your-org/workived.git app
cd app

# Create production environment file
cp .env.production.example .env.production
nano .env.production
```

Edit `.env.production` with your values:

```bash
# Server
PORT=8080
ENV=production

# Database (from Step 3)
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# Redis (local)
REDIS_URL=redis://redis:6379

# Auth - generate with: openssl rand -base64 32
JWT_SECRET=<paste-generated-secret-here>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h

# Storage (from Step 4)
S3_BUCKET=workived-files-production
S3_REGION=auto
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>

# Email (from Step 5)
SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<ses-smtp-username>
SMTP_PASS=<ses-smtp-password>
EMAIL_FROM=noreply@workived.com

# App URLs
APP_URL=https://app.workived.com
API_URL=https://api.workived.com
```

Generate JWT secret:
```bash
openssl rand -base64 32
```

Run database migrations:
```bash
export $(grep -v '^#' .env.production | xargs)
migrate -path migrations -database "$DATABASE_URL" up
```

Start the application:
```bash
docker-compose -f docker-compose.production.yml up -d
```

Check logs:
```bash
docker-compose -f docker-compose.production.yml logs -f
```

Verify health:
```bash
curl http://localhost:8080/health
# Should return: {"status":"ok"}
```

---

## Step 8: Setup Nginx & SSL (5 minutes)

Since we're using Cloudflare proxy, SSL is automatically handled by Cloudflare. If you want end-to-end encryption:

```bash
# Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Copy nginx configs
sudo cp infra/nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp infra/nginx/conf.d/*.conf /etc/nginx/conf.d/

# Get SSL certificates
sudo certbot --nginx -d api.workived.com -d app.workived.com --non-interactive --agree-tos -m your-email@example.com

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

Verify:
```bash
curl https://api.workived.com/health
# Should return: {"status":"ok"}

curl https://app.workived.com
# Should return HTML
```

---

## Step 9: Setup CI/CD (Optional, 5 minutes)

1. Go to your GitHub repository settings
2. Go to Settings → Secrets and variables → Actions
3. Add these secrets:
   - `PRODUCTION_HOST_SG`: Your VPS IP address
   - `PRODUCTION_SSH_KEY`: Your private SSH key (base64 encoded)

Generate SSH key for deployment:
```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/workived_deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/workived_deploy.pub workived@<vps-ip>

# Copy private key content (paste into GitHub secret)
cat ~/.ssh/workived_deploy | base64
```

Now every push to `main` branch will auto-deploy!

---

## Step 10: Setup Monitoring (Optional, 3 minutes)

### Free uptime monitoring with UptimeRobot:

1. Go to https://uptimerobot.com (free tier: 50 monitors)
2. Add monitors:
   - Monitor 1: https://api.workived.com/health (HTTP every 5 minutes)
   - Monitor 2: https://app.workived.com (HTTP every 5 minutes)
3. Setup alerts via email or Slack

### System monitoring with Netdata:

```bash
# Install Netdata (runs on port 19999)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://<vps-ip>:19999
# Restrict access to your IP only:
sudo ufw allow from <your-ip> to any port 19999
```

---

## Verification Checklist

After deployment, verify everything works:

- [ ] API health check: `curl https://api.workived.com/health`
- [ ] Web app loads: Visit `https://app.workived.com`
- [ ] Can create account
- [ ] Can login
- [ ] Email delivery works (check spam folder)
- [ ] File upload works
- [ ] No errors in logs: `docker-compose -f docker-compose.production.yml logs --tail=50`
- [ ] SSL certificate valid (no browser warnings)
- [ ] Uptime monitoring configured
- [ ] Database backups enabled (Supabase auto-backup)

---

## Common Issues & Solutions

### Issue: Can't connect to database
```bash
# Test database connection from VPS
psql "$DATABASE_URL"

# If fails, check:
# 1. Supabase pooler URL (port 6543, not 5432)
# 2. sslmode=require in connection string
# 3. IP whitelist in Supabase (usually not needed)
```

### Issue: API health check fails
```bash
# Check API logs
docker-compose -f docker-compose.production.yml logs api

# Check if API container is running
docker-compose -f docker-compose.production.yml ps

# Restart API
docker-compose -f docker-compose.production.yml restart api
```

### Issue: Files not uploading to R2
```bash
# Test R2 connection with AWS CLI
docker run --rm -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  amazon/aws-cli s3 ls s3://workived-files-production \
  --endpoint-url https://[account-id].r2.cloudflarestorage.com

# Check API logs for S3 errors
docker-compose -f docker-compose.production.yml logs api | grep -i s3
```

### Issue: Email not sending
```bash
# Check SES sandbox mode (AWS Console)
# Verify sender email address
# Check SMTP credentials in .env.production
# Look for SMTP errors in logs
docker-compose -f docker-compose.production.yml logs api | grep -i smtp
```

---

## Maintenance Commands

```bash
# Health check
bash scripts/health-check.sh

# View logs
docker-compose -f docker-compose.production.yml logs -f api

# Deploy updates
bash scripts/deploy-production.sh

# Restart services
docker-compose -f docker-compose.production.yml restart

# Clean up disk space
docker system prune -af

# Backup Redis
docker exec $(docker ps -qf "name=redis") redis-cli BGSAVE
```

---

## Cost Breakdown

Based on actual usage for first 500 organizations:

| Service | Provider | Cost/month |
|---------|----------|------------|
| VPS (2GB RAM) | Hetzner/Vultr | $5–12 |
| Database (500MB) | Supabase | $0 |
| Storage (10GB) | Cloudflare R2 | $1.50 |
| Email (10k/month) | Amazon SES | $1 |
| CDN/DNS | Cloudflare | $0 |
| **Total** | | **$7.50–14.50** |

After 500MB database:
- Supabase Pro: +$25/month (8GB database + daily backups)
- **Total with paid DB:** $32.50–39.50/month

---

## Next Steps

1. **Add first organization:** Sign up via web app
2. **Import employees:** Use bulk import in UI
3. **Test workflows:** Try leave requests, attendance tracking
4. **Monitor for 48 hours:** Watch for errors, performance issues
5. **Set up alerts:** Email notifications for downtime
6. **Document runbooks:** Disaster recovery procedures
7. **Plan for scale:** When to upgrade VPS, add replicas

---

## Getting Help

- Check logs: `docker-compose -f docker-compose.production.yml logs`
- System health: `bash scripts/health-check.sh`
- Full deployment guide: See [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)

**Congratulations! 🎉 Workived is now running in production.**
