FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --filter @cicd/backend...
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm db:generate
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma db push && node src/index.js"]
