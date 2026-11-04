-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CORPORATE_CARD', 'PERSONAL_CARD', 'BANK_TRANSFER', 'INVOICE', 'PAYPAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('CONTRACT', 'INVOICE', 'ORDER_FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceChangeSource" AS ENUM ('CARD_TRANSACTION', 'PAYMENT_RECORD', 'EMAIL_RECEIPT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('RENEWAL', 'TRIAL_ENDING', 'NOTICE_PERIOD');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalApproverType" AS ENUM ('USER', 'MANAGER', 'TEAM_APPROVER', 'ROLE');

-- CreateEnum
CREATE TYPE "ApprovalEventType" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUESTED', 'INFO_PROVIDED', 'COMMENTED', 'REMINDED', 'ESCALATED', 'CANCELLED', 'SUBSCRIPTION_CREATED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('RENEWAL_REMINDER', 'TRIAL_ENDING', 'PRICE_CHANGE', 'NOTICE_PERIOD', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'APPROVAL_INFO_REQUESTED', 'APPROVAL_ESCALATED', 'APPROVER_RENEWAL', 'OFFBOARDING', 'SHADOW_IT', 'COST_ANOMALY', 'PENDING_REVIEW', 'RECEIPT_SUGGESTION', 'DIGEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DevicePlatformType" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReceiptSuggestionStatus" AS ENUM ('NEW', 'ACCEPTED', 'DISMISSED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'APPROVER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAUSED';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "saas_catalog" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "billing_portal_url" TEXT,
ADD COLUMN     "cancellation_steps" JSONB,
ADD COLUMN     "cancellation_url" TEXT,
ADD COLUMN     "notice_period_days" INTEGER,
ADD COLUMN     "subcategory" TEXT;

-- AlterTable
ALTER TABLE "apps" ADD COLUMN     "cancellation_notes" TEXT,
ADD COLUMN     "cancellation_url" TEXT,
ADD COLUMN     "category_id" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_deadline" TIMESTAMP(3),
ADD COLUMN     "cancellation_notes" TEXT,
ADD COLUMN     "cancellation_url" TEXT,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "is_personal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_trial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_detected_amount" DECIMAL(10,2),
ADD COLUMN     "notice_period_days" INTEGER,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "paused_at" TIMESTAMP(3),
ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "reminder_lead_days" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
ADD COLUMN     "trial_ends_at" TIMESTAMP(3),
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "approver_id" TEXT;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_tags" (
    "subscription_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_tags_pkey" PRIMARY KEY ("subscription_id","tag_id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_change_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "previous_amount" DECIMAL(10,2) NOT NULL,
    "new_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "change_percent" DECIMAL(8,2) NOT NULL,
    "source" "PriceChangeSource" NOT NULL,
    "source_record_id" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" TEXT,

    CONSTRAINT "price_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_dispatches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "lead_days" INTEGER NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "applies_to_all" BOOLEAN NOT NULL DEFAULT false,
    "cost_threshold" DECIMAL(12,2),
    "cost_threshold_currency" TEXT NOT NULL DEFAULT 'USD',
    "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reminder_after_days" INTEGER,
    "escalation_after_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policy_steps" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approver_type" "ApprovalApproverType" NOT NULL,
    "approver_user_id" TEXT,
    "approver_role" "UserRole",

    CONSTRAINT "approval_policy_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "policy_id" TEXT,
    "catalog_id" TEXT,
    "category_id" TEXT,
    "subscription_id" TEXT,
    "service_name" TEXT NOT NULL,
    "vendor_website" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "seats" INTEGER,
    "justification" TEXT NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "last_reminder_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "comment" TEXT,
    "due_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_events" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "ApprovalEventType" NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "dedupe_key" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" "NotificationEventType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "DevicePlatformType" NOT NULL,
    "token" TEXT NOT NULL,
    "device_name" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'subscriptions',
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sort" JSONB,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_scanned_at" TIMESTAMP(3),
    "cursor" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "sender_email" TEXT,
    "subject" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "billing_cycle" "BillingCycle",
    "charged_at" TIMESTAMP(3),
    "next_renewal_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "snippet" TEXT,
    "matched_catalog_id" TEXT,
    "matched_subscription_id" TEXT,
    "status" "ReceiptSuggestionStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "quote_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "format" TEXT NOT NULL DEFAULT 'JSON',
    "storage_key" TEXT,
    "file_url" TEXT,
    "size_bytes" INTEGER,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_organization_id_parent_id_slug_key" ON "categories"("organization_id", "parent_id", "slug");

-- CreateIndex
CREATE INDEX "tags_organization_id_idx" ON "tags"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_name_key" ON "tags"("organization_id", "name");

-- CreateIndex
CREATE INDEX "subscription_tags_tag_id_idx" ON "subscription_tags"("tag_id");

-- CreateIndex
CREATE INDEX "custom_field_definitions_organization_id_idx" ON "custom_field_definitions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organization_id_key_key" ON "custom_field_definitions"("organization_id", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_field_id_idx" ON "custom_field_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_subscription_id_field_id_key" ON "custom_field_values"("subscription_id", "field_id");

-- CreateIndex
CREATE INDEX "attachments_organization_id_idx" ON "attachments"("organization_id");

-- CreateIndex
CREATE INDEX "attachments_subscription_id_idx" ON "attachments"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_comments_subscription_id_idx" ON "subscription_comments"("subscription_id");

-- CreateIndex
CREATE INDEX "price_change_events_organization_id_acknowledged_at_idx" ON "price_change_events"("organization_id", "acknowledged_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_change_events_subscription_id_source_source_record_id_key" ON "price_change_events"("subscription_id", "source", "source_record_id");

-- CreateIndex
CREATE INDEX "reminder_dispatches_organization_id_idx" ON "reminder_dispatches"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_dispatches_subscription_id_kind_lead_days_target_d_key" ON "reminder_dispatches"("subscription_id", "kind", "lead_days", "target_date");

-- CreateIndex
CREATE INDEX "approval_policies_organization_id_is_active_priority_idx" ON "approval_policies"("organization_id", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "approval_policy_steps_policy_id_step_order_key" ON "approval_policy_steps"("policy_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_subscription_id_key" ON "approval_requests"("subscription_id");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_status_idx" ON "approval_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_requester_id_idx" ON "approval_requests"("requester_id");

-- CreateIndex
CREATE INDEX "approval_requests_submitted_at_idx" ON "approval_requests"("submitted_at");

-- CreateIndex
CREATE INDEX "approval_steps_approver_id_status_idx" ON "approval_steps"("approver_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_request_id_step_order_key" ON "approval_steps"("request_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_events_request_id_created_at_idx" ON "approval_events"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_type_channel_key" ON "notification_preferences"("user_id", "event_type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_entity_idx" ON "saved_views"("organization_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_user_id_entity_name_key" ON "saved_views"("user_id", "entity", "name");

-- CreateIndex
CREATE INDEX "mailbox_connections_organization_id_idx" ON "mailbox_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_connections_user_id_provider_email_key" ON "mailbox_connections"("user_id", "provider", "email");

-- CreateIndex
CREATE INDEX "receipt_suggestions_organization_id_status_idx" ON "receipt_suggestions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_suggestions_mailbox_id_message_id_key" ON "receipt_suggestions"("mailbox_id", "message_id");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_quote_currency_idx" ON "exchange_rates"("base_currency", "quote_currency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_quote_currency_as_of_key" ON "exchange_rates"("base_currency", "quote_currency", "as_of");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_user_id_organization_id_key" ON "onboarding_progress"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "data_export_requests_user_id_idx" ON "data_export_requests"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_category_id_idx" ON "subscriptions"("category_id");

-- CreateIndex
CREATE INDEX "subscriptions_owner_id_idx" ON "subscriptions"("owner_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_trial_ends_at_idx" ON "subscriptions"("trial_ends_at");

-- CreateIndex
CREATE INDEX "subscriptions_cancellation_deadline_idx" ON "subscriptions"("cancellation_deadline");

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_tags" ADD CONSTRAINT "subscription_tags_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_tags" ADD CONSTRAINT "subscription_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_comments" ADD CONSTRAINT "subscription_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_comments" ADD CONSTRAINT "subscription_comments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_comments" ADD CONSTRAINT "subscription_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_change_events" ADD CONSTRAINT "price_change_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_change_events" ADD CONSTRAINT "price_change_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "saas_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_connections" ADD CONSTRAINT "mailbox_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_connections" ADD CONSTRAINT "mailbox_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_suggestions" ADD CONSTRAINT "receipt_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_suggestions" ADD CONSTRAINT "receipt_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_suggestions" ADD CONSTRAINT "receipt_suggestions_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailbox_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_suggestions" ADD CONSTRAINT "receipt_suggestions_matched_catalog_id_fkey" FOREIGN KEY ("matched_catalog_id") REFERENCES "saas_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

