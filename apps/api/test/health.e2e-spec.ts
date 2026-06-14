import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  HttpStatus,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { AllExceptionsFilter } from '../src/common/filters/exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

// Both guards are bypassed in this unit test — we test auth/rbac
// behaviour in dedicated guard spec files.
class PassthroughGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext) {
    return true;
  }
}

let app: INestApplication;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [HealthModule],
    providers: [
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
      { provide: APP_GUARD, useClass: PassthroughGuard },
    ],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('includes x-request-id in response headers', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('preserves a supplied x-request-id', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', id);
    expect(response.headers['x-request-id']).toBe(id);
  });
});

describe('GET /ready', () => {
  it('returns 200 with real DB + Redis probes', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(HttpStatus.OK);
    // Real readiness now reports per-subsystem status. DB must be reachable in
    // a DB-backed test run; Redis may be down in a dev box (reported, not faked).
    expect(['ok', 'down']).toContain(response.body.status);
    expect(Array.isArray(response.body.probes)).toBe(true);
    const db = response.body.probes.find((p: { name: string }) => p.name === 'database');
    expect(db?.status).toBe('ok');
  });
});

describe('GET /v1/system-health', () => {
  it('returns subsystem probes with an overall status', async () => {
    const response = await request(app.getHttpServer()).get('/v1/system-health').expect(HttpStatus.OK);
    expect(['ok', 'degraded', 'down']).toContain(response.body.status);
    const names = (response.body.probes as Array<{ name: string }>).map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['database', 'redis', 'ai_provider', 'inngest', 'storage', 'auth']),
    );
  });
});

describe('Error envelope', () => {
  it('returns canonical error envelope for a 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/does-not-exist')
      .expect(HttpStatus.NOT_FOUND);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body.error).toHaveProperty('message');
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
