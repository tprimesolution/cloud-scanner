# Unified Security Scanning Platform — Architecture Diagram

> **Deployment Target:** AWS Marketplace AMI | Self-hosted VM  
> **Architecture:** Modular Monolith (NestJS)  
> **Performance Targets:** <500MB RAM | Boot <10s

---

## High-Level System Architecture

```mermaid
flowchart TB
    subgraph EXTERNAL["External Inputs"]
        AWS[AWS APIs]
        CRON[Scheduler Triggers]
        API[On-Demand API]
    end

    subgraph PLATFORM["Security Scanning Platform"]
        direction TB

        subgraph ORCHESTRATOR["Scan Orchestrator"]
            SQ[Scan Queue]
            BP[Batch Processor]
            CC[Concurrency Controller]
        end

        subgraph COLLECTION["Resource Collection Layer"]
            S3F[S3 Fetcher]
            IAMF[IAM Fetcher]
            SGF[Security Group Fetcher]
            RDSF[RDS Fetcher]
            EBSF[EBS Fetcher]
            CTF[CloudTrail Fetcher]
        end

        subgraph RULES["Rule Plugin Engine"]
            RPL[Rule Plugin Loader]
            RE[Rule Evaluator]
            RF[Rule Filter]
            RS[Rule Suppression]
        end

        subgraph FINDINGS["Findings Engine"]
            FS[Findings Store]
            FD[Deduplicator]
            FL[Lifecycle Tracker]
        end

        subgraph COMPLIANCE["Compliance Mapping Engine"]
            CIS[CIS Benchmarks]
            SOC2[SOC2]
            HIPAA[HIPAA]
            ISO[ISO 27001]
            PCI[PCI DSS]
        end

        subgraph SCHEDULER["Continuous Monitoring Scheduler"]
            PS[Periodic Scans]
            IC[Incremental Checks]
            CD[Config Drift Detection]
        end
    end

    subgraph STORAGE["Storage"]
        DB[(PostgreSQL)]
    end

    AWS --> COLLECTION
    CRON --> SCHEDULER
    API --> ORCHESTRATOR

    SCHEDULER --> ORCHESTRATOR
    ORCHESTRATOR --> COLLECTION
    COLLECTION --> DB
    COLLECTION --> RULES
    RULES --> FINDINGS
    FINDINGS --> COMPLIANCE
    FINDINGS --> DB
    COMPLIANCE --> DB
```

---

## Component Interaction Flow

```mermaid
sequenceDiagram
    participant Sched as Scheduler
    participant Orch as Orchestrator
    participant Fetch as Resource Fetchers
    participant Rule as Rule Engine
    participant Find as Findings Engine
    participant DB as PostgreSQL

    Sched->>Orch: Trigger scan (full/incremental)
    Orch->>Orch: Acquire concurrency slot
    Orch->>Fetch: Collect resources (paginated)
    loop Per resource type
        Fetch->>DB: Store normalized resources
    end
    Orch->>Rule: Load rules (lazy, filtered)
    loop Per resource batch
        Rule->>Rule: Evaluate conditions
        Rule->>Find: Emit violations
    end
    Find->>Find: Deduplicate
    Find->>DB: Persist findings
    Orch->>Orch: Release slot
```

---

## Resource Collection Layer (Cloud Fetchers)

```mermaid
flowchart LR
    subgraph AWS_SDK["AWS SDK v3"]
        S3_CLIENT[S3 Client]
        IAM_CLIENT[IAM Client]
        EC2_CLIENT[EC2 Client]
        RDS_CLIENT[RDS Client]
        CT_CLIENT[CloudTrail Client]
    end

    subgraph FETCHERS["Fetchers"]
        S3[S3 Buckets]
        IAM[IAM Users & Policies]
        SG[Security Groups]
        RDS[RDS Instances]
        EBS[EBS Volumes]
        CT[CloudTrail Status]
    end

    subgraph NORMALIZER["Normalizer"]
        N[Normalized Resource Schema]
    end

    S3_CLIENT --> S3
    IAM_CLIENT --> IAM
    EC2_CLIENT --> SG
    EC2_CLIENT --> EBS
    RDS_CLIENT --> RDS
    CT_CLIENT --> CT

    S3 --> N
    IAM --> N
    SG --> N
    RDS --> N
    EBS --> N
    CT --> N
```

---

## Rule Plugin Engine Architecture

```mermaid
flowchart TB
    subgraph PLUGINS["Rule Plugins"]
        P1[Plugin: S3 Public Access]
        P2[Plugin: IAM MFA]
        P3[Plugin: SG 0.0.0.0/0]
        P4[Plugin: RDS Encryption]
        P5[Plugin: EBS Encryption]
        P6[Plugin: CloudTrail Enabled]
    end

    subgraph LOADER["Plugin Loader"]
        RL[Lazy Load]
        RF[Filter by type]
        RS[Apply suppression]
    end

    subgraph EVALUATOR["Evaluator"]
        E[Match resource type]
        C[Evaluate conditions]
        S[Assign severity]
        M[Map to controls]
    end

    subgraph OUTPUT["Output"]
        F[Finding]
        R[Remediation]
    end

    P1 & P2 & P3 & P4 & P5 & P6 --> LOADER
    LOADER --> EVALUATOR
    EVALUATOR --> OUTPUT
```

---

## Scan Orchestration Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Queued: Scan requested
    Queued --> AcquiringSlot: Process queue
    AcquiringSlot --> Collecting: Slot acquired
    Collecting --> Evaluating: Resources collected
    Evaluating --> Persisting: Rules evaluated
    Persisting --> Idle: Findings stored
    AcquiringSlot --> Queued: Slot limit reached
```

---

## Deployment Topology (VM / AMI)

```mermaid
flowchart TB
    subgraph VM["Single VM Instance"]
        subgraph APP["NestJS Process"]
            M1[App Module]
        end
        subgraph MEM["Memory Budget"]
            M2["< 500MB target"]
        end
    end

    subgraph DB_OPTION["Database Options"]
        EMBED[Embedded SQLite - Dev]
        PG[(PostgreSQL - Prod)]
    end

    subgraph AWS_ENV["AWS Environment"]
        EC2[EC2 Instance]
        IAM_ROLE[IAM Role - ReadOnly]
    end

    VM --> DB_OPTION
    APP --> EC2
    EC2 --> IAM_ROLE
```

---

## Performance Optimization Points

| Layer | Optimization |
|-------|--------------|
| **Fetchers** | Pagination, minimal fields, batch writes |
| **Rules** | Lazy load, filter by resource type, stream evaluation |
| **Orchestrator** | Concurrency limit, batch size control |
| **Findings** | Upsert dedup, indexed queries |
| **Scheduler** | Lightweight cron, no heavy job queue |
