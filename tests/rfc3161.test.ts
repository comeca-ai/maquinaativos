import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { pedidoCarimbo, lerRespostaCarimbo, hexDe } from '@maquina/kits'

// Resposta REAL de um servidor RFC 3161 público (freetsa.org, NÃO é ICP-Brasil), gerada pelo próprio kit em 10/10/2026
// e conferida com `openssl ts -verify` (Verification: OK). Serve para provar o formato, não o valor jurídico.
const resposta = new Uint8Array(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'rfc3161-freetsa.tsr')))
const hashDoManifesto = createHash('sha256').update('manifesto de teste do tinhaprint\n').digest('hex')

describe('carimbo de tempo RFC 3161', () => {
  it('monta um TimeStampReq DER válido (versão 1, sha256, nonce, certReq)', () => {
    const req = pedidoCarimbo(hashDoManifesto, 'sha256', Uint8Array.of(0x05, 0x46, 0x6d, 0xfd))
    expect(req[0]).toBe(0x30)
    expect(hexDe(req)).toContain('020101') // version 1
    expect(hexDe(req)).toContain('0609608648016503040201') // OID sha256
    expect(hexDe(req)).toContain(hashDoManifesto)
    expect(hexDe(req).endsWith('0101ff')).toBe(true) // certReq TRUE
  })

  it('recusa hash com tamanho errado', () => {
    expect(() => pedidoCarimbo('abc', 'sha256', Uint8Array.of(1))).toThrow()
    expect(() => pedidoCarimbo(hashDoManifesto, 'sha512', Uint8Array.of(1))).toThrow()
  })

  it('lê a resposta real: status concedido, hash carimbado, hora e nonce', () => {
    const r = lerRespostaCarimbo(resposta)
    expect(r.status).toBe(0)
    expect(r.token?.[0]).toBe(0x30)
    expect(r.info?.hashCarimbado).toBe(hashDoManifesto)
    expect(r.info?.algHash).toBe('sha256')
    expect(r.info?.geradoEm).toMatch(/^2026-10-10T\d{2}:\d{2}:\d{2}Z$/)
    expect(r.info?.nonce).toMatch(/^[0-9a-f]+$/)
  })

  it('lê também só o token (ContentInfo), sem o envelope de status', () => {
    const { token } = lerRespostaCarimbo(resposta)
    expect(lerRespostaCarimbo(token!).info?.hashCarimbado).toBe(hashDoManifesto)
  })
})
