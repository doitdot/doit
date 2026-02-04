import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagsService {
    constructor(private configService: ConfigService) { }

    isEnabled(flag: string): boolean {
        // Basic implementation: check if Env Var is 'true'
        // Example: FF_NEW_DASHBOARD=true
        const value = this.configService.get(flag);
        return value === 'true';
    }

    getAllFlags(): Record<string, boolean> {
        // Return all env vars starting with FF_
        // Note: In a real app, you might want a defined list of flags
        const flags: Record<string, boolean> = {};
        const env = process.env;
        for (const key in env) {
            if (key.startsWith('FF_')) {
                flags[key] = env[key] === 'true';
            }
        }
        return flags;
    }
}
