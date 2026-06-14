// OpenTelemetry must be initialised before any other imports
import { initTelemetry } from './observability/telemetry.js';
initTelemetry();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — allow the web app origin (dev: both 3000 and 3002)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      process.env['APP_URL'] ?? 'http://localhost:3002',
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3002',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'x-bitecodes-workspace',
      'Idempotency-Key', 'x-request-id', 'Cookie',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // Idempotency is registered as an APP_INTERCEPTOR in AppModule so it applies
  // uniformly in production and under the e2e test harness.

  // Raw body for Stripe webhook signature verification
  app.use('/hooks/stripe', (req: any, _res: any, next: any) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { data += chunk; });
    req.on('end', () => { req.rawBody = data; next(); });
  });

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bitecodes API')
    .setDescription('Bitecodes — open-source agentic AI platform REST API')
    .setVersion('1.0')
    .addTag('agents', 'Agent management')
    .addTag('runs', 'Agent run execution and control')
    .addTag('knowledge', 'Knowledge base and document management')
    .addTag('social', 'Social media content and brand voice')
    .addTag('inbox', 'Unified inbox management')
    .addTag('workflows', 'Workflow builder and execution')
    .addTag('controller', 'AI Controller natural language interface')
    .addTag('connectors', 'External service connectors (OAuth)')
    .addTag('blog', 'AI-powered blog publishing')
    .addTag('marketplace', 'Template marketplace')
    .addTag('billing', 'Subscriptions and usage')
    .addTag('admin', 'Admin panel operations')
    .addTag('webhooks', 'Inbound webhook ingress')
    .addTag('organizations', 'Organizations')
    .addTag('workspaces', 'Workspaces')
    .addTag('members', 'Members and invitations')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-bitecodes-workspace' },
      'workspace',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Bitecodes API running on http://localhost:${port}`);
  logger.log(`📖 Swagger docs: http://localhost:${port}/docs`);
  logger.log(`🏥 Health:       http://localhost:${port}/health`);
  logger.log(`🔌 Inngest:      http://localhost:${port}/api/inngest`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
