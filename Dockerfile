# =============================================================
# Alumni Portal — production image
#
# PREREQUISITE: next.config.ts must set `output: 'standalone'`. It does
# not today. Without it `next build` never writes .next/standalone and the
# runner stage fails on a missing server.js — which reads like a broken
# COPY path rather than a missing config line, so check that first.
#
#   const nextConfig: NextConfig = {
#     output: 'standalone',
#     ...
#   };
#
# Build:  docker build -t alumni-portal .
# Run:    docker run -p 3000:3000 --env-file .env.production alumni-portal
#
# Migrations are NOT run by this image. See docs/DEPLOYMENT.md.
# =============================================================

# -------------------------------------------------------------
# deps — resolved separately so a source-only change does not
# reinstall node_modules
# -------------------------------------------------------------
FROM node:22-alpine AS deps
# openssl: the Prisma query engine links against it.
# libc6-compat: Next's SWC binary expects glibc symbols on musl.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -------------------------------------------------------------
# builder
# -------------------------------------------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The generator block in schema.prisma declares no binaryTargets, so
# `native` is whatever this container is — musl with OpenSSL 3. That is
# only correct because the runner below is the same base image. If you
# switch the runner to a Debian image, generate there too or add
# binaryTargets to the schema; the mismatch surfaces at first query as
# "Query engine library for current platform could not be found".
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# src/lib/auth/session.ts throws at import time when SESSION_SECRET is
# missing outside fixture mode, and `next build` imports it while
# prerendering. A throwaway value gets the build through; the real secret
# is injected at run time and nothing signed with this one ever exists.
ENV SESSION_SECRET=build-only-not-used-at-runtime

RUN npm run build

# -------------------------------------------------------------
# runner — no source, no dev dependencies, no package manager
# -------------------------------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind all interfaces. Next's default of localhost is unreachable from
# outside the container and looks exactly like a crashed process.
ENV HOSTNAME=0.0.0.0

# Nothing in this image needs to write to disk or own its own files.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# standalone carries its own minimal node_modules; static assets and
# /public are not traced into it and have to come across separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma's query engine is loaded by a path computed at runtime, which
# Next's file tracing has historically failed to follow. Copying it
# explicitly is cheap insurance against an image that builds clean and
# then cannot open a connection.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
