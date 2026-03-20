# Workived Infrastructure

Complete production deployment infrastructure for Workived — optimized for cost, simplicity, and scale.

## 📁 What's Included

This infrastructure setup includes everything needed to deploy Workived to production:

### Documentation
- **[DEPLOYMENT.md](../docs/DEPLOYMENT.md)** — Complete deployment guide with architecture options, cost analysis, and scaling paths
- **[QUICK_START_DEPLOY.md](../docs/QUICK_START_DEPLOY.md)** — 30-minute quickstart to get production running

### Configuration Files
- **[docker-compose.production.yml](../docker-compose.production.yml)** — Production Docker Compose stack
- **[.env.production.example](../.env.production.example)** — Production environment template
- **[Makefile.infra](../Makefile.infra)** — Infrastructure management commands

### Scripts
- **[setup-production-vps.sh](../scripts/setup-production-vps.sh)** — Automated VPS setup (Docker, security, etc.)
- **[deploy-production.sh](../scripts/deploy-production.sh)** — Automated deployment script
- **[health-check.sh](../scripts/health-check.sh)** — System health monitoring

### Nginx Configuration
- **[nginx.conf](./nginx/nginx.conf)** — Main nginx config with performance tuning
- **[api.conf](./nginx/conf.d/api.conf)** — API reverse proxy with rate limiting
- **[web.conf](./nginx/conf.d/web.conf)** — Web app reverse proxy with caching

### CI/CD
- **[deploy-production.yml](../.github/workflows/deploy-production.yml)** — GitHub Actions auto-deployment

---

## 🚀 Quick Start

### For first-time deployment:

1. **Read the quick start guide:**
   ```bash
   cat docs/QUICK_START_DEPLOY.md
   ```

2. **Provision a VPS** (Hetzner/Vultr/DigitalOcean)
   - 2GB RAM, 2 vCPU minimum
   - Ubuntu 22.04 LTS
   - Cost: $5–12/month

3. **Run the setup script on your VPS:**
   ```bash
   ssh root@<vps-ip>
   curl -fsSL https://raw.githubusercontent.com/your-org/workived/main/scripts/setup-production-vps.sh | bash
   ```

4. **Deploy the application:**
   ```bash
   ssh workived@<vps-ip>
   git clone https://github.com/your-org/workived.git app
   cd app
   cp .env.production.example .env.production
   # Edit .env.production with your credentials
   make prod-migrate
   docker-compose -f docker-compose.production.yml up -d
   ```

5. **Setup SSL with Let's Encrypt:**
   ```bash
   sudo certbot --nginx -d api.workived.com -d app.workived.com
   ```

**Total time:** 30-40 minutes  
**Total cost:** $7–14/month for first 500 organizations

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                   Cloudflare CDN                     │
│         (SSL, DDoS protection, caching)              │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│                   VPS (2GB RAM)                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Nginx (reverse proxy + rate limiting)        │ │
│  │    ├─→ api:8080  (Go backend)                 │ │
│  │    └─→ web:80    (React SPA)                  │ │
│  │                                                │ │
│  │  Redis (6379) — session cache                 │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│          External Managed Services                   │
│                                                      │
│  • PostgreSQL (Supabase) — database                 │
│  • Cloudflare R2 — file storage                     │
│  • Amazon SES — transactional email                 │
└──────────────────────────────────────────────────────┘
```

### Why This Stack?

✅ **Cost-effective:** $7–14/month for first 500 orgs  
✅ **Simple to operate:** Single VPS, managed DB/storage  
✅ **Geographic coverage:** Deploy in Singapore (Indonesia) & Germany (UAE)  
✅ **Known scale ceiling:** Handles 2,000+ orgs before re-architecture needed  
✅ **Boring technology:** Battle-tested stack (VPS + Docker + PostgreSQL)

---

## 💰 Cost Breakdown

### First 500 Organizations (~2,500 users)

| Component | Provider | Spec | Cost/month |
|-----------|----------|------|------------|
| **Compute** | Hetzner CX21 | 2 vCPU, 4GB RAM | $5 |
| **Database** | Supabase Free | 500MB, daily backup | $0 |
| **Storage** | Cloudflare R2 | 10GB | $1.50 |
| **Email** | Amazon SES | 10k emails | $1 |
| **CDN/DNS** | Cloudflare Free | Global, DDoS protection | $0 |
| **SSL** | Let's Encrypt | Auto-renewal | $0 |
| **Total** | | | **$7.50/month** |

### After 500MB Database (500-2,000 orgs)

| Component | Provider | Spec | Cost/month |
|-----------|----------|------|------------|
| **Compute** | Vultr HF | 1 vCPU, 2GB RAM | $12 |
| **Database** | Supabase Pro | 8GB, PITR backup | $25 |
| **Storage** | Cloudflare R2 | 25GB | $3.75 |
| **Email** | Amazon SES | 50k emails | $5 |
| **CDN/DNS** | Cloudflare Free | Global | $0 |
| **Total** | | | **$45.75/month** |

**Scaling path:** See [DEPLOYMENT.md](../docs/DEPLOYMENT.md#6-scaling-path) for 2k+ organizations.

---

## 🛠️ Management Commands

All commands available via Makefile:

```bash
# Local development
make dev                 # Start local env (Docker Compose)
make migrate-up          # Run database migrations
make test                # Run tests

