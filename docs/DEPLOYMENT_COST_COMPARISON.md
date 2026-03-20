# Workived Deployment Cost Comparison

Detailed cost analysis of different deployment strategies for Workived.

**Context:** Freemium SaaS, free tier up to 25 employees, target market has high price sensitivity

---

## Summary: Recommended vs Alternatives

| Strategy | Monthly Cost | Setup Time | Ops Burden | Scale Ceiling | Best For |
|----------|--------------|------------|------------|---------------|----------|
| **Single VPS + Managed DB** ⭐ | **$7-14** | 30 min | Low | 500 orgs | Launch → 2k orgs |
| PaaS (Render/Railway) | $24-40 | 10 min | Minimal | 1k orgs | Rapid prototyping |
| AWS ECS Fargate | $80-120 | 4 hours | Medium | 10k+ orgs | Series A+ |
| Kubernetes (GKE/EKS) | $150-250 | 2 days | High | 100k+ orgs | Enterprise scale |
| Serverless (Lambda) | $30-60 | 3 hours | Medium | Variable | Spiky traffic |

**Winner for launch:** Single VPS + Managed DB — 3x cheaper with known scale ceiling.

---

## Option 1: Single VPS + Managed DB ⭐ **RECOMMENDED**

### Architecture
- 1× VPS (Hetzner/Vultr/DigitalOcean)
- Supabase PostgreSQL (free → $25/month)
- Cloudflare R2 for storage
- Amazon SES for email

### Cost Breakdown

#### Phase 1: Launch → 500 orgs (~2,500 users)

| Component | Provider | Spec | $/month |
|-----------|----------|------|---------|
| VPS | Hetzner CX21 | 2 vCPU, 4GB RAM, 40GB SSD | $5.00 |
| Database | Supabase Free | 500MB, daily backup | $0.00 |
| Storage | Cloudflare R2 | 10GB (1MB avg per user) | $1.50 |
| Email | Amazon SES | 10k emails/month | $1.00 |
| CDN/DNS | Cloudflare | Global CDN, DDoS | $0.00 |
| SSL | Let's Encrypt | Auto-renewal | $0.00 |
| **Total** | | | **$7.50** |

**Profit margin on free tier:** ~$40-50/month from paid users needed to break even

#### Phase 2: 500 → 2,000 orgs (~10,000 users)

| Component | Provider | Spec | $/month |
|-----------|----------|------|---------|
| VPS | Vultr HF | 1 vCPU, 2GB RAM, 55GB SSD | $12.00 |
| Database | Supabase Pro | 8GB, PITR backup | $25.00 |
| Storage | Cloudflare R2 | 25GB | $3.75 |
| Email | Amazon SES | 50k emails/month | $5.00 |
| CDN/DNS | Cloudflare | Global CDN | $0.00 |
| **Total** | | | **$45.75** |

#### Phase 3: 2,000 → 10,000 orgs (~50,000 users)

| Component | Provider | Spec | $/month |
|-----------|----------|------|---------|
| VPS (2×) | Vultr HF | 4 vCPU, 8GB RAM each | $80.00 |
| Database | Supabase Team | 64GB, replicas | $599.00 |
| Storage | Cloudflare R2 | 100GB | $15.00 |
| Email | Amazon SES | 200k emails/month | $20.00 |
| Redis | Redis Cloud | 256MB managed | $10.00 |
| CDN | Cloudflare Pro | Better caching | $20.00 |
| Monitoring | Sentry Team | Error tracking | $26.00 |
| **Total** | | | **$770.00** |

**Re-architecture trigger:** At 10k orgs, move to Kubernetes or AWS ECS

### Pros
✅ Extremely low cost for launch  
✅ Simple operations (Docker Compose)  
✅ Known scale ceiling (plan ahead)  
✅ Fast deployment (30 minutes)  
✅ Easy to debug  

### Cons
❌ Single point of failure (VPS)  
❌ Manual scaling required  
❌ Not "cloud native"  
❌ Vertical scaling limits  

### When to Use
- MVP/launch phase
- Pre-PMF (product-market fit)
- First 2,000 customers
- Bootstrapped/funding conscious

---

## Option 2: PaaS (Render/Railway)

### Architecture
- Render Web Service (Go API)
- Render Static Site (React SPA)
- Render PostgreSQL
- Render Redis
- Cloudflare R2 for storage

### Cost Breakdown (500 orgs)

| Component | Provider | Spec | $/month |
|-----------|----------|------|---------|
| Web Service (API) | Render | 512MB RAM | $7.00 |
| Static Site | Render | CDN included | $0.00 |
| PostgreSQL | Render | 256MB | $7.00 |
| Redis | Render | 25MB | $10.00 |
| Storage | Cloudflare R2 | 10GB | $1.50 |
| Email | Amazon SES | 10k emails | $1.00 |
| **Total** | | | **$26.50** |

### At 2,000 orgs:

