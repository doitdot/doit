## Goals and constraints

- iOS + Android mobile app where users post **photo check-ins** for a routine.
- Friends act as **judges**: “did it / didn’t do it”; for misses the user can play a **Joker** with an explanation; friends **accept** or **guilty** it.
- Backend must handle: authentication, friend graph, routines, check-ins, votes/judgments, private messaging, notifications, photo uploads + retention.
- Optimize for **availability** while keeping **costs low** (especially media + database).
- Must be **locally runnable** and **replicable** for development.

---

## Recommended stack (pragmatic and cost-aware)

### Mobile app

- **React Native + TypeScript**
  - One codebase for iOS/Android, good iteration speed, strong ecosystem.
  - TypeScript shared with backend for DTOs/types and validation schemas.

- State/data: React Query (or Apollo if GraphQL), local cache via SQLite (optional).
- Media: on-device image resize/compress before upload, background upload, retry queue.

### Backend

- **TypeScript (Node.js) + NestJS** (modular monolith to start)
  - Clear module boundaries (auth, routines, messaging, notifications) without microservice overhead.
  - Easy to containerize and run locally.

- ORM: Prisma
- API: REST for most endpoints + WebSocket for realtime (messaging, live feed updates)

### Data/storage

- Primary DB: **PostgreSQL**
- Cache/queue: **Redis**
- Media storage: S3-compatible object storage
  - Prod: Amazon Web Services S3
  - Dev: MinIO (S3-compatible) in Docker

### Hosting (production)

- Containers: ECS Fargate
- DB: RDS Postgres
- Redis: ElastiCache Redis
- CDN: CloudFront (optional early; add when traffic grows)
- Notifications: APNs + FCM
  - Apple APNs for iOS, Google FCM for Android

### Authentication (recommended approach)

- Use a managed identity provider for security + reduced ops:
  - Prod: Amazon Cognito (OIDC/JWT)
  - Local/dev: Keycloak container (OIDC/JWT)

- Backend is still the source of truth for app data and authorization; the IdP only issues/validates identity tokens.

---

## High-level architecture

```
[iOS/Android App]
   | HTTPS (REST) + WebSocket
   v
[API/BFF (NestJS)]
   - Auth (OIDC verification)
   - Users/Friends
   - Routines
   - Check-ins + Judgments + Joker
   - Messaging
   - Notifications
   - Admin/Moderation hooks
   |
   +--> [PostgreSQL] (source of truth)
   +--> [Redis] (cache, rate limit, websocket pubsub, job queues)
   +--> [S3 Object Storage] (photos, thumbnails)
   +--> [Worker(s)] (image processing, fanout, reminders)
   +--> [Push Providers] (APNs/FCM)
```

---

## Core domain model

### Key entities

- **User**
  - id, handle, profile, time zone, created_at

- **Device**
  - user_id, platform, push_token, last_seen

- **Friendship**
  - requester_id, addressee_id, status (pending/accepted/blocked), created_at

- **Routine**
  - id, owner_id, title, schedule (days/time window), visibility (friends), rules

- **CheckIn**
  - id, routine_id, user_id, day_key (e.g., YYYY-MM-DD), status (pending/judged/expired)
  - media_id, created_at, judging_deadline

- **Judgment/Vote**
  - id, checkin_id, judge_user_id, verdict (did_it / didnt_do_it / accept_joker / guilty_joker), created_at

- **Joker**
  - id, checkin_id, user_text, created_at, status (pending/accepted/guilty)

- **Conversation**
  - id, type (dm/group), created_at

- **Message**
  - id, conversation_id, sender_id, body, created_at, read_receipts (optional)

- **Media**
  - id, owner_id, object_key_original, object_key_thumb, mime, size, checksum, created_at, expires_at

### Judgment rules (store as configurable policy)

Examples:

- A check-in becomes “final” after:
  - at least N friend judgments, or
  - deadline reached → compute outcome from votes, or
  - owner self-claims “done” but still requires friend confirmation.

- Joker:
  - allowed X times per week/month
  - accepted if ≥ N accepts and accepts > guilty by deadline

Keep the computation deterministic and persisted:

- Store all votes; also store a computed **final_verdict** on CheckIn for fast feeds.

---

## API design

### Transport

- **REST** for standard CRUD + feed.
- **WebSocket** for:
  - new messages
  - new friend check-ins in your feed
  - judgment updates (vote tallies, final verdict)

### Typical endpoints (REST)

- Auth:
  - `POST /auth/session` (optional if you exchange IdP token for app session claims)

- Friends:
  - `POST /friends/request`
  - `POST /friends/accept`
  - `GET /friends`

- Routines:
  - `POST /routines`
  - `PATCH /routines/:id`
  - `GET /routines`

- Check-ins:
  - `POST /checkins/init` → returns presigned upload URL + media_id
  - `POST /checkins/confirm` → creates check-in referencing media_id
  - `GET /feed` → paginated friend check-ins + your own

- Judging:
  - `POST /checkins/:id/judgments`
  - `POST /checkins/:id/joker` (create or update joker explanation)

- Messaging:
  - `POST /conversations`
  - `GET /conversations`
  - `POST /messages`
  - `GET /messages?conversation_id=...`

