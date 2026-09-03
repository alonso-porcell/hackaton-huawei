FROM node:22-bookworm-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY incident-tools/package.json incident-tools/pnpm-lock.yaml incident-tools/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY incident-tools/ ./
COPY nginx/scenarios/ /scenarios/

RUN pnpm build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["pnpm", "start"]
