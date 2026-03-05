import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { ConfigService } from "@nestjs/config";
import { ApiKeyGuard } from "./shared/guards/api-key.guard";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["log", "error", "warn", "debug"],
  });

  const configService = app.get(ConfigService);
  app.setGlobalPrefix("api");

  const allowedOrigins = configService.get<string>("ALLOWED_ORIGINS");
  app.enableCors({
    origin: allowedOrigins ? allowedOrigins.split(",") : true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Trust exactly one proxy (nginx); avoids express-rate-limit ERR_ERL_PERMISSIVE_TRUST_PROXY
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120, // 120 requests/min per IP – conservative for t3.small
      // Disable strict trust proxy validation in express-rate-limit since we
      // explicitly configure Express' own trust proxy setting above.
      validate: {
        trustProxy: false,
      },
    })
  );

  app.useGlobalGuards(new ApiKeyGuard(configService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = Number(process.env.PORT || 8080);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Compliance appliance API listening on http://localhost:${port}/api/health`);
}

bootstrap();

