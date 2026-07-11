import { afterEach, describe, expect, it, vi } from 'vitest';
import { fallaSavedMessage, uploadFallaPhotos } from './falla-submit';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadFallaPhotos', () => {
  it('uploads every selected photo before allowing the report to continue', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1770000000000);
    const files = [
      new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
    ];
    const upload = vi
      .fn()
      .mockResolvedValueOnce('https://cdn.example.test/falla/one.jpg')
      .mockResolvedValueOnce('https://cdn.example.test/falla/two.jpg');

    const result = await uploadFallaPhotos(files, upload);

    expect(upload).toHaveBeenNthCalledWith(1, files[0], 'falla-photos', '1770000000000-0');
    expect(upload).toHaveBeenNthCalledWith(2, files[1], 'falla-photos', '1770000000000-1');
    expect(result).toEqual({
      urls: [
        'https://cdn.example.test/falla/one.jpg',
        'https://cdn.example.test/falla/two.jpg',
      ],
    });
  });

  it('blocks the report when any selected photo upload fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1770000000000);
    const files = [
      new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
    ];
    const upload = vi
      .fn()
      .mockResolvedValueOnce('https://cdn.example.test/falla/one.jpg')
      .mockResolvedValueOnce('');

    await expect(uploadFallaPhotos(files, upload)).rejects.toThrow('No se pudieron subir todas las fotos');
  });
});

describe('fallaSavedMessage', () => {
  it('confirms the report only after required photo uploads have succeeded', () => {
    expect(fallaSavedMessage('OT-123')).toBe('OT-123 creada - Jefe de Taller notificado');
  });
});
