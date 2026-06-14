import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller.js';
import { EmailModule } from '../email/email.module.js';

@Module({ imports: [EmailModule], controllers: [ContactController] })
export class ContactModule {}
