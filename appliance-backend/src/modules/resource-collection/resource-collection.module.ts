import { Module } from "@nestjs/common";
import { ResourceCollectionService } from "./resource-collection.service";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  providers: [ResourceCollectionService, PrismaService],
  exports: [ResourceCollectionService],
})
export class ResourceCollectionModule {}
