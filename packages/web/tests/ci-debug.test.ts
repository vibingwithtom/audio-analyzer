import { describe, it, expect } from 'vitest';

describe('CI Debug', () => {
  it('should have node environment info', () => {
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Arch:', process.arch);
    console.log('CWD:', process.cwd());
    console.log('Env VITEST:', process.env.VITEST);
    console.log('document exists:', typeof document !== 'undefined');
    console.log('Text constructor exists:', typeof Text !== 'undefined');
    console.log('document.createTextNode exists:', typeof document?.createTextNode === 'function');
    console.log('document.createElement exists:', typeof document?.createElement === 'function');
    console.log('document.body exists:', typeof document?.body !== 'undefined');

    // Test DOM element creation
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      console.log('div created:', !!div);
      console.log('div.appendChild exists:', typeof div.appendChild === 'function');
      console.log('div.removeChild exists:', typeof div.removeChild === 'function');
      console.log('div.insertBefore exists:', typeof div.insertBefore === 'function');
      console.log('div constructor:', div.constructor.name);

      // Test if we can append to body
      console.log('document.body.appendChild exists:', typeof document.body?.appendChild === 'function');
    }

    // Test createTextNode polyfill works
    if (typeof document !== 'undefined' && document.createTextNode) {
      const textNode = document.createTextNode('test');
      console.log('createTextNode test - nodeType:', textNode.nodeType);
      console.log('createTextNode test - textContent:', textNode.textContent);
      console.log('createTextNode test - constructor:', textNode.constructor.name);
      expect(textNode.nodeType).toBe(3);
      expect(textNode.textContent).toBe('test');
    }

    expect(true).toBe(true);
  });
});
