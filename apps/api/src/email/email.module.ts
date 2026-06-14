import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ApprovalNotifierService } from './approval-notifier.service.js';

@Module({
  providers: [EmailService, ApprovalNotifierService],
  exports: [EmailService],
})
export class EmailModule {}
