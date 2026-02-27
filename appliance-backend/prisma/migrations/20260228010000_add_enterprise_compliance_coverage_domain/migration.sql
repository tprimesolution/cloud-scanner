CREATE TYPE "CriteriaScopeStatus" AS ENUM ('IN_SCOPE', 'OUT_OF_SCOPE');
CREATE TYPE "ControlReadinessStatus" AS ENUM ('READY', 'PARTIAL', 'NOT_READY');

CREATE TABLE "frameworks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT,
  "category" TEXT,
  "region" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "frameworks_name_idx" ON "frameworks"("name");

CREATE TABLE "framework_areas" (
  "id" TEXT NOT NULL,
  "framework_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "framework_areas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "framework_areas_framework_id_idx" ON "framework_areas"("framework_id");

CREATE TABLE "framework_criteria" (
  "id" TEXT NOT NULL,
  "area_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "scope_status" "CriteriaScopeStatus" NOT NULL DEFAULT 'IN_SCOPE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "framework_criteria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "framework_criteria_area_code_key" ON "framework_criteria"("area_id", "code");
CREATE INDEX "framework_criteria_scope_status_idx" ON "framework_criteria"("scope_status");

CREATE TABLE "controls" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "owner" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "controls_name_idx" ON "controls"("name");

CREATE TABLE "criteria_control_mappings" (
  "id" TEXT NOT NULL,
  "criteria_id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "criteria_control_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "criteria_control_mappings_criteria_control_key" ON "criteria_control_mappings"("criteria_id", "control_id");
CREATE INDEX "criteria_control_mappings_criteria_id_idx" ON "criteria_control_mappings"("criteria_id");
CREATE INDEX "criteria_control_mappings_control_id_idx" ON "criteria_control_mappings"("control_id");

CREATE TABLE "control_check_mappings" (
  "id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "check_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_check_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "control_check_mappings_control_check_key" ON "control_check_mappings"("control_id", "check_id");
CREATE INDEX "control_check_mappings_control_id_idx" ON "control_check_mappings"("control_id");
CREATE INDEX "control_check_mappings_check_id_idx" ON "control_check_mappings"("check_id");

CREATE TABLE "control_status" (
  "id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "readiness_percent" INTEGER NOT NULL,
  "status" "ControlReadinessStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "control_status_control_scan_key" ON "control_status"("control_id", "scan_id");
CREATE INDEX "control_status_scan_id_idx" ON "control_status"("scan_id");
CREATE INDEX "control_status_status_idx" ON "control_status"("status");

CREATE TABLE "criteria_status" (
  "id" TEXT NOT NULL,
  "criteria_id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "readiness_percent" INTEGER NOT NULL,
  "ready_controls" INTEGER NOT NULL,
  "total_controls" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "criteria_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "criteria_status_criteria_scan_key" ON "criteria_status"("criteria_id", "scan_id");
CREATE INDEX "criteria_status_scan_id_idx" ON "criteria_status"("scan_id");

CREATE TABLE "framework_status" (
  "id" TEXT NOT NULL,
  "framework_id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "framework_readiness_percent" INTEGER NOT NULL,
  "ready_criteria" INTEGER NOT NULL,
  "total_criteria" INTEGER NOT NULL,
  "total_controls" INTEGER NOT NULL,
  "total_automated_checks" INTEGER NOT NULL,
  "in_scope_criteria" INTEGER NOT NULL,
  "out_of_scope_criteria" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "framework_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "framework_status_framework_scan_key" ON "framework_status"("framework_id", "scan_id");
CREATE INDEX "framework_status_scan_id_idx" ON "framework_status"("scan_id");

ALTER TABLE "framework_areas"
ADD CONSTRAINT "framework_areas_framework_id_fkey"
FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "framework_criteria"
ADD CONSTRAINT "framework_criteria_area_id_fkey"
FOREIGN KEY ("area_id") REFERENCES "framework_areas"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "criteria_control_mappings"
ADD CONSTRAINT "criteria_control_mappings_criteria_id_fkey"
FOREIGN KEY ("criteria_id") REFERENCES "framework_criteria"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "criteria_control_mappings"
ADD CONSTRAINT "criteria_control_mappings_control_id_fkey"
FOREIGN KEY ("control_id") REFERENCES "controls"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "control_check_mappings"
ADD CONSTRAINT "control_check_mappings_control_id_fkey"
FOREIGN KEY ("control_id") REFERENCES "controls"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "control_status"
ADD CONSTRAINT "control_status_control_id_fkey"
FOREIGN KEY ("control_id") REFERENCES "controls"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "criteria_status"
ADD CONSTRAINT "criteria_status_criteria_id_fkey"
FOREIGN KEY ("criteria_id") REFERENCES "framework_criteria"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "framework_status"
ADD CONSTRAINT "framework_status_framework_id_fkey"
FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
