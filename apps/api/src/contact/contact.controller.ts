/**
 * POST /v1/contact — public marketing contact form. Sends the message to the
 * support inbox via EmailService (which no-ops + logs when email is disabled, so
 * this never fakes a send). Public: no session required.
 */
import { Controller, Post, Body, HttpCode, SetMetadata, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { EmailService } from '../email/email.service.js';

const Public = () => SetMetadata('isPublic', true);

const ContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(1).max(4000),
  company: z.string().max(120).optional(),
});
type ContactBody = z.infer<typeof ContactSchema>;

@ApiTags('contact')
@Controller('v1/contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  constructor(private readonly email: EmailService) {}

  @Post()
  @HttpCode(202)
  @Public()
  @ApiOperation({ summary: 'Submit a contact request' })
  async submit(@Body(new ZodValidationPipe(ContactSchema)) body: ContactBody) {
    const to = process.env['EMAIL_FROM'] ?? 'noreply@bitecodes.com';
    try {
      await this.email.send({
        to,
        subject: `New contact request from ${body.name}`,
        html: `<p><strong>${escapeHtml(body.name)}</strong> (${escapeHtml(body.email)})${body.company ? ` · ${escapeHtml(body.company)}` : ''}</p><p>${escapeHtml(body.message).replace(/\n/g, '<br>')}</p>`,
      });
    } catch (err) {
      this.logger.warn(`Contact email failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
    // Accepted regardless of email delivery — the request is received.
    return { received: true };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
