/**
 * @bitecodes/ee-sso — SAML 2.0, OIDC, SCIM directory sync.
 *
 * REQUIRES a valid LICENSE_KEY environment variable to activate.
 * Without a valid key, all exports resolve to no-ops or throw NOT_LICENSED.
 * (ARCHITECTURE.md §18, P13-01, P13-02, P13-03)
 */

export function isSsoLicensed(): boolean {
  const key = process.env['LICENSE_KEY'];
  return Boolean(key && key.length > 0);
}

export function assertSsoLicensed(): void {
  if (!isSsoLicensed()) {
    throw Object.assign(new Error('SSO requires an enterprise license. Contact hello@bitecodes.com'), {
      code: 'NOT_LICENSED',
    });
  }
}

// TODO Phase 13: implement SAML/OIDC via Better Auth SSO plugin or WorkOS
export class SsoProvider {
  constructor() { assertSsoLicensed(); }
}

// TODO Phase 13: SCIM 2.0 directory sync endpoints
export class ScimAdapter {
  constructor() { assertSsoLicensed(); }
}
