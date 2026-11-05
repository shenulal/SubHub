# SubHub container image. Default target: `runner` (the web app).
# Other target: `migrator` (Prisma CLI + sources for migrate/seed/backfill jobs).
# See docs/DEPLOYMENT.md and docker-compose.yml.

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
# No git hooks inside the image (package.json "prepare" runs husky)
ENV HUSKY=0

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values are inlined at build time (pass with --build-arg)
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_ENABLE_REFINE="false"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ENABLE_REFINE=$NEXT_PUBLIC_ENABLE_REFINE

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Regenerate Prisma Client to ensure it's up to date
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 3: Migrator - release jobs (prisma migrate deploy, seed, backfill).
# Has the Prisma CLI, tsx and the sources; the slim runner image does not.
FROM node:20-alpine AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
CMD ["sh", "scripts/docker-migrate.sh"]

# Stage 4: Runner (default target)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Extension source code and dependencies
COPY --from=builder /app/src/extensions ./src/extensions

# Install extension build dependencies in extensions directory
WORKDIR /app/src/extensions
RUN npm install --omit=dev
WORKDIR /app

# Ensure release directory exists for extension builds, and the local object
# store (STORAGE_PROVIDER=local) has a writable home - mount a volume there.
RUN mkdir -p src/extensions/chrome/release .data/storage

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Single-tenant (on-premise) unless the deployment sets SUBHUB_DEPLOYMENT_MODE=saas
ENV SUBHUB_DEPLOYMENT_MODE=single-tenant
ENV STORAGE_LOCAL_ROOT=/app/.data/storage

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/v1/system/info >/dev/null || exit 1

CMD ["node", "server.js"]
