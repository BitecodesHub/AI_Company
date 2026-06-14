/**
 * @bitecodes/ee-rbac — Custom roles + tool-scope permissions.
 * Requires LICENSE_KEY. (P13-04)
 */
export function isRbacLicensed(): boolean {
  return Boolean(process.env['LICENSE_KEY']);
}

export function assertRbacLicensed(): void {
  if (!isRbacLicensed()) {
    throw Object.assign(new Error('Advanced RBAC requires an enterprise license.'), { code: 'NOT_LICENSED' });
  }
}
