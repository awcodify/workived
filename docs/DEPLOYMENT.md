# Workived Deployment Guide — Cost-Optimized Production

> **Cost target:** $25–40/month for first 500 organisations
> **Deployment model:** Single VPS + managed PostgreSQL per region
> **Geographic strategy:** 2 regions (Asia + UAE)

---

## 1. Recommended Architecture (Phase 1 — Launch)

### Option A: Ultra-low cost ($25–35/month per region) ⭐ **RECOMMENDED**

**When to use:** Launch, first 100–500 orgs, MVP validation

| Component | Service | Spec | Cost/month | Notes |
|-----------|---------|------|------------|-------|
| **Compute** | Hetzner Cloud CX21 | 2 vCPU, 4GB RAM, 40GB SSD | €4.51 (~$5) | Germany (UAE) or Finland (backup) |
| **Compute** | Vultr High Frequency | 1 vCPU, 2GB RAM, 55GB SSD | $12 | Singapore (Indonesia) |
| **Database** | Supabase Free Tier | 500MB DB, daily backups | $0 → $25 | Free for first 500MB, then $25/month |
| **Storage** | Cloudflare R2 | 10GB storage, Class A ops free | $0.15/GB/month | No egress fees! |
| **DNS/CDN** | Cloudflare | Global CDN, DDoS protection | $0 | Free tier is sufficient |
| **Email** | Amazon SES | 62,000 emails/month | $0 → $6.20 | First 62k free with EC2 |

**Total:** ~$12–30/month for first region depending on database usage.

---

### Stack Deployment on Single VPS

```
┌─────────────────────────────────────────────────┐
│              Hetzner/Vultr VPS                  │
│  ┌─────────────────────────────────────────┐   │
│  │  Nginx (443) → TLS termination          │   │
│  │    ↓                                     │   │
│  │  Go API (8080) ────────┐                │   │
│  │    ↓                   ↓                │   │
│  │  Redis (6379)    Static files (/)       │   │
│  └────────────────────────┬────────────────┘   │
└────────────────────────────┼────────────────────┘
                             ↓
              ┌──────────────────────────┐
              │  Supabase PostgreSQL     │
              │  (managed, external)     │
              └──────────────────────────┘
```

**Why this works:**
- Go is extremely efficient (handles 10k+ req/s on 2 vCPU)
- React SPA is static files (served by nginx, cached by Cloudflare)
- Redis is lightweight (20-50MB RAM for this workload)
- 100 orgs × 25 employees = 2,500 users → easily handled by 4GB RAM
- Supabase handles backups, replication, point-in-time recovery

---

## 2. Deployment Steps

### Step 1: Provision VPS

**For Singapore (Indonesia traffic):**
```bash
# Vultr High Frequency Singapore
# OS: Ubuntu 22.04 LTS
# Firewall: 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

**For Germany (UAE traffic):**
```bash
# Hetzner CX21 Nuremberg/Falkenstein
# OS: Ubuntu 22.04 LTS
# Firewall: 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@<server-ip>

# Create deploy user
adduser workived
usermod -aG sudo workived
mkdir /home/workived/.ssh
cp ~/.ssh/authorized_keys /home/workived/.ssh/
chown -R workived:workived /home/workived/.ssh

# Switch to deploy user
su - workived

# Install Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker workived
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install nginx and certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# Logout and login again for docker group to take effect
exit
exit
ssh workived@<server-ip>
```

### Step 3: Setup PostgreSQL (Supabase)

```bash
# Go to https://supabase.com
# Create new project (select Singapore or Frankfurt region)
# Copy connection string:
# postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Note: Use pooler URL (port 6543) for production
# This uses pgBouncer for connection pooling
```

### Step 4: Setup Cloudflare R2

```bash
# Go to Cloudflare dashboard → R2
# Create bucket: workived-files-production
# Create API token with read/write access
# Note: Endpoint looks like: https://[account-id].r2.cloudflarestorage.com
```

### Step 5: Deploy Application

```bash
# Create app directory
mkdir -p /home/workived/app
cd /home/workived/app

# Clone repo (or setup CI/CD — see Section 4)
git clone https://github.com/your-org/workived.git .

# Create production environment file
cat > .env.production << 'EOF'
# Server
PORT=8080
ENV=production

# Database (Supabase)
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# Redis (local on VPS)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h

# Storage (Cloudflare R2)
S3_BUCKET=workived-files-production
S3_REGION=auto
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>

# Email (Amazon SES)
SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<ses-smtp-user>
SMTP_PASS=<ses-smtp-password>
EMAIL_FROM=noreply@workived.com

# App URLs
APP_URL=https://app.workived.com
API_URL=https://api.workived.com
EOF