| Component | Provider | Spec | $/month |
|-----------|----------|------|---------|
| Web Service (API) | Render | 2GB RAM | $25.00 |
| Static Site | Render | CDN | $0.00 |
| PostgreSQL | Render | 4GB | $40.00 |
| Redis | Render | 100MB | $20.00 |
| Storage | Cloudflare R2 | 25GB | $3.75 |
| Email | Amazon SES | 50k emails | $5.00 |
| **Total** | | | **$93.75** |

### Pros
✅ Zero ops (fully managed)  
✅ Auto-scaling  
✅ Built-in monitoring  
✅ CI/CD included  
✅ Fast setup (10 minutes)  

### Cons
❌ 3-4× more expensive than VPS  
❌ Vendor lock-in  
❌ Less control  
❌ Cost increases faster  

### When to Use
- Well-funded startup (raised seed)
- Want zero ops burden
- Willing to pay for convenience
- Team has no DevOps experience

---

## Option 3: AWS ECS Fargate

### Architecture
- ECS Fargate tasks (Go API)
- CloudFront + S3 (React SPA)
- RDS PostgreSQL
- ElastiCache Redis
- S3 for storage
- SES for email

### Cost Breakdown (500 orgs)

| Component | Spec | $/month |
|-----------|------|---------|
| ECS Fargate (2 tasks × 0.25 vCPU, 512MB) | | $35.00 |
| RDS PostgreSQL (db.t4g.micro) | 2GB RAM | $16.00 |
| ElastiCache Redis (cache.t4g.micro) | 256MB | $12.00 |
| S3 (frontend) | 1GB + CloudFront | $2.00 |
| S3 (storage) | 10GB | $0.23 |
| Application Load Balancer | | $16.00 |
| NAT Gateway | | $32.00 |
| SES | 10k emails | $1.00 |
| **Total** | | **$114.23** |

### At 2,000 orgs:

| Component | Spec | $/month |
|-----------|------|---------|
| ECS Fargate (4 tasks × 0.5 vCPU, 1GB) | | $140.00 |
| RDS PostgreSQL (db.t4g.medium) | 4GB RAM | $60.00 |
| ElastiCache Redis (cache.t4g.small) | 1GB | $24.00 |
| S3 (frontend) | 2GB + CloudFront | $5.00 |
| S3 (storage) | 25GB | $0.58 |
| Application Load Balancer | | $16.00 |
| NAT Gateway | | $32.00 |
| SES | 50k emails | $5.00 |
| **Total** | | **$282.58** |

### Pros
✅ Auto-scaling  
✅ Multi-AZ availability  
✅ AWS ecosystem integration  
✅ Enterprise-ready  
✅ Good monitoring (CloudWatch)  

### Cons
❌ 15-20× more expensive than VPS  
❌ Complex setup (IAM, networking)  
❌ NAT Gateway costs add up  
❌ Steep learning curve  
❌ Overkill for small scale  

### When to Use
- Series A+ funded
- 10,000+ organizations
- Need multi-region HA
- Enterprise customers
- Compliance requirements (SOC2)

---

## Option 4: Kubernetes (GKE/EKS)

### Architecture
- GKE/EKS cluster (3 nodes minimum)
- Cloud SQL / RDS PostgreSQL
- Managed Redis
- Cloud Storage

### Cost Breakdown (500 orgs)

| Component | Spec | $/month |
|-----------|------|---------|
| GKE Cluster (3× e2-medium) | 2 vCPU, 4GB RAM each | $145.00 |
| Cloud SQL PostgreSQL | db-f1-micro | $25.00 |
| Memorystore Redis | 1GB | $30.00 |
| Cloud Storage | 10GB | $0.50 |
| Load Balancer | | $18.00 |
| Networking | egress | $10.00 |
| **Total** | | **$228.50** |

### At 2,000 orgs:

| Component | Spec | $/month |
|-----------|------|---------|
| GKE Cluster (4× e2-standard-4) | 4 vCPU, 16GB RAM each | $480.00 |
| Cloud SQL PostgreSQL | db-n1-standard-2 | $140.00 |
| Memorystore Redis | 5GB | $150.00 |
| Cloud Storage | 25GB | $1.25 |
| Load Balancer | | $18.00 |
| Networking | egress | $30.00 |
| **Total** | | **$819.25** |

### Pros
✅ Highly scalable  
✅ Container orchestration  
✅ Multi-cloud portability  
✅ GitOps workflows  
✅ Service mesh ready  

### Cons
❌ 30-40× more expensive than VPS  
❌ Extremely complex (steep learning curve)  
❌ Requires dedicated DevOps engineer  
❌ Overkill until 100k+ orgs  
❌ High minimum cost (cluster overhead)  

### When to Use
- Series B+ funded
- 50,000+ organizations
- Multi-region globally
- Dedicated platform team
- Already using Kubernetes

---

## Option 5: Serverless (AWS Lambda)

### Architecture
- Lambda (Go API)
- API Gateway
- RDS Proxy + Aurora Serverless
- S3 + CloudFront (React SPA)
- DynamoDB (sessions)

### Cost Breakdown (500 orgs)

