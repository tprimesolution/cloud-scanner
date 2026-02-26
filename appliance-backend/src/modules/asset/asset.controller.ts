import { Controller, Get, Query } from "@nestjs/common";
import { AssetService } from "./asset.service";

@Controller("assets")
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  async listAssets(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20"
  ) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const sizeNum = Math.min(
      Math.max(parseInt(pageSize, 10) || 20, 1),
      100
    ); // cap page size
    return this.assetService.listPaginated(pageNum, sizeNum);
  }
}

