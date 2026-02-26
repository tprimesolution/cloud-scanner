import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./shared/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return { status: "ok" };
  }

  @Get("ready")
  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", database: "connected" };
    } catch {
      return { status: "degraded", database: "disconnected" };
    }
  }

  @Get("live")
  getLive() {
    return { status: "alive" };
  }
}

