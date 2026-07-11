import { afterEach, describe, expect, it, vi } from 'vitest';
import { fallaSavedMessage, uploadFallaPhotos } from './falla-submit';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadFallaPhotos', () => {
  it('keeps successful URLs and reports failed photo uploads without blocking the report', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1770000000000);
    const files = [
      new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
    ];
    const upload = vi
      .fn()
      .mockResolvedValueOnce('https://cdn.example.test/falla/one.jpg')
      .mockResolvedValueOnce('');

    const result = await uploadFallaPhotos(files, upload);

    expect(upload).toHaveBeenNthCalledWith(1, files[0], 'falla-photos', '1770000000000-0');
    expect(upload).toHaveBeenNthCalledWith(2, files[1], 'falla-photos', '1770000000000-1');
    expect(result).toEqual({
      urls: ['https://cdn.example.test/falla/one.jpg'],
      failedCount: 1,
    });
  });
});

describe('fallaSavedMessage', () => {
  it('confirms the report was created even when photo upload failed', () => {
    expect(fallaSavedMessage('OT-123', 2)).toContain('OT-123 creada');
    expect(fallaSavedMessage('OT-123', 2)).toContain('2 foto(s) no subieron');
  });
});
