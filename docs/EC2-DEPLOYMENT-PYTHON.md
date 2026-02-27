# EC2 Deployment - Python Compliance Scanner

Single-account AWS compliance scanner. Uses **EC2 IAM role only** - no access keys.

## Architecture

- **Phase 1 (Collection)**: Collect EC2, S3, IAM, Security Groups, RDS, VPC via boto3
- **Phase 2 (Scan)**: Evaluate collected data against YAML rules
- **Background**: Celery (collection every 6h, scan every 1h)

## Prerequisites

1. **EC2 instance** with Amazon Linux 2023
2. **IAM role** attached to EC2 with read-only permissions:
   - EC2 (describe*)
   - S3 (list buckets, get bucket config)
   - IAM (list roles, list policies)
   - RDS (describe*)
   - CloudTrail (optional)

## Deploy

```bash
# From project root
cd deploy
docker compose -f docker-compose.python.yml up -d --build
```

Access: `http://<ec2-ip>:80`

## IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucket*",
        "iam:ListRoles",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:ListPolicies",
        "rds:Describe*"
      ],
      "Resource": "*"
    }
  ]
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scanner/scan | Trigger full scan |
| GET | /api/scanner/status | Scanner status |
| GET | /api/scanner/findings | List findings |
| GET | /api/dashboard/metrics | Dashboard metrics |
| GET | /api/assets | List resources |

## Trigger Scan Manually

```bash
curl -X POST http://localhost:8000/api/scanner/scan
```
