-- CreateTable
CREATE TABLE "CloudSploitRule" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "compliance" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudSploitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSploitScan" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudSploitScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSploitScanResult" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resourceId" TEXT,
    "region" TEXT,
    "message" TEXT,
    "raw" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudSploitScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudSploitRule_ruleName_key" ON "CloudSploitRule"("ruleName");

-- CreateIndex
CREATE INDEX "CloudSploitRule_provider_service_idx" ON "CloudSploitRule"("provider", "service");

-- CreateIndex
CREATE INDEX "CloudSploitRule_provider_severity_idx" ON "CloudSploitRule"("provider", "severity");

-- CreateIndex
CREATE INDEX "CloudSploitScan_status_createdAt_idx" ON "CloudSploitScan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CloudSploitScanResult_scanId_idx" ON "CloudSploitScanResult"("scanId");

-- CreateIndex
CREATE INDEX "CloudSploitScanResult_ruleId_idx" ON "CloudSploitScanResult"("ruleId");

-- AddForeignKey
ALTER TABLE "CloudSploitScanResult" ADD CONSTRAINT "CloudSploitScanResult_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "CloudSploitScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudSploitScanResult" ADD CONSTRAINT "CloudSploitScanResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CloudSploitRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
