import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test', 'provision'])
        .default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    // Add other environment variables here as needed
    // REDIS_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
