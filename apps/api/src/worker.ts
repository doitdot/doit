import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker started, processing jobs...');

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down worker...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
