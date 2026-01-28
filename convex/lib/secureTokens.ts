export function generateSecureToken(prefix: string): string {
  const token = crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${Date.now()}_${token}`;
}