# Generate JWT secret
openssl rand -base64 32
```

### Step 6: Setup Production Docker Compose

Create `/home/workived/app/docker-compose.production.yml`:

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - workived

  api:
    build:
      context: services
      dockerfile: Dockerfile
    restart: always
    env_file:
      - .env.production
    depends_on:
      - redis
    networks:
      - workived
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: always
    networks:
      - workived
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  # Auto-update containers when new images are pushed
  watchtower:
    image: containrrr/watchtower
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup --label-enable
    networks:
      - workived

networks:
  workived:
    driver: bridge

volumes:
  redis_data:
```

### Step 7: Run Migrations

```bash
# Install migrate CLI
curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/

# Run migrations against Supabase
export DATABASE_URL="postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
migrate -path migrations -database "$DATABASE_URL" up
```

### Step 8: Start Application

```bash
cd /home/workived/app
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Verify health
curl http://localhost:8080/health
```

### Step 9: Setup Nginx Reverse Proxy

```bash
# Create API nginx config
sudo tee /etc/nginx/sites-available/api.workived.com << 'EOF'
upstream api_backend {
    server localhost:8080;
}

server {
    listen 80;
    server_name api.workived.com;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Create web app nginx config  
sudo tee /etc/nginx/sites-available/app.workived.com << 'EOF'
upstream web_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name app.workived.com;

    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable sites
sudo ln -s /etc/nginx/sites-available/api.workived.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/app.workived.com /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 10: Setup SSL (Let's Encrypt)

```bash
# Get certificates for both domains
sudo certbot --nginx -d api.workived.com -d app.workived.com

# Certbot auto-configures nginx for HTTPS and sets up auto-renewal
# Verify auto-renewal
sudo certbot renew --dry-run
```

### Step 11: Setup Monitoring (Optional but recommended)

```bash
# Install Netdata for system monitoring (free, lightweight)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://<server-ip>:19999
# Setup Cloudflare tunnel or restrict to your IP
sudo ufw allow from <your-ip> to any port 19999
```

---

## 3. DNS Configuration (Cloudflare)

Set these DNS records in Cloudflare:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | api | `<singapore-vps-ip>` | ✅ Proxied | Auto |
| A | app | `<singapore-vps-ip>` | ✅ Proxied | Auto |
| A | api-uae | `<germany-vps-ip>` | ✅ Proxied | Auto |
| A | app-uae | `<germany-vps-ip>` | ✅ Proxied | Auto |
| CNAME | www | workived.com | ✅ Proxied | Auto |

**Cloudflare benefits:**
- Free SSL
- DDoS protection
- CDN (caches static assets globally)
- Automatic bot filtering
- Analytics

---

## 4. CI/CD with GitHub Actions (Zero cost)

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy-singapore:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Singapore VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST_SG }}
          username: workived
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /home/workived/app
            git pull origin main
            docker-compose -f docker-compose.production.yml build
            docker-compose -f docker-compose.production.yml up -d
            docker system prune -af

  deploy-germany:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Germany VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST_DE }}
          username: workived
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /home/workived/app
            git pull origin main
            docker-compose -f docker-compose.production.yml build
            docker-compose -f docker-compose.production.yml up -d
            docker system prune -af

  notify:
    needs: [deploy-singapore, deploy-germany]
    runs-on: ubuntu-latest
    steps:
      - name: Notify deployment
        run: echo "Deployed to production successfully"
```

Add these secrets to GitHub repository settings:
- `PRODUCTION_HOST_SG`: Singapore VPS IP
- `PRODUCTION_HOST_DE`: Germany VPS IP
- `PRODUCTION_SSH_KEY`: Private SSH key for deployment

---

## 5. Backup Strategy

### Database (Automated by Supabase)
- Daily automated backups (included in free tier)
- 7-day retention on free tier
- Point-in-time recovery on paid tier ($25/month)

### Files (Cloudflare R2)
- R2 has built-in durability (11 nines)
- Optional: Setup versioning on bucket
- Cost: $0.15/GB/month stored

### Redis (optional — mostly cache)
```bash
# Add to crontab on VPS
0 2 * * * docker exec $(docker ps -qf "name=redis") redis-cli BGSAVE
```

---

## 6. Scaling Path

### Phase 1: Launch → 500 orgs (Current setup)
- **Cost:** $25–35/month per region
- **VPS:** Single server handles all traffic
- **DB:** Supabase free tier (500MB)

### Phase 2: 500 → 2,000 orgs
- **Cost:** $60–80/month per region
- **VPS:** Upgrade to 4 vCPU, 8GB RAM ($20/month)
- **DB:** Supabase Pro ($25/month) for 8GB + daily backups
- **Redis:** Same VPS (sufficient)

### Phase 3: 2,000 → 10,000 orgs
- **Cost:** $200–300/month per region
- **VPS:** 2× VPS behind load balancer
- **DB:** Dedicated PostgreSQL (DigitalOcean $60/month or Supabase Team $599/month)
- **Redis:** Upgrade to managed Redis (~$10/month)
- **CDN:** Upgrade Cloudflare to Pro for better caching ($20/month)

