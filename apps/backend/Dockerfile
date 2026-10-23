FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile --filter @cicd/backend...

COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm db:generate

RUN chown -R node:node /app
USER node

EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node src/index.js"]
