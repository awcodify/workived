# Leave Balance Rollover Job

Year-end leave balance rollover tool for Workived. Automatically creates new balances for the upcoming year with entitlements and carry-over from the previous year.

## Overview

This job performs the following for each organization:
1. Gets all active employees
2. Gets all active leave policies
3. For each employee × policy combination:
   - Retrieves the previous year's balance
   - Calculates carry-over (min of unused days and policy maximum)
   - Creates a new balance for the target year

The operation is **idempotent** — running it multiple times will not create duplicate balances.

## Usage

### Build

```bash
cd services
go build -o rollover ./cmd/rollover
```

### Run

```bash
# Default: Roll over from last year to this year
./rollover

# Specify years
./rollover -from 2025 -to 2026

# Dry run (simulate without making changes)
./rollover -dry-run
```

### Flags

- `-from <year>` — Year to roll over from (default: current year - 1)
- `-to <year>` — Year to roll over to (default: current year)
- `-dry-run` — Simulate rollover without making database changes

## Scheduling

### Cron (Linux/macOS)

Add to crontab to run on Jan 1st at 1:00 AM:

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths):
0 1 1 1 * /path/to/workived/services/rollover -from 2025 -to 2026 >> /var/log/workived-rollover.log 2>&1
```

### Systemd Timer (Linux)

Create `/etc/systemd/system/workived-rollover.service`:

```ini
[Unit]
Description=Workived Leave Balance Rollover
After=network.target

[Service]
Type=oneshot
User=workived
WorkingDirectory=/opt/workived/services
Environment="DATABASE_URL=postgresql://..."
ExecStart=/opt/workived/services/rollover
StandardOutput=journal
StandardError=journal
```

Create `/etc/systemd/system/workived-rollover.timer`:

```ini
[Unit]
Description=Run Workived rollover on Jan 1st

[Timer]
OnCalendar=01-01 01:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable workived-rollover.timer
sudo systemctl start workived-rollover.timer

# Check status
sudo systemctl status workived-rollover.timer
```

### Docker/K8s CronJob

```yaml
apiVersion: batch/v1
kind=CronJob
metadata:
  name: workived-rollover
spec:
  schedule: "0 1 1 1 *"  # Jan 1st at 1:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: rollover
            image: workived/api:latest
            command: ["/app/rollover"]
            args: ["-from", "2025", "-to", "2026"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: workived-secrets
                  key: database-url
          restartPolicy: OnFailure
```

## Output

The rollover tool prints a summary:

```
============================================================
ROLLOVER SUMMARY
============================================================
Organisations processed: 15
Employees processed:     247
Policies processed:      45
Balances created:        741
Balances skipped:        0
Errors encountered:      0
============================================================
```

Any errors encountered during rollover are logged with details about which org/employee/policy failed.

## Environment Variables

Same as the main API server:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string (not used by rollover)

## Testing

Run without database changes:

```bash
./rollover -dry-run
```

## Notes

- **Idempotent:** Safe to run multiple times
- **Inactive policies:** Skipped automatically
- **New employees:** Start with 0 carry-over
- **No previous balance:** Start fresh with policy entitlement
- **Carry-over cap:** Respects `carry_over_days` limit from policy

## Troubleshooting

**Q: Rollover creates duplicate balances?**  
A: This shouldn't happen due to the `ON CONFLICT DO NOTHING` clause. Check database unique constraint on `(employee_id, leave_policy_id, year)`.

**Q: Some employees missing balances?**  
A: Only active employees (`is_active = TRUE`) are processed. Check employee status.

**Q: Wrong carry-over amounts?**  
A: Verify the `carry_over_days` setting in the leave policy.

**Q: Can I rollover multiple years at once?**  
A: No. Roll over one year at a time: `./rollover -from 2024 -to 2025 && ./rollover -from 2025 -to 2026`

## Manual Execution

If automated scheduling fails, run manually on Jan 1st:

```bash
cd /opt/workived/services
./rollover -from $(date -d 'last year' +%Y) -to $(date +%Y)
```
