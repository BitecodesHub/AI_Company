import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller.js';
@Module({ controllers: [MarketplaceController] })
export class MarketplaceModule {}
