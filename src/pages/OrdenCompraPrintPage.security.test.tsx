import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isApprovalRecorded } from '../lib/purchasing-api'

describe('OrdenCompraPrintPage approval integrity', () => {
  const sourcePath = resolve(process.cwd(), 'src/pages/OrdenCompraPrintPage.tsx')
  const source = readFileSync(sourcePath, 'utf8')

  it('does not embed a reusable personal signature image', () => {
    expect(source).not.toContain('signature-tomas.png')
    expect(existsSync(resolve(process.cwd(), 'public/signature-tomas.png'))).toBe(false)
  })

  it('prints auditable approval provenance instead', () => {
    expect(source).toContain('purchase-approval-provenance')
    expect(source).toContain('Autorización digital registrada')
    expect(source).toContain('order.approvedBy')
    expect(source).toContain('order.folio')
    expect(source).toContain('isApprovalRecorded(order)')
  })

  it('requires a verified user and time from the recorded approval', () => {
    const approval = { status: 'Recibida parcial', approvedBy: 'Compradora QA', approvedById: 'qa-5', approvedAt: '2026-11-12T06:00:00Z' }
    expect(isApprovalRecorded(approval)).toBe(true)
    expect(isApprovalRecorded({ ...approval, approvedById: '' })).toBe(false)
    expect(isApprovalRecorded({ ...approval, approvedAt: 'pendiente' })).toBe(false)
    expect(isApprovalRecorded({ ...approval, status: 'Borrador' })).toBe(false)
  })
})