# Production deployment
make prod-setup          # Setup fresh VPS (run as root)
make prod-deploy         # Deploy latest code
make prod-migrate        # Run production migrations
make prod-health         # Check system health
make prod-logs           # Tail production logs
make prod-restart        # Restart services

# View all commands
make help
```

---

## 📊 Monitoring

### Built-in Health Checks

The deployment includes automatic health monitoring:

```bash
# Manual health check
make prod-health

# Or run directly
bash scripts/health-check.sh
```

Checks:
- ✅ Container status
- ✅ API health endpoint
- ✅ Redis connectivity
- ✅ Disk usage warnings
- ✅ Memory usage warnings
- ✅ Recent error logs

### Recommended External Monitoring

1. **UptimeRobot** (free, 50 monitors)
   - Monitor: `https://api.workived.com/health`
   - Monitor: `https://app.workived.com`
   - Alert via: Email, Slack, Discord

2. **Netdata** (free, self-hosted)
   - Real-time system metrics
   - Docker container monitoring
   - Install: `bash <(curl -Ss https://my-netdata.io/kickstart.sh)`

3. **Sentry** (free tier: 5k errors/month)
   - Error tracking in Go API
   - Error tracking in React app

---

## 🔒 Security Features

✅ **Firewall configured:** Only ports 22, 80, 443 open  
✅ **Fail2ban:** Automatic ban on brute-force attempts  
✅ **Automatic security updates:** Unattended upgrades enabled  
✅ **SSL/TLS encryption:** Let's Encrypt with auto-renewal  
✅ **Database encryption:** SSL required for PostgreSQL  
✅ **Rate limiting:** Nginx rate limits on API endpoints  
✅ **DDoS protection:** Cloudflare proxy enabled  
✅ **SSH hardening:** Key-based auth only, no password login  

See full security checklist in [DEPLOYMENT.md](../docs/DEPLOYMENT.md#9-security-checklist).

---

## 🔄 CI/CD Pipeline

GitHub Actions automatically deploys on every push to `main`:

1. **Run tests** (98% coverage required)
2. **Deploy to Singapore VPS**
3. **Deploy to Germany VPS**
4. **Verify health checks**
5. **Notify on failure**

Setup requires:
- GitHub Secrets: `PRODUCTION_HOST_SG`, `PRODUCTION_HOST_DE`, `PRODUCTION_SSH_KEY`

See [.github/workflows/deploy-production.yml](../.github/workflows/deploy-production.yml).

---

## 📦 What Gets Deployed

### Docker Containers

- **api:** Go backend (single binary, ~15MB)
- **web:** React SPA (static files served by nginx)
- **redis:** Cache and session storage
- **nginx:** Reverse proxy, SSL termination, rate limiting
- **watchtower:** Auto-updates containers (optional)

### Persistent Data

- **Redis:** `/var/lib/docker/volumes/redis_data` (30-50MB)
- **Nginx logs:** `/var/log/nginx` (rotated daily)

Database and files are stored in external managed services (Supabase + R2).

---

## 🚨 Disaster Recovery

### Database Backup

- **Automatic:** Supabase daily backups (7-day retention on free tier)
- **Manual:** Point-in-time recovery on Supabase Pro ($25/month)
- **Restore time:** < 5 minutes via Supabase dashboard

### VPS Failure

1. Spin up new VPS (10 minutes)
2. Run `make prod-setup` (5 minutes)
3. Update DNS to new IP (5 minutes)
4. Cloudflare cache serves app during transition

**Total downtime:** ~5 minutes (DNS propagation)

### File Storage

- **R2 durability:** 99.999999999% (11 nines)
- **Versioning:** Enable in R2 bucket settings (optional)
- **Backup:** Not needed (R2 handles replication)

---

## 📚 Additional Resources

- **Full deployment guide:** [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
- **30-min quick start:** [docs/QUICK_START_DEPLOY.md](../docs/QUICK_START_DEPLOY.md)
- **Architecture decisions:** [docs/adr/](../docs/adr/)
- **Project brief:** [WORKIVED_PROJECT_BRIEF.md](../WORKIVED_PROJECT_BRIEF.md)

---

## 🤝 Support

Questions about deployment?

1. Check the [full deployment guide](../docs/DEPLOYMENT.md)
2. Review [common issues](../docs/QUICK_START_DEPLOY.md#common-issues--solutions)
3. Check system health: `make prod-health`
4. Review logs: `make prod-logs`

---

## 📝 License

This infrastructure configuration is part of Workived and follows the same license.
