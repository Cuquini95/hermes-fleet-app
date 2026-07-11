import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./ChatInput.tsx', import.meta.url), 'utf8');

describe('ChatInput image picker contract', () => {
  it('accepts image files from the device picker', () => {
    expect(source).toContain('type="file"');
    expect(source).toContain('accept="image/*"');
  });

  it('does not force mobile devices directly into camera capture', () => {
    expect(source).not.toContain('capture="environment"');
    expect(source).not.toContain('capture=');
  });

  it('labels the control as an image attachment action', () => {
    expect(source).toContain('ImagePlus');
    expect(source).toContain('aria-label="Adjuntar imagen"');
  });
});
