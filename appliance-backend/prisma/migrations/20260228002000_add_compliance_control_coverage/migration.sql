-- Create enum for control state classification
CREATE TYPE "ComplianceControlState" AS ENUM (
  'PASSED',
  'FAILED',
  'NOT_EVALUATED',
  'NOT_APPLICABLE'
);

-- Create compliance control status table
CREATE TABLE "compliance_control_status" (
  "id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "framework" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "check_id" TEXT NOT NULL,
  "status" "ComplianceControlState" NOT NULL,
  "is_not_applicable" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "compliance_control_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compliance_control_status_scan_framework_control_check_key"
ON "compliance_control_status"("scan_id", "framework", "control_id", "check_id");

CREATE INDEX "compliance_control_status_scan_id_idx"
ON "compliance_control_status"("scan_id");

CREATE INDEX "compliance_control_status_framework_idx"
ON "compliance_control_status"("framework");

CREATE INDEX "compliance_control_status_check_id_idx"
ON "compliance_control_status"("check_id");