### Phase 4: 10,000+ orgs (Re-architecture needed)
- Move to Kubernetes (GKE/EKS)
- Implement read replicas
- Add Elasticsearch for search
- Consider moving to managed services fully

---

## 7. Cost Breakdown Summary

### Monthly Costs per Region

| Org Count | Compute | Database | Storage | Email | Total |
|-----------|---------|----------|---------|-------|-------|
| **0–500** | $5–12 | $0 | $2 | $0 | **$7–14** |
| **500–2k** | $20 | $25 | $5 | $6 | **$56** |
| **2k–10k** | $40 | $60 | $15 | $20 | **$135** |

### First Year Projection (Conservative)
- Month 1-3: 50 orgs → $10/month
- Month 4-6: 200 orgs → $15/month
- Month 7-9: 500 orgs → $30/month
- Month 10-12: 1,000 orgs → $60/month

**Year 1 Total Infrastructure:** ~$450

---

## 8. Alternative Options (When to Consider)

### When you have $500+/month budget and want less ops:

**Option B: Render.com**
- Web service: $7/month (512MB RAM)
- PostgreSQL: $7/month (256MB)
- Redis: $10/month (25MB)
- Total: ~$24/month per region, zero ops

**Option C: Railway.app**
- $20 credit included/month
- Pay for what you use (~$30-40/month for this stack)
- Great developer experience

### When you have $1,000+/month budget:

**Option D: AWS ECS Fargate + RDS**
- More expensive but better for 10k+ orgs
- Full managed services
- Better for scaling to enterprise

---

## 9. Security Checklist

- [ ] VPS firewall configured (only 22, 80, 443 open)
- [ ] SSH key-based authentication only (disable password login)
- [ ] Database uses SSL connection (sslmode=require)
- [ ] JWT secret is strong random string (32+ bytes)
- [ ] Environment variables never committed to git
- [ ] Cloudflare proxy enabled (hides origin IP)
- [ ] Let's Encrypt SSL certificates auto-renewing
- [ ] Redis has no external access (internal only)
- [ ] Docker containers run as non-root users
- [ ] Regular security updates enabled (unattended-upgrades)

```bash
# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 10. Monitoring & Alerts

### Free monitoring stack:

1. **Uptime monitoring:** UptimeRobot (free, 50 monitors)
   - Monitor: api.workived.com/health
   - Monitor: app.workived.com
   - Alert via email/Slack

2. **Error tracking:** Sentry (free tier: 5k errors/month)
   - Integrate in Go API
   - Integrate in React app

3. **System metrics:** Netdata (free, self-hosted)
   - CPU, RAM, disk, network
   - Docker container metrics
   - Access via: http://server-ip:19999

---

## 11. Disaster Recovery

### Runbook for common issues:

**VPS goes down:**
```bash
# Spin up new VPS (10 minutes)
# Run setup script (5 minutes)
# Update DNS to new IP (5 minutes)
# Cloudflare cache serves app during transition

# Total downtime: ~5 minutes (DNS propagation)
```

**Database corruption:**
```bash
# Restore from Supabase backup (1 click in dashboard)
# Point-in-time recovery available on paid tier
# Maximum data loss: 24 hours (daily backups)
```

**Certificate expiry:**
```bash
# Certbot auto-renews (should never happen)
# Manual renewal: sudo certbot renew
```

---

## 12. Launch Checklist

Pre-launch:
- [ ] VPS provisioned in both regions
- [ ] Supabase PostgreSQL setup
- [ ] Cloudflare R2 bucket created
- [ ] Domain DNS pointed to Cloudflare
- [ ] SSL certificates obtained
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] CI/CD pipeline tested
- [ ] Monitoring setup (UptimeRobot + Netdata)
- [ ] Backup restoration tested

Post-launch monitoring (first 48 hours):
- [ ] Response times < 200ms (p95)
- [ ] No 5xx errors
- [ ] Memory usage < 60%
- [ ] CPU usage < 50%
- [ ] Disk usage < 70%
- [ ] Database connection pool healthy

---

## Summary

**Recommended for launch:** Option A (Single VPS + Supabase)
- **Cost:** $7–14/month for first 500 orgs
- **Simplicity:** One VPS, minimal operations
- **Scale:** Can grow to 2,000+ orgs before re-architecture
- **Exit velocity:** If it doesn't work, you've spent < $200 total

**This architecture prioritizes:**
1. ✅ **Low cost** — essential for freemium model
2. ✅ **Fast iteration** — simple deploy = ship features quickly
3. ✅ **Geographic coverage** — separate servers for Indonesia & UAE
4. ✅ **Known scale ceiling** — won't surprise you, clear upgrade path
5. ✅ **Boring technology** — VPS + Docker + PostgreSQL (battle-tested)

**Deploy time:** 2-3 hours for complete production setup.