**Assumptions:**
- 500 orgs × 25 users = 12,500 users
- 5 API calls per user per day = 62,500 calls/day
- ~1.9M requests/month

| Component | Spec | $/month |
|-----------|------|---------|
| Lambda | 1.9M requests × 500ms × 512MB | $18.00 |
| API Gateway | 1.9M requests | $6.50 |
| Aurora Serverless v2 | Min 0.5 ACU | $45.00 |
| RDS Proxy | | $12.00 |
| DynamoDB | 5GB + 1M reads | $1.50 |
| S3 + CloudFront | Frontend | $5.00 |
| S3 (storage) | 10GB | $0.23 |
| SES | 10k emails | $1.00 |
| **Total** | | **$89.23** |

### At 2,000 orgs (7.6M requests/month):

| Component | Spec | $/month |
|-----------|------|---------|
| Lambda | 7.6M requests × 500ms × 512MB | $72.00 |
| API Gateway | 7.6M requests | $26.00 |
| Aurora Serverless v2 | Min 1 ACU | $90.00 |
| RDS Proxy | | $12.00 |
| DynamoDB | 20GB + 4M reads | $6.00 |
| S3 + CloudFront | Frontend | $10.00 |
| S3 (storage) | 25GB | $0.58 |
| SES | 50k emails | $5.00 |
| **Total** | | **$221.58** |

### Pros
✅ True auto-scaling  
✅ Pay per request  
✅ No server management  
✅ Good for spiky traffic  
✅ Built-in HA  

### Cons
❌ 12-15× more expensive than VPS  
❌ Cold start latency  
❌ Complex debugging  
❌ Vendor lock-in (AWS)  
❌ Not ideal for steady traffic  

### When to Use
- Unpredictable/spiky traffic
- Event-driven workflows
- Already AWS-native
- Don't want to manage servers
- Cost predictability less important

---

## Cost Comparison Summary (First Year)

Assuming growth: 50 → 200 → 500 → 1,000 orgs

| Month | VPS | Render | AWS ECS | K8s | Serverless |
|-------|-----|--------|---------|-----|------------|
| 1-3 | $8 | $27 | $115 | $230 | $45 |
| 4-6 | $8 | $27 | $115 | $230 | $65 |
| 7-9 | $12 | $40 | $150 | $300 | $90 |
| 10-12 | $46 | $94 | $200 | $450 | $155 |
| **Year 1** | **$348** | **$564** | **$1,740** | **$3,660** | **$1,335** |

**Savings vs alternatives:**
- VPS saves **$216** vs Render (38% cheaper)
- VPS saves **$1,392** vs AWS ECS (80% cheaper)
- VPS saves **$3,312** vs Kubernetes (90% cheaper)
- VPS saves **$987** vs Serverless (74% cheaper)

---

## Decision Framework

### Choose VPS + Managed DB if:
✅ Bootstrapped or pre-seed  
✅ < 2,000 organizations  
✅ Price-sensitive market  
✅ Want fast iteration  
✅ Need cost predictability  

### Choose PaaS (Render/Railway) if:
✅ Raised seed round ($500k+)  
✅ No DevOps experience on team  
✅ Value time over money  
✅ Want zero ops burden  

### Choose AWS ECS/K8s if:
✅ Raised Series A+ ($3M+)  
✅ 10,000+ organizations  
✅ Enterprise customers  
✅ Need multi-region HA  
✅ Have dedicated platform team  

### Choose Serverless if:
✅ Unpredictable traffic patterns  
✅ Event-driven architecture  
✅ Already AWS-native  
✅ Don't mind vendor lock-in  

---

## Why We Recommend VPS for Workived

1. **Market constraints:**
   - Target: 5-25 person startups (price sensitive)
   - Free tier: Up to 25 employees
   - Need to be profitable on low conversion rates

2. **Scale requirements:**
   - Launch target: 500 orgs in 6 months
   - Year 1 target: 2,000 orgs
   - VPS handles this scale perfectly

3. **Team constraints:**
   - Small team (1-3 engineers)
   - Can't afford DevOps complexity
   - Docker Compose is sufficient

4. **Cost efficiency:**
   - $7-46/month vs $27-94/month (Render)
   - Saves $3,000+ in year 1
   - Can reinvest savings in marketing

5. **Exit strategy:**
   - Clear re-architecture trigger (2k-10k orgs)
   - By then, likely to have raised funding
   - Can hire DevOps engineer to migrate to ECS/K8s

---

## Conclusion

**For Workived's launch phase (0-2,000 orgs), Single VPS + Managed DB is the optimal choice.**

It's 3-15× cheaper than alternatives while maintaining:
- ✅ Simplicity (can be managed by 1 engineer)
- ✅ Reliability (Supabase handles backup/HA)
- ✅ Known scale ceiling (plan ahead)
- ✅ Fast iteration (Docker Compose is simple)

When you hit 2,000+ organizations and have funding, revisit infrastructure and likely migrate to AWS ECS or Kubernetes.

**First optimize for survival, then optimize for scale.**
