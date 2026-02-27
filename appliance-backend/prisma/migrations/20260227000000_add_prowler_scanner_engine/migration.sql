-- CreateTable
CREATE TABLE "ProwlerCheck" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "risk" TEXT,
    "remediation" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProwlerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFramework" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "version" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceMapping" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProwlerCheck_checkName_key" ON "ProwlerCheck"("checkName");

-- CreateIndex
CREATE INDEX "ProwlerCheck_provider_service_idx" ON "ProwlerCheck"("provider", "service");

-- CreateIndex
CREATE INDEX "ProwlerCheck_provider_severity_idx" ON "ProwlerCheck"("provider", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceFramework_provider_source_key" ON "ComplianceFramework"("provider", "source");

-- CreateIndex
CREATE INDEX "ComplianceFramework_provider_idx" ON "ComplianceFramework"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceMapping_frameworkId_controlId_checkName_key" ON "ComplianceMapping"("frameworkId", "controlId", "checkName");

-- CreateIndex
CREATE INDEX "ComplianceMapping_checkName_idx" ON "ComplianceMapping"("checkName");

-- CreateIndex
CREATE INDEX "ComplianceMapping_frameworkId_idx" ON "ComplianceMapping"("frameworkId");

-- AddForeignKey
ALTER TABLE "ComplianceMapping" ADD CONSTRAINT "ComplianceMapping_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "ComplianceFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
