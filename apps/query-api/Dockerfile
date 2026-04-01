FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter @publisheriq/shared build
RUN pnpm --filter @publisheriq/data-plane build
RUN pnpm --filter @publisheriq/query-api build

ENV NODE_ENV=production

WORKDIR /app/apps/query-api

EXPOSE 4318

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4318/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["pnpm", "start"]
