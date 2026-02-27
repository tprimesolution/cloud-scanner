-- 41 Prowler compliance frameworks + 17 categories
-- Extends framework_mappings and adds categories

-- Add category column to compliance_rules
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS category VARCHAR(64);

-- Categories table (Prowler AWS 17 categories)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    category_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (category_id, name, description) VALUES
    ('aws-general', 'General', 'General AWS security checks'),
    ('aws-iam', 'IAM', 'Identity and Access Management'),
    ('aws-logging', 'Logging', 'Logging and monitoring'),
    ('aws-networking', 'Networking', 'VPC, security groups, network ACLs'),
    ('aws-s3', 'S3', 'S3 bucket security'),
    ('aws-rds', 'RDS', 'Relational Database Service'),
    ('aws-ec2', 'EC2', 'EC2 instances and volumes'),
    ('aws-lambda', 'Lambda', 'Serverless functions'),
    ('aws-kms', 'KMS', 'Key Management Service'),
    ('aws-secrets', 'Secrets', 'Secrets Manager'),
    ('aws-cloudtrail', 'CloudTrail', 'Audit logging'),
    ('aws-config', 'Config', 'AWS Config'),
    ('aws-elb', 'Load Balancers', 'ELB and ALB'),
    ('aws-backup', 'Backup', 'Backup and recovery'),
    ('aws-encryption', 'Encryption', 'Data encryption'),
    ('aws-public', 'Public Exposure', 'Publicly accessible resources'),
    ('aws-monitoring', 'Monitoring', 'CloudWatch and monitoring')
ON CONFLICT (category_id) DO NOTHING;

-- Expand framework_mappings to 41 Prowler frameworks (002 already has cis, soc2, iso27001, pci)
INSERT INTO framework_mappings (framework_id, name, description) VALUES
    ('cis_2.0_aws', 'CIS AWS 2.0', 'CIS AWS Foundations Benchmark 2.0'),
    ('cis_4.0_aws', 'CIS AWS 4.0', 'CIS AWS Foundations Benchmark 4.0'),
    ('aws_foundational_security_best_practices', 'AWS Foundational Security Best Practices', 'AWS security best practices'),
    ('aws_well_architected_framework_security_pillar', 'AWS Well-Architected Security', 'Well-Architected Framework security pillar'),
    ('nist_800_53_rev_5_aws', 'NIST 800-53 Rev 5', 'NIST SP 800-53 Rev. 5'),
    ('nist_csf_1.2_aws', 'NIST CSF 1.2', 'NIST Cybersecurity Framework'),
    ('pci_dss_4.0_aws', 'PCI-DSS 4.0', 'Payment Card Industry Data Security Standard'),
    ('hipaa_aws', 'HIPAA', 'Health Insurance Portability and Accountability Act'),
    ('gdpr_aws', 'GDPR', 'General Data Protection Regulation'),
    ('soc2_aws', 'SOC 2', 'Service Organization Control 2'),
    ('iso27001_2013_aws', 'ISO 27001', 'Information security management'),
    ('fedramp_moderate_aws', 'FedRAMP Moderate', 'Federal Risk and Authorization Management Program'),
    ('cisa_aws', 'CISA', 'Cybersecurity and Infrastructure Security Agency'),
    ('ens_rd2022_aws', 'ENS RD2022', 'Spanish National Security Scheme'),
    ('ffiec_aws', 'FFIEC', 'Federal Financial Institutions Examination Council'),
    ('rbi_cyber_security_framework', 'RBI CSF', 'Reserve Bank of India Cyber Security Framework'),
    ('gxp_21_cfr_part_11_aws', 'GxP 21 CFR Part 11', 'FDA electronic records'),
    ('gxp_eu_annex_11_aws', 'GxP EU Annex 11', 'EU GMP Annex 11'),
    ('mitre_attack_aws', 'MITRE ATT&CK', 'MITRE ATT&CK framework'),
    ('aws_audit_manager_control_tower', 'AWS Audit Manager', 'AWS Audit Manager controls'),
    ('exemptions_aws', 'Exemptions', 'Exemption management'),
    ('opensearch_service_aws', 'OpenSearch', 'OpenSearch Service'),
    ('well_architected_security_pillar_aws', 'Well-Architected Security', 'Security pillar'),
    ('cis_kubernetes_benchmark_aws', 'CIS EKS', 'CIS Kubernetes Benchmark for EKS'),
    ('kisa_isms_p_aws', 'KISA ISMS-P', 'Korean Information Security Management'),
    ('nist_privacy_framework_aws', 'NIST Privacy', 'NIST Privacy Framework'),
    ('gxp_21_cfr_part_11', 'GxP 21 CFR Part 11', 'FDA 21 CFR Part 11'),
    ('gxp_eu_annex_11', 'GxP EU Annex 11', 'EU GMP Annex 11'),
    ('cis_2.0_gcp', 'CIS GCP 2.0', 'CIS Google Cloud Benchmark'),
    ('cis_2.0_azure', 'CIS Azure 2.0', 'CIS Microsoft Azure Benchmark'),
    ('nist_800_53_rev_5_azure', 'NIST 800-53 Azure', 'NIST for Azure'),
    ('pci_dss_4.0_azure', 'PCI-DSS Azure', 'PCI-DSS for Azure'),
    ('hipaa_azure', 'HIPAA Azure', 'HIPAA for Azure'),
    ('soc2_azure', 'SOC 2 Azure', 'SOC 2 for Azure'),
    ('iso27001_2013_azure', 'ISO 27001 Azure', 'ISO 27001 for Azure'),
    ('cis_2.0_kubernetes', 'CIS Kubernetes', 'CIS Kubernetes Benchmark'),
    ('nist_800_190', 'NIST 800-190', 'NIST Container Security'),
    ('nis2_aws', 'NIS2', 'EU Network and Information Security'),
    ('bsi_c5_aws', 'BSI C5', 'German Cloud Computing Compliance')
ON CONFLICT (framework_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_compliance_rules_category ON compliance_rules(category);
