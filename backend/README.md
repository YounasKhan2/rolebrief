# RoleBrief Backend

NestJS modular monolith scaffold for the RoleBrief API, worker, and scheduler processes.

## Local Services

From the repository root:

```bash
docker compose up postgres redis
```

Run migrations:

```bash
cd backend
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm migrate:dev
pnpm dev:api
```

The API uses `/api/v1` as its global prefix.
Swagger is available at `/api/docs` and documents the cookie-auth, CSRF, verification, reset, session, jobs, and admin endpoints.

## Authentication

RoleBrief uses backend-enforced email/password authentication with Argon2id hashes, USER/ADMIN roles, opaque HttpOnly cookies, rotating refresh sessions, CSRF headers for state-changing authenticated requests, and Redis-backed abuse limits.

Public signup never accepts a role. To create an administrator, run the explicit bootstrap job with untracked local environment values:

```bash
BOOTSTRAP_ADMIN_ENABLED=true pnpm bootstrap:admin
```

Keep `BOOTSTRAP_ADMIN_PASSWORD` only in an untracked local or deployment secret store. Re-running bootstrap is idempotent for an existing admin and will not reset the password.

Auth endpoints live under `/api/v1/auth`; admin user-management endpoints live under `/api/v1/admin` and require the ADMIN role. Frontend and API origins must be listed exactly in `FRONTEND_ORIGIN`; CORS uses credentials and does not allow wildcard origins.

## Email with Resend

Create a Resend account, generate an API key, and verify the sending domain in Resend. Set these values in the untracked `backend/.env` file:

```bash
EMAIL_PROVIDER=resend
EMAIL_DELIVERY_ENABLED=true
RESEND_FROM_EMAIL=RoleBrief <no-reply@your-verified-domain.com>
RESEND_REPLY_TO=support@your-verified-domain.com
RESEND_API_KEY=<resend-api-key>
FRONTEND_ORIGIN=https://app.your-domain.com
```

Restart the API and worker after changing environment variables. Signup verification, resend verification, password reset, and password-change notifications are queued through BullMQ and delivered by the worker. Delivery records store status and provider message IDs, but never plaintext verification/reset tokens or full email bodies.

Keep `EMAIL_PROVIDER=dev` for automated tests and local development. Development links are hidden by default; set `EMAIL_EXPOSE_DEV_LINKS=true` only in a local development environment when you explicitly need to inspect a test link.

For initial Resend testing, `onboarding@resend.dev` can only deliver to the email address associated with your Resend account. Production recipients require a verified sending domain.

When running with Docker Compose, backend services load `.env.example` first and the untracked `backend/.env` second. Keep safe defaults in `.env.example`; put real Resend keys, sender addresses, and local frontend origin ordering in `backend/.env`.

Operational rollback note: the auth migration is forward-only. It adds durable auth tables and converts placeholder `User.role`/`User.status` strings into enums without changing jobs/provider records. Existing legacy users should be verified/reset or removed intentionally before production use.

## Process Entrypoints

- API: `pnpm start:api`
- Worker: `pnpm start:worker`
- Scheduler: `pnpm start:scheduler`
- Migrations: `pnpm migrate:deploy`

API, worker, and scheduler share the same immutable Docker image and select behavior by command.

## Health

- `GET /api/v1/health/live` checks process liveness only.
- `GET /api/v1/health/ready` checks required local dependencies.
