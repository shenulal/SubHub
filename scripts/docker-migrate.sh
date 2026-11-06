#!/bin/sh
# scripts/docker-migrate.sh — one-off release job for the Docker stack (the
# `migrate` service in docker-compose.yml). Safe to run on every start/upgrade:
#   1. apply pending migrations (prisma migrate deploy — never `migrate dev/reset`)
#   2. first install only: seed the platform masters (currencies, countries,
#      permission catalogue, vendor catalog) when the currency table is empty
#   3. re-sync per-organisation defaults and new permission grants (idempotent)
#   4. optional: create the platform super admin if missing (SUPER_ADMIN_* env;
#      an existing account is never reset here — use the CLI without --create-only)
set -eu

echo "[migrate] SUBHUB_DEPLOYMENT_MODE=${SUBHUB_DEPLOYMENT_MODE:-single-tenant}"
npx prisma migrate deploy

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.currency.count().then(n=>{process.exitCode=n>0?0:10}).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>p.\$disconnect())"; then
  echo "[migrate] platform masters present - seed skipped"
else
  status=$?
  if [ "$status" -ne 10 ]; then
    echo "[migrate] could not inspect the database (exit $status)" >&2
    exit "$status"
  fi
  echo "[migrate] first install - seeding platform masters"
  npm run db:seed
fi

npm run db:backfill-defaults

# 4. optional: bootstrap / reset the platform super admin for the Control Panel
#    (/super-admin/login) when both variables are present in the environment.
if [ -n "${SUPER_ADMIN_EMAIL:-}" ] && [ -n "${SUPER_ADMIN_PASSWORD:-}" ]; then
  echo "[migrate] ensuring platform super admin ${SUPER_ADMIN_EMAIL}"
  npm run platform:create-super-admin -- --create-only
else
  echo "[migrate] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set - super admin bootstrap skipped"
fi
echo "[migrate] done"
