import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env['RESEND_API_KEY'];
    this.from = process.env['EMAIL_FROM'] ?? 'noreply@bitecodes.com';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY is not set — email sending is disabled. Set RESEND_API_KEY to enable.',
      );
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.resend) {
      this.logger.debug(`Email suppressed (no API key): to=${options.to} subject="${options.subject}"`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: options.from ?? this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw new Error(`Email send failed: ${error.message}`);
    }
  }
}
