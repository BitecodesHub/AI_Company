import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller.js';
import { DocumentController } from './document.controller.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  controllers: [KnowledgeController, DocumentController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
