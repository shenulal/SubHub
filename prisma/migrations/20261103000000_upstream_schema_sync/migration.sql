-- SubHub: brings the database in line with the upstream saaslens v0.1.0 Prisma schema
-- (upstream migrations lagged behind prisma/schema.prisma: BillingType, SUPER_ADMIN, otp_tokens,
--  subscription_teams, saas_domain_scan_history, csv_mapping_profiles, card_transactions columns).

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('FLAT_RATE', 'PER_SEAT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationType" ADD VALUE 'SAP_S4HANA';
ALTER TYPE "IntegrationType" ADD VALUE 'ORACLE_ERP_CLOUD';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "card_transactions" ADD COLUMN     "linked_subscription_id" TEXT,
ADD COLUMN     "match_status" "PaymentMatchStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "team_id" TEXT,
ADD COLUMN     "user_id" TEXT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMatchStatus_new" AS ENUM ('PENDING', 'AUTO_MATCHED', 'MANUAL', 'UNMATCHED');
ALTER TABLE "public"."payment_records" ALTER COLUMN "match_status" DROP DEFAULT;
ALTER TABLE "payment_records" ALTER COLUMN "match_status" TYPE "PaymentMatchStatus_new" USING ("match_status"::text::"PaymentMatchStatus_new");
ALTER TABLE "card_transactions" ALTER COLUMN "match_status" DROP DEFAULT;
ALTER TABLE "card_transactions" ALTER COLUMN "match_status" TYPE "PaymentMatchStatus_new" USING ("match_status"::text::"PaymentMatchStatus_new");
ALTER TYPE "PaymentMatchStatus" RENAME TO "PaymentMatchStatus_old";
ALTER TYPE "PaymentMatchStatus_new" RENAME TO "PaymentMatchStatus";
DROP TYPE "public"."PaymentMatchStatus_old";
ALTER TABLE "payment_records" ALTER COLUMN "match_status" SET DEFAULT 'PENDING';
ALTER TABLE "card_transactions" ALTER COLUMN "match_status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "saas_catalog" ALTER COLUMN "base_price_per_seat" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "billing_type" "BillingType" NOT NULL DEFAULT 'FLAT_RATE',
ADD COLUMN     "per_seat_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "otp_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_teams" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "subscription_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_domain_scan_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "is_saas" BOOLEAN NOT NULL,
    "service_name" TEXT,
    "category" TEXT,
    "confidence" DOUBLE PRECISION,
    "catalog_id" TEXT,
    "website" TEXT,
    "reasoning" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_malicious" BOOLEAN NOT NULL DEFAULT false,
    "threat_type" TEXT,
    "safe_browsing_checked_at" TIMESTAMP(3),
    "review_status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "saas_domain_scan_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_mapping_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_format" TEXT NOT NULL,
    "field_mappings" JSONB NOT NULL,
    "double_entry" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_mapping_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_tokens_email_idx" ON "otp_tokens"("email");

-- CreateIndex
CREATE INDEX "subscription_teams_subscription_id_idx" ON "subscription_teams"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_teams_team_id_idx" ON "subscription_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_teams_subscription_id_team_id_key" ON "subscription_teams"("subscription_id", "team_id");

-- CreateIndex
CREATE INDEX "saas_domain_scan_history_organization_id_idx" ON "saas_domain_scan_history"("organization_id");

-- CreateIndex
CREATE INDEX "saas_domain_scan_history_is_saas_idx" ON "saas_domain_scan_history"("is_saas");

-- CreateIndex
CREATE INDEX "saas_domain_scan_history_is_malicious_idx" ON "saas_domain_scan_history"("is_malicious");

-- CreateIndex
CREATE INDEX "saas_domain_scan_history_review_status_idx" ON "saas_domain_scan_history"("review_status");

-- CreateIndex
CREATE INDEX "saas_domain_scan_history_scanned_at_idx" ON "saas_domain_scan_history"("scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "saas_domain_scan_history_organization_id_domain_key" ON "saas_domain_scan_history"("organization_id", "domain");

-- CreateIndex
CREATE INDEX "csv_mapping_profiles_organization_id_idx" ON "csv_mapping_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "card_transactions_match_status_idx" ON "card_transactions"("match_status");

-- CreateIndex
CREATE INDEX "card_transactions_linked_subscription_id_idx" ON "card_transactions"("linked_subscription_id");

-- CreateIndex
CREATE INDEX "card_transactions_team_id_idx" ON "card_transactions"("team_id");

-- CreateIndex
CREATE INDEX "card_transactions_user_id_idx" ON "card_transactions"("user_id");

-- AddForeignKey
ALTER TABLE "subscription_teams" ADD CONSTRAINT "subscription_teams_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_teams" ADD CONSTRAINT "subscription_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_linked_subscription_id_fkey" FOREIGN KEY ("linked_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_domain_scan_history" ADD CONSTRAINT "saas_domain_scan_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_domain_scan_history" ADD CONSTRAINT "saas_domain_scan_history_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "saas_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_mapping_profiles" ADD CONSTRAINT "csv_mapping_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

