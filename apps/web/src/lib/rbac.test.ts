import { describe, it, expect } from 'vitest';
import { roleAtLeast, ROLE_RANK } from './rbac';

describe('ROLE_RANK', () => {
  it('orders owner > admin > member > viewer', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeGreaterThan(ROLE_RANK.viewer);
  });
});

describe('roleAtLeast', () => {
  it('owner satisfies every floor', () => {
    expect(roleAtLeast('owner', 'owner')).toBe(true);
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('owner', 'member')).toBe(true);
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
  });

  it('admin satisfies member but not owner', () => {
    expect(roleAtLeast('admin', 'member')).toBe(true);
    expect(roleAtLeast('admin', 'owner')).toBe(false);
  });

  it('member satisfies member and viewer but not admin', () => {
    expect(roleAtLeast('member', 'member')).toBe(true);
    expect(roleAtLeast('member', 'viewer')).toBe(true);
    expect(roleAtLeast('member', 'admin')).toBe(false);
  });

  it('viewer does NOT satisfy the member floor', () => {
    expect(roleAtLeast('viewer', 'member')).toBe(false);
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
  });

  it('fails CLOSED for an unknown / null / undefined role (below viewer)', () => {
    expect(roleAtLeast(undefined, 'viewer')).toBe(false);
    expect(roleAtLeast(null, 'viewer')).toBe(false);
    // @ts-expect-error — exercising a malformed role at runtime
    expect(roleAtLeast('superuser', 'viewer')).toBe(false);
  });
});
