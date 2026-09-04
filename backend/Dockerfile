FROM node:22-alpine AS deps
WORKDIR /app
ENV PNPM_CONFIG_FETCH_TIMEOUT=600000 \
    PNPM_CONFIG_FETCH_RETRIES=5 \
    PNPM_CONFIG_NETWORK_CONCURRENCY=8
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
ENV DATABASE_URL=postgresql://rolebrief:rolebrief_dev_password@localhost:5432/rolebrief?schema=public
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp && corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/prisma.config.ts /app/prisma.config.ts
USER nodeapp
EXPOSE 3000
CMD ["node", "dist/main.js"]