### Pagination/feed

- Cursor-based pagination for `GET /feed` (stable for infinite scroll)
- Materialize minimal “feed rows” (denormalized view/table) if feed queries get expensive.

---

## Media upload and retention (cost-critical)

### Direct-to-object-storage uploads (saves bandwidth + compute)

1. App calls `POST /checkins/init` with metadata (mime, size, checksum).
2. Backend returns:
   - `media_id`
   - **presigned PUT URL** for the original object (S3 key like `users/{id}/orig/{media_id}.jpg`)

3. App uploads directly to S3.
4. App calls `POST /checkins/confirm` with `media_id`, routine_id, day_key.
5. Backend enqueues a job:
   - verify object exists + size limits
   - generate thumbnail(s)
   - set `expires_at`

### Thumbnails strategy

- Generate thumbnails in worker (consistent sizing, fast feed).
- Optionally also do on-device thumbnail generation to reduce server CPU early-stage.

### Retention strategy (simple and effective)

- Separate objects:
  - `orig/` and `thumb/`

- Lifecycle policy:
  - thumbnails expire sooner (e.g., 30 days)
  - originals expire later (e.g., 90 days) or same window depending on product needs

- Database stores `expires_at`; nightly worker validates and/or relies on S3 lifecycle deletion.

This is the biggest lever for cost control.

---

## Messaging architecture (private messaging)

- Store messages in Postgres (works well until very large scale).
- WebSocket gateway for realtime delivery.
- If you have multiple API instances:
  - use Redis Pub/Sub to broadcast “new message” events across instances.

Optional later:

- Move hot conversations to a dedicated store or partition messages by conversation_id for scale.

---

## Notifications

### Types

- Routine reminders (“time window closing”)
- Friend check-in posted (optional; likely rate-limited)
- Your check-in judged / joker accepted/guilty
- New message

### Implementation

- A Notifications module:
  - decides when to send push vs in-app
  - writes a Notification record (for in-app inbox)
  - sends push via APNs/FCM

- Rate-limit noisy events (e.g., “friend posted”) to avoid push spam and cost.

---

## Availability and scaling

### Stateless API

- Run 2+ API containers behind a load balancer.
- Health checks + rolling deploys.
- WebSockets: either sticky sessions or a dedicated WS gateway; Redis Pub/Sub handles fanout.

### Database

- Start with a single Postgres instance (cost).
- Add Multi-AZ when you need HA.
- Use read replicas only when reads dominate and you’re sure you need them.

### Redis

- Start single instance.
- Use it for:
  - rate limiting
  - job queue
  - websocket pubsub
  - short-lived cache (e.g., feed precomputations)

### Workers

- Separate worker deployment (same codebase) for:
  - image processing
  - scheduled reminders
  - cleanup/expiry verification
  - notification fanout

- Scale workers independently of API.

---

## Security and privacy

- All traffic over TLS.
- Verify OIDC JWTs on every request (audience, issuer, expiry).
- Authorization rules:
  - media objects are private; served via presigned GET URLs (short TTL) or via API proxy.
  - only friends can view/judge a friend’s check-ins (and only within retention).

- Abuse prevention:
  - upload limits (size/type), rate limiting, device fingerprinting
  - optional content scanning later (depending on your requirements)

- Data protection:
  - encrypt at rest (managed services typically handle)
  - structured logging without sensitive payloads

- Account deletion:
  - hard-delete PII + revoke tokens + delete objects; keep minimal audit if required.

---

## Local development environment (replicable)

Use Docker Compose with:

- `api` (NestJS)
- `worker` (same image, different command)
- `postgres`
- `redis`
- `minio` (S3-compatible)
- `keycloak` (OIDC provider) + seeded realm
- `mailhog` (email testing)

Developer experience:

- One `docker compose up` starts everything.
- Seed script:
  - creates demo users, friendships, routines
  - sets up Keycloak realm + clients
  - configures MinIO buckets + lifecycle rules (if supported locally)

---

## Deployment and CI/CD

### Environments

- `dev` (shared)
- `staging`
- `prod`

### Infrastructure as Code

- Terraform to provision:
  - networking, load balancer
  - ECS services + task definitions
  - RDS + secrets
  - S3 buckets + lifecycle policies
  - Redis

- Secrets: store in AWS Secrets Manager/Parameter Store; inject at runtime.

### CI/CD pipeline

- Lint/test → build Docker image → run migrations → deploy API + worker
- Database migrations:
  - run once per deploy (job) with locks to avoid concurrent migration runs

### Observability

- Structured logs (JSON) with request IDs
- Metrics: latency, error rate, queue depth, upload failures
- Tracing (OpenTelemetry)

---

## Cost control checklist (practical levers)

- **Direct-to-S3 uploads** (avoid routing photos through API servers).
- **Aggressive media retention** via lifecycle policies.
- **Store thumbnails, not multiple sizes**, until you need them.
- **Avoid premature microservices**; keep one API + workers.
- **Use Redis sparingly** (cache only what’s expensive).
- **Backpressure on fanout** (notifications, feed updates).
- Keep DB lean:
  - proper indexes on `feed` queries (friend_id, created_at)
  - store computed `final_verdict` to avoid heavy aggregations on every feed load
