import { describe, it, expect } from 'vitest';

describe('CI Debug', () => {
  it('should have node environment info', () => {
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Arch:', process.arch);
    console.log('CWD:', process.cwd());
    console.log('Env VITEST:', process.env.VITEST);
    console.log('document exists:', typeof document !== 'undefined');
    console.log('document.createTextNode exists:', typeof document?.createTextNode === 'function');
    console.log('document.createElement exists:', typeof document?.createElement === 'function');

    // Test createTextNode polyfill works
    if (typeof document !== 'undefined' && document.createTextNode) {
      const textNode = document.createTextNode('test');
      console.log('createTextNode test - nodeType:', textNode.nodeType);
      console.log('createTextNode test - textContent:', textNode.textContent);
      expect(textNode.nodeType).toBe(3);
      expect(textNode.textContent).toBe('test');
    }

    expect(true).toBe(true);
  });
});
