import compression from 'compression';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true
  });
  app.enableShutdownHooks();
  app.useBodyParser('json', { limit: '5mb' });
  app.use(compression());
  app.setGlobalPrefix('api/v1');

  const config = app.get(ConfigService);
  const trustProxyHops = Number(config.get('TRUST_PROXY_HOPS') ?? 0);
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const firstError = errors[0];
        const firstMessage =
          firstError &&
          firstError.constraints &&
          Object.values(firstError.constraints)[0];

        return new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          message: firstMessage ?? 'message.validation-failed'
        });
      }
    })
  );

  const port = config.get<string | number>('PORT') ?? 9999;
  console.log(`Server is running on http://localhost:${port}/api/v1`);
  await app.listen(port);
}
void bootstrap();
