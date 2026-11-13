import { z } from 'zod';

const documentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  kind: z.enum(['manual', 'diagram']),
  model: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(180),
  url: z.string().regex(/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/),
});
const catalogSchema = z.array(documentSchema).max(250);
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function technicalDocuments(configured, query = {}) {
  let documents;
  try {
    documents = catalogSchema.parse(JSON.parse(configured || 'null'));
  } catch {
    return { status: 503, body: { error: 'La biblioteca técnica de Panamá está pendiente de configuración.' } };
  }
  const { kind, q } = query;
  if ((kind !== undefined && !['manual', 'diagram'].includes(kind))
    || (q !== undefined && (typeof q !== 'string' || q.length > 120))) {
    return { status: 400, body: { error: 'La búsqueda de documentos es inválida.' } };
  }
  const words = typeof q === 'string' ? q.trim().split(/\s+/).map(normalize).filter(Boolean) : [];
  return {
    status: 200,
    body: { documents: documents.filter(doc => {
      if (kind && doc.kind !== kind) return false;
      const searchable = normalize([doc.title, doc.model, doc.source].join(' '));
      return words.every(word => searchable.includes(word));
    }) },
  };
}
