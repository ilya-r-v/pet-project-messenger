import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const pubClient = createClient({ url: 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  app.useWebSocketAdapter(new (class extends IoAdapter {
    createIOServer(port: number, options?: any): any {
      const server = super.createIOServer(port, options);
      server.adapter(createAdapter(pubClient, subClient));
      return server;
    }
  })(app));

  const config = new DocumentBuilder()
    .setTitle('Server')
    .setDescription('Server for messenger')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();