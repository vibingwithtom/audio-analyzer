import { describe, it, expect } from 'vitest';

describe('CI Debug', () => {
  it('should have node environment info', () => {
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Arch:', process.arch);
    console.log('CWD:', process.cwd());
    console.log('Env VITEST:', process.env.VITEST);
    expect(true).toBe(true);
  });
});
