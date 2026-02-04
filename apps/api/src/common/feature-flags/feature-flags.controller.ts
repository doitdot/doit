import { Controller, Get, Param } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
    constructor(private featureFlagsService: FeatureFlagsService) { }

    @Get()
    getAll() {
        return this.featureFlagsService.getAllFlags();
    }

    @Get(':flag')
    getFlag(@Param('flag') flag: string) {
        return {
            flag,
            enabled: this.featureFlagsService.isEnabled(flag),
        };
    }
}
