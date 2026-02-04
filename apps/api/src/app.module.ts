import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { FeatureFlagsModule } from './common/feature-flags/feature-flags.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error('❌ Invalid environment variables:', result.error.format());
          throw new Error('Invalid environment variables');
        }
        return result.data;
      },
    }),
    PrismaModule,
    FeatureFlagsModule,
  ],
})
export class AppModule { }
