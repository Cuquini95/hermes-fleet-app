import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    expect(source).toContain('header.aprobada_por')
    expect(source).toContain('header.oc_id')
  })
})
