import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async listPaginated(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        skip,
        take: pageSize,
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          riskLevel: true,
          createdAt: true,
        },
      }),
      this.prisma.asset.count({ where: { deletedAt: null } }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }
}

