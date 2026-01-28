const nextConfig = require('../../../next.config.js');

describe('next.config.js secret exposure', () => {
  it('does not inline server secrets via config env', () => {
    const env = nextConfig.env || {};
    const forbiddenKeys = [
      'NEXTAUTH_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'STRIPE_SECRET_KEY',
    ];

    forbiddenKeys.forEach((key) => {
      expect(env).not.toHaveProperty(key);
    });
  });
});
