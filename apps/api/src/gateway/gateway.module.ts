import { Module } from '@nestjs/common';
import { RunsGateway } from './runs.gateway.js';
import { ControllerGateway } from './controller.gateway.js';
import { InboxGateway } from './inbox.gateway.js';
import { CompanyGateway } from './company.gateway.js';

@Module({
  providers: [RunsGateway, ControllerGateway, InboxGateway, CompanyGateway],
  exports: [RunsGateway, ControllerGateway, InboxGateway, CompanyGateway],
})
export class GatewayModule {}
