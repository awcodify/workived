# Report Data Seeding — Healthy Company Simulation

This directory contains SQL scripts to populate the database with realistic test data simulating a **healthy, high-performing company** with >85% task completion and attendance rates.

## Quick Start

### Option 1: Using Make (Recommended)
```bash
# First, ensure base data exists
make seed

# Then seed comprehensive report data
make seed-reports
```

### Option 2: Using the Shell Script
```bash
# Run the convenient shell script
./scripts/seed-reports.sh
```

### Option 3: Manual Docker Command
```bash
docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_report_data.sql
```

## What Gets Created

The `seed_report_data.sql` script creates comprehensive historical data for **ahmad@workived.com's organization** (Rizki Tech), simulating a **healthy company with one anomaly employee**.

### 🏢 Company Health Profile
- **Task Completion Rate**: **85%** (68/80 tasks completed) ✓
- **Attendance Rate**: **>90%** for 10 out of 11 employees ✓
- **Anomaly Employee**: Hans (Intern) with 65% attendance - realistic variance

### 📊 Attendance Records (~700 records)
- **Duration**: Last 90 days
- **Employees**: All 11 employees
- **Healthy Patterns** (10 employees): 
  - Attendance rates: 91-98%
  - Late rates: 3-12%
  - Consistent presence
- **Anomaly Pattern** (Hans - Intern):
  - Attendance rate: 65%
  - Late rate: 40% when present
  - Represents underperforming employee

### 🏖️ Leave Requests (25+ requests)
- **Duration**: Last 6 months + upcoming requests
- **Types**: Annual leave, sick leave, unpaid leave
- **Statuses**: Approved, pending, rejected
- **Distribution**: Spread across all employees with realistic reasons

### 💰 Claims (50+ claims)
- **Duration**: Last 3 months
- **Categories**: 
  - Transport
  - Meal Allowance
  - Medical
  - Internet
  - Phone
- **Statuses**: Approved, pending, rejected
- **Amounts**: Realistic amounts per category in IDR

### ✅ Tasks (80 tasks - High Completion Rate)
- **Lists**: To Do (7), In Progress (5), Done (68) 
- **Completed Breakdown**:
  - 12 tasks completed last 7 days (visible on task board)
  - 24 tasks completed this month (for monthly reports)
  - 32 tasks completed last quarter (for quarterly reports)
- **Completion Rate**: **85%** (68/80 tasks) ✓ HEALTHY
- **Report Logic**: Tasks filtered by `created_at` date - shows ALL tasks created in the report period
- **Board UI**: Auto-archives tasks with `completed_at` older than 7 days (reduces clutter)
- **Employee Distribution**: All 11 employees have tasks
- **Priorities**: Urgent, high, medium, low distributed realistically
- **Note**: Reports show all tasks regardless of auto-archive status

## Prerequisites

Before running the report seed script, ensure:

1. ✅ Docker is running
2. ✅ PostgreSQL container is up (`docker compose up -d`)
3. ✅ Migrations have been run (`make migrate-up`)
4. ✅ Base seed data exists (`make seed`)

## Data Overview

| Data Type | Count | Time Range | Metrics | Purpose |
|-----------|-------|------------|---------|---------|
| Attendance | ~700 | 90 days | 90%+ for 10/11 employees | April coverage, trends, anomaly detection |
| Leave Requests | 25+ | 6 months | Various types & statuses | Utilization, calendar, approvals |
| Claims | 50+ | 3 months | All categories | Expense analysis, category breakdown |
| Tasks | 80 (68 done) | 90 days | **85% completion** ✓ | Performance tracking, sprint reports |

## Simulation Goals

This seed data simulates a **healthy, productive company** to demonstrate:

✅ **High Task Completion** (85%) - Shows good execution and delivery  
✅ **Strong Attendance** (90%+) - Indicates engaged, committed workforce  
⚠️ **Realistic Variance** (1 anomaly) - Hans represents an underperformer for detection/management  

Use this data to validate:
- Performance dashboards show positive trends
- Anomaly detection identifies Hans as outlier
- Reports accurately calculate rates and percentages
- Filtering by time periods (this month, quarter, year) works correctly

## Login Credentials

```
Email: ahmad@workived.com
Password: 12345678
```

## Resetting Data

To clear and reseed everything:
```bash
# Full database reset (WARNING: destroys all data)
make reset-db

# Then seed reports again
make seed-reports
```

## Files

- `seed_report_data.sql` - Main SQL script with all data generation
- `seed-reports.sh` - Convenient shell script with validation
- `seed_test_data.sql` - Base test data (required first)

## Employee Details

| Name | Email | Role | Attendance Rate | Punctuality |
|------|-------|------|----------------|-------------|
| Ahmad Rizki | ahmad@workived.com | CEO | 95% | 90% on-time |
| New Employee | new@rizkitech.com | Engineer | 85% | 80% on-time |
| Sarah Johnson | sarah@rizkitech.com | HR Manager | 98% | 95% on-time |
| Michael Chen | michael@rizkitech.com | Finance Lead | 99% | 98% on-time |
| Lisa Anderson | lisa@rizkitech.com | Designer | 88% | 75% on-time |
| David Kumar | david@rizkitech.com | Eng Manager | 96% | 92% on-time |

## Notes

- All timestamps use the organization's timezone (Asia/Jakarta)
- Attendance excludes weekends automatically
- Claims respect category limits from claim_categories table
- Leave requests update leave balances automatically (if triggers exist)
- Tasks are distributed realistically across priority levels
- GPS coordinates vary slightly per employee to simulate real locations

## Troubleshooting

**Error: "Organization for ahmad@workived.com not found"**
- Solution: Run `make seed` first to create base test data

**Error: "Docker is not running"**
- Solution: Start Docker Desktop/Engine

**Error: "Container not found"**
- Solution: Run `docker compose up -d` to start infrastructure

**Data looks empty in reports**
- Check that you're logged in as ahmad@workived.com
- Verify the date range in your report filters
- Confirm seed script completed without errors
