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

## Process Entrypoints

- API: `pnpm start:api`
- Worker: `pnpm start:worker`
- Scheduler: `pnpm start:scheduler`
- Migrations: `pnpm migrate:deploy`

API, worker, and scheduler share the same immutable Docker image and select behavior by command.

## Health

- `GET /api/v1/health/live` checks process liveness only.
- `GET /api/v1/health/ready` checks required local dependencies.
