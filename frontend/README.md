# RoleBrief Frontend

## Local Development

### Prerequisites

- Node.js
- pnpm
- Docker Desktop

The frontend expects the backend API at `http://127.0.0.1:3000/api/v1`. This is configured in `.env.local`.

### 1. Start Postgres and Redis

From the repository root:

```powershell
docker compose up -d postgres redis
```

### 2. Install backend dependencies and configure environment

```powershell
cd backend
Copy-Item .env.example .env
pnpm install
```

Update `backend/.env` with your local database password and other local values. Keep secrets such as `RESEND_API_KEY` in `.env`, not `.env.example`.

### 3. Run Prisma

Run these commands from `backend`:

```powershell
pnpm prisma:generate
pnpm migrate:dev
```

Use the seed command when sample or initial data is needed:

```powershell
pnpm db:seed
```

For an existing database where migrations already exist, use:

```powershell
pnpm migrate:deploy
```

Prisma Studio is available with:

```powershell
pnpm exec prisma studio
```

### 4. Start the backend processes

Build the backend once before starting the compiled worker and scheduler:

```powershell
pnpm build
```

Use separate terminals. Run each command from `backend`:

```powershell
pnpm dev:api
```

```powershell
pnpm start:worker
```

```powershell
pnpm start:scheduler
```

`pnpm dev:api` is the only watch process in this workflow. The API, worker, and scheduler currently compile to the same `dist` directory; running all three `dev:*` commands together can make them delete and rebuild each other's output, causing errors such as `Cannot find module './app.module'`. Re-run `pnpm build` after backend source changes before restarting the worker or scheduler.

If you only need the API while developing the frontend, run `pnpm dev:api` and skip the worker and scheduler.

The API is available at `http://127.0.0.1:3000`. Useful endpoints are:

- `http://127.0.0.1:3000/api/v1/health/live`
- `http://127.0.0.1:3000/api/v1/health/ready`
- `http://127.0.0.1:3000/api/docs`

### 5. Start the frontend

Run from `frontend`:

```powershell
pnpm install
pnpm dev
```

Open the URL printed by Vite. The frontend normally runs at `http://127.0.0.1:5173`.

### Email in local development

To send verification emails through Resend, configure `backend/.env`:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=RoleBrief <onboarding@resend.dev>
RESEND_API_KEY=re_your_key
```

The `onboarding@resend.dev` sender can only deliver to the email address associated with the Resend account. To send to multiple testing users, verify a real sending domain in Resend and use that domain in `EMAIL_FROM`.

Restart the API after changing `.env` values. The backend must be running for signup, login, email verification, jobs, and other API-backed features.

### Run the backend entirely with Docker

The compose file can also build and run the API, worker, scheduler, migrations, and database services:

```powershell
docker compose up -d postgres redis api worker scheduler
```

Apply migrations with the tools profile:

```powershell
docker compose --profile tools run --rm migrate
```

Seed the database when needed:

```powershell
docker compose --profile tools run --rm seed
```

For Docker backend services, check the compose environment configuration before relying on local `.env` values. The current compose services load `backend/.env.example`; production or Resend secrets should be supplied through an explicit deployment environment or a local compose override, never committed to the repository.

### Stop local services

```powershell
docker compose down
```

Add `-v` only when you intentionally want to delete the local Postgres and Redis volumes:

```powershell
docker compose down -v
```

## Frontend Commands

```powershell
pnpm dev       # Start Vite development server
pnpm build     # Create a production build
pnpm preview   # Preview the production build
pnpm format    # Format frontend files
```
