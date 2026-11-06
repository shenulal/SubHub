-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "decision_comment" TEXT,
ADD COLUMN     "decision_conditions" TEXT,
ADD COLUMN     "effective_start_date" DATE,
ADD COLUMN     "rejection_reason_id" TEXT,
ADD COLUMN     "rejection_reason_name" TEXT;

-- CreateTable
CREATE TABLE "approval_rejection_reasons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_rejection_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_rejection_reasons_organization_id_is_active_sort_o_idx" ON "approval_rejection_reasons"("organization_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_rejection_reasons_organization_id_code_key" ON "approval_rejection_reasons"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_rejection_reason_id_fkey" FOREIGN KEY ("rejection_reason_id") REFERENCES "approval_rejection_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_rejection_reasons" ADD CONSTRAINT "approval_rejection_reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

