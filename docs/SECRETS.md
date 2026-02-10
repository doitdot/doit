# Secrets Management Strategy

## Overview
This document outlines how secrets (API keys, database credentials, certificates) are managed in the DoIt project to ensure security and compliance.

## Environment Variables
- **Local Development**: Secrets are stored in `.env.local` or `.env` files. These files are **gitignored** and must never be committed to the repository.
- **Production/Staging**: Secrets are injected via the container orchestration platform (e.g., Docker Swarm, Kubernetes) or CI/CD pipelines (GitHub Actions Secrets).

## Validated Configuration
The API Service uses a strict schema validation (Zod) for environment variables. If a required secret is missing or invalid, the service will fail to start.
See `apps/api/src/config/env.schema.ts` for the definition.

## Mobile Secrets
- Public configuration (like API URLs) is handled via `app.config.ts`.
- Sensitive secrets should **NOT** be bundled with the mobile app if possible. If unavoidable, use `expo-secure-store` at runtime or build-time environment variables in EAS Build.

## Rules
1. **Never commit .env files.**
2. **Rotate keys** immediately if a leak is suspected.
3. **Use separate keys** for Development, Staging, and Production.
