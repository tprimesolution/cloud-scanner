import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header("X-API-KEY");

    const expectedKey = this.configService.get<string>("API_KEY");

    // If no API_KEY is set in environment, allow all requests (for dev mode/initial setup)
    if (!expectedKey) {
      return true;
    }

    if (apiKey !== expectedKey) {
      throw new UnauthorizedException("Invalid API Key");
    }

    return true;
  }
}
