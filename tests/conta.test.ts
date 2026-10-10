import { describe, it, expect } from 'vitest'
import { cookieSessao, lerCookie, normalizarEmail, remetente, tokenAleatorio, tokenValido, hmacHex } from '../apps/runtime/src/sessao'

describe('link mágico: utilitários puros', () => {
  it('token tem 256 bits em base64url e é sempre diferente', () => {
    const a = tokenAleatorio(), b = tokenAleatorio()
    expect(tokenValido(a)).toBe(true)
    expect(a).toHaveLength(43)
    expect(a).not.toBe(b)
    expect(tokenValido('curto')).toBe(false)
    expect(tokenValido(a + '=')).toBe(false)
  })

  it('normaliza e-mail e recusa lixo', () => {
    expect(normalizarEmail('  Maria.Silva+prova@Exemplo.com.BR ')).toBe('maria.silva+prova@exemplo.com.br')
    expect(normalizarEmail('sem-arroba')).toBeNull()
    expect(normalizarEmail('a@b')).toBeNull()
    expect(normalizarEmail('x <a@b.com>')).toBeNull()
    expect(normalizarEmail(42)).toBeNull()
  })

  it('cookie de sessão é HttpOnly, SameSite=Lax e Secure só em https', () => {
    const c = cookieSessao('abc', true)
    expect(c).toMatch(/HttpOnly/)
    expect(c).toMatch(/SameSite=Lax/)
    expect(c).toMatch(/Secure/)
    expect(cookieSessao('abc', false)).not.toMatch(/Secure/)
    expect(cookieSessao('', true, 0)).toMatch(/Max-Age=0/)
  })

  it('lê o cookie certo entre vários', () => {
    expect(lerCookie('a=1; sessao=xyz; b=2', 'sessao')).toBe('xyz')
    expect(lerCookie('xsessao=1', 'sessao')).toBeNull()
    expect(lerCookie(undefined, 'sessao')).toBeNull()
  })

  it('remetente aceita "Nome <email>"', () => {
    expect(remetente('Tinha Print <acesso@tinhaprint.com.br>')).toEqual({ name: 'Tinha Print', email: 'acesso@tinhaprint.com.br' })
    expect(remetente('acesso@x.com')).toBe('acesso@x.com')
  })

  it('HMAC do e-mail é estável e depende da chave', async () => {
    const a = await hmacHex('k1', 'email:a@b.com')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hmacHex('k1', 'email:a@b.com')).toBe(a)
    expect(await hmacHex('k2', 'email:a@b.com')).not.toBe(a)
  })
})
