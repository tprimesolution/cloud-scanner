# Phase 1: Architecture & Design

This folder contains the Phase 1 deliverables for the **Unified Security Scanning Platform**.

## Documents

| Document | Description |
|----------|-------------|
| [01-ARCHITECTURE-DIAGRAM.md](./01-ARCHITECTURE-DIAGRAM.md) | High-level architecture, component interaction, deployment topology |
| [02-MODULE-STRUCTURE.md](./02-MODULE-STRUCTURE.md) | NestJS modular monolith structure, directory tree, module contracts |
| [03-DATA-FLOW-DESIGN.md](./03-DATA-FLOW-DESIGN.md) | End-to-end data flow, batching, deduplication, performance rules |

## Implementation Phases

| Phase | Scope |
|-------|-------|
| **Phase 1** | Architecture diagram, module structure, data flow design ✅ |
| **Phase 2** | Resource collection framework (AWS fetchers) |
| **Phase 3** | Rule plugin engine |
| **Phase 4** | Scan orchestration system |
| **Phase 5** | Findings storage & compliance mapping |

## Quick Reference

- **Architecture**: Modular monolith, NestJS, PostgreSQL
- **Target**: AWS Marketplace AMI, self-hosted VM
- **Performance**: <500MB RAM, boot <10s
- **Cloud**: AWS SDK v3, pagination, minimal API calls
