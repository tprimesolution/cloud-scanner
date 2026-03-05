import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class UpdateFindingStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(["open", "acknowledged", "resolved", "suppressed"])
  status!: string;
}
