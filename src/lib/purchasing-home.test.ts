import { describe, expect, it } from 'vitest';
import { canOpenPanamaPayables, purchasingEntry, sessionHome } from './purchasing-home';

const panama = { project: 'tmf-panama', role: 'gerencia' } as const;

describe('inicio por permiso de compras en Panamá', () => {
  it.each([
    [{ ...panama, canApprovePurchases: true }, '/pedidos', 'Pedidos'],
    [{ ...panama, role: 'jefe_taller', canReceivePurchases: true }, '/panama/recepciones', 'Recepciones'],
    [{ ...panama, canRecordPurchaseInvoices: true }, '/panama/cuentas-por-pagar?bandeja=conciliar#facturas', 'Por conciliar'],
    [{ ...panama, canRecordPurchasePayments: true }, '/panama/cuentas-por-pagar?bandeja=pagar#facturas', 'Por pagar'],
  ] as const)('resuelve el inicio de %o', (profile, path, label) => {
    expect(sessionHome(profile)).toBe(path);
    expect(purchasingEntry(profile)).toMatchObject({ path, label });
  });

  it('respeta los enlaces internos guardados, incluidos sus filtros y anclas', () => {
    const profile = { ...panama, canRecordPurchasePayments: true };
    expect(sessionHome(profile, '/panama/cuentas-por-pagar#saldos')).toBe('/panama/cuentas-por-pagar#saldos');
    expect(sessionHome(profile, '/admin/ordenes-compra?pedido=1#folio')).toBe('/admin/ordenes-compra?pedido=1#folio');
    expect(sessionHome(profile, '//externo.example')).toBe('/panama/cuentas-por-pagar?bandeja=pagar#facturas');
    expect(sessionHome(profile, '/\\externo.example')).toBe('/panama/cuentas-por-pagar?bandeja=pagar#facturas');
  });

  it('limita el acceso de cuentas por pagar de la demo a puestos de finanzas autorizados', () => {
    expect(canOpenPanamaPayables({ ...panama, canRecordPurchasePayments: true, previewDemo: true })).toBe(true);
    expect(canOpenPanamaPayables({ ...panama, canRecordPurchaseInvoices: true, previewDemo: true })).toBe(true);
    expect(canOpenPanamaPayables({ ...panama, canApprovePurchases: true, previewDemo: true })).toBe(false);
    expect(canOpenPanamaPayables({ ...panama, canReceivePurchases: true, previewDemo: true })).toBe(false);
    expect(canOpenPanamaPayables({ ...panama, canRecordPurchaseInvoices: true, canRecordPurchasePayments: true, previewDemo: true })).toBe(false);
    expect(canOpenPanamaPayables({ ...panama, project: 'mexico', canRecordPurchaseInvoices: true })).toBe(false);
  });

  it('mantiene al gerente sin bandeja asignada cuando los permisos de finanzas son incompatibles', () => {
    expect(sessionHome({ ...panama, canRecordPurchaseInvoices: true, canRecordPurchasePayments: true })).toBe('/dashboard');
    expect(sessionHome({ ...panama, role: 'jefe_taller', canRecordPurchaseInvoices: true })).toBe('/workshop');
    expect(sessionHome({ ...panama, canApprovePurchases: true, canReceivePurchases: true })).toBe('/pedidos');
  });

  it('conserva el inicio habitual fuera de compras de Panamá', () => {
    expect(sessionHome(panama)).toBe('/dashboard');
    expect(sessionHome({ ...panama, project: 'mexico', canApprovePurchases: true })).toBe('/dashboard');
    expect(sessionHome({ ...panama, role: 'mecanico' })).toBe('/mechanic');
    expect(sessionHome({ ...panama, role: null })).toBe('/');
  });
});
