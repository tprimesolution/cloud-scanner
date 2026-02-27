import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["log", "error", "warn", "debug"],
  });

  app.setGlobalPrefix("api");
  app.enableCors({ origin: true });

  // Trust X-Forwarded-For when behind nginx/reverse proxy (required for express-rate-limit)
  app.set("trust proxy", true);

  app.use(helmet());
  app.use(compression());
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120, // 120 requests/min per IP – conservative for t3.small
    })
  );

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

