import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';
import { EmailModule } from './email/email.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DrizzleModule } from './drizzle/drizzle.module.js';
import { OrgModule } from './org/org.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';
import { MemberModule } from './member/member.module.js';
import { MeModule } from './me/me.module.js';
import { OrchestrationModule } from './orchestration/orchestration.module.js';
import { CompanyModule } from './company/company.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { ContactModule } from './contact/contact.module.js';
import { AgentModule } from './agent/agent.module.js';
import { RunModule } from './run/run.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { WorkflowModule } from './workflow/workflow.module.js';
import { SocialModule } from './social/social.module.js';
import { InboxModule } from './inbox/inbox.module.js';
import { ConnectorOauthModule } from './connector-oauth/connector-oauth.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { InngestModule } from './inngest-endpoint/inngest.module.js';
import { ControllerModule } from './controller/controller.module.js';
import { AdminModule } from './admin/admin.module.js';
import { BlogModule } from './blog/blog.module.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AllExceptionsFilter } from './common/filters/exception.filter.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { TenantGuard } from './common/guards/tenant.guard.js';
import { RbacGuard } from './common/guards/rbac.guard.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ObservabilityModule,
    AuditModule,
    DrizzleModule,         // ← global: all modules can inject DrizzleService
    HealthModule, EmailModule, AuthModule, GatewayModule, InngestModule,
    OrgModule, WorkspaceModule, MemberModule, MeModule,
    AgentModule, RunModule, KnowledgeModule, WorkflowModule, OrchestrationModule, CompanyModule, MemoryModule, OnboardingModule,
    SocialModule, InboxModule,
    ConnectorOauthModule,
    ControllerModule,
    AdminModule, BlogModule,
    MarketplaceModule, BillingModule,
    WebhookModule, ContactModule,
  ],
  providers: [
    Reflector,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
