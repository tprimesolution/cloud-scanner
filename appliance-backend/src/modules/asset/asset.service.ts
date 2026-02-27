import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

/** Derive display name from CollectedResource metadata. */
function getDisplayName(
  resourceId: string,
  resourceType: string,
  metadata: unknown
): string {
  const m = metadata as Record<string, unknown> | null;
  if (m) {
    const name =
      (m.name as string) ??
      (m.userName as string) ??
      (m.groupName as string) ??
      (m.groupId as string) ??
      (m.instanceId as string) ??
      (m.volumeId as string) ??
      (m.trailName as string);
    if (name) return String(name);
  }
  return resourceId;
}

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async listPaginated(page: number, pageSize: number) {
    // Use collected resources from the latest completed scan as the asset inventory
    const latestJob = await this.prisma.scanJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });

    if (!latestJob) {
      return { items: [], page, pageSize, total: 0 };
    }

    const skip = (page - 1) * pageSize;
    const [resources, total] = await this.prisma.$transaction([
      this.prisma.collectedResource.findMany({
        where: { scanJobId: latestJob.id },
        skip,
        take: pageSize,
        orderBy: [{ resourceType: "asc" }, { resourceId: "asc" }],
        select: {
          id: true,
          resourceId: true,
          resourceType: true,
          region: true,
          metadata: true,
          fetchedAt: true,
        },
      }),
      this.prisma.collectedResource.count({
        where: { scanJobId: latestJob.id },
      }),
    ]);

    // Map to Asset shape expected by frontend
    const items = resources.map((r) => ({
      id: r.id,
      name: getDisplayName(r.resourceId, r.resourceType, r.metadata),
      type: r.resourceType,
      riskLevel: "low" as const,
      createdAt: r.fetchedAt,
    }));

    return {
      items,
      page,
      pageSize,
      total,
    };
  }
}

