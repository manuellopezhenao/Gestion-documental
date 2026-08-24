import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService).get<AppConfig>('app')!;

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS explicito, no "*" (PLAN_API.md seccion 9). Solo hace falta en dev
  // (Vite en :5173 llamando a la API en :3000) -- en el paquete de release
  // el frontend se sirve desde este mismo origen (ver mas abajo), no hay
  // cross-origin y CORS no aplica.
  app.enableCors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gestion documental API')
    .setDescription('Ver ../PLAN_API.md')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Si existe una carpeta "public" junto al proceso (ver
  // scripts/build-release.mjs en la raiz del repo, que copia ahi el build
  // estatico del frontend), esta misma API tambien la sirve -- asi el
  // paquete de release es un solo servidor en un solo puerto. En dev esta
  // carpeta no existe (el frontend corre aparte via "vite dev") y este
  // bloque no hace nada.
  const publicDir = path.resolve(process.cwd(), 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
    app.use((req: { method: string; path: string }, res: Response, next: () => void) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${config.port} (docs en /api/docs)`);
}

bootstrap();
