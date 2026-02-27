/**
 * Seeds test data for Assets API testing.
 * Run: DATABASE_URL=postgresql://compliance:compliance@localhost:5432/compliance_appliance npx ts-node scripts/seed-assets-test.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const job = await prisma.scanJob.create({
    data: {
      type: "full",
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      resourceCount: 3,
      findingCount: 0,
    },
  });

  await prisma.collectedResource.createMany({
    data: [
      {
        scanJobId: job.id,
        resourceId: "s3://test-bucket-1",
        resourceType: "s3",
        region: "us-east-1",
        metadata: { name: "test-bucket-1", publicAccessBlock: true },
      },
      {
        scanJobId: job.id,
        resourceId: "iam:alice",
        resourceType: "iam_user",
        region: "us-east-1",
        metadata: { userName: "alice", mfaActive: true },
      },
      {
        scanJobId: job.id,
        resourceId: "vol-abc123",
        resourceType: "ebs",
        region: "us-east-1",
        metadata: { volumeId: "vol-abc123", encrypted: true },
      },
    ],
  });

  console.log("Seeded ScanJob", job.id, "with 3 CollectedResources");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
