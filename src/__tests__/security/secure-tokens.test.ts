import { generateSecureToken } from '../../../convex/lib/secureTokens';

describe('secure token generation', () => {
  it('generates url-safe prefixed tokens with a timestamp', () => {
    const token = generateSecureToken('reset');
    expect(token).toMatch(/^reset_\d+_[a-f0-9]+$/);
  });

  it('produces unique tokens across calls', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      tokens.add(generateSecureToken('act'));
    }
    expect(tokens.size).toBe(50);
  });
});
