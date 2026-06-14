import { Module } from '@nestjs/common';
import { ConnectorOauthController } from './connector-oauth.controller.js';
@Module({ controllers: [ConnectorOauthController] })
export class ConnectorOauthModule {}
