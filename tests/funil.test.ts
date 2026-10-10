import { describe, it, expect } from 'vitest'
import { normalizarOrigem, origemDoPedido } from '../apps/runtime/src/vitrine'

describe('funil: origem da visita', () => {
  it('redes e buscadores conhecidos viram um rótulo curto', () => {
    expect(normalizarOrigem('l.instagram.com')).toBe('instagram')
    expect(normalizarOrigem('https://lm.facebook.com/l.php?u=xyz')).toBe('facebook')
    expect(normalizarOrigem('wa.me')).toBe('whatsapp')
    expect(normalizarOrigem('www.google.com.br')).toBe('google')
    expect(normalizarOrigem('t.co')).toBe('x')
    expect(normalizarOrigem('mail.google.com')).toBe('email')
    expect(normalizarOrigem('chatgpt.com')).toBe('chatgpt')
    expect(normalizarOrigem('Instagram')).toBe('instagram')
    expect(normalizarOrigem('zap')).toBe('whatsapp')
  })

  it('outro site guarda só o domínio, nunca caminho ou parâmetro', () => {
    expect(normalizarOrigem('https://www.jusbrasil.com.br/artigos/abc?id=123')).toBe('jusbrasil.com.br')
    expect(normalizarOrigem('netflix.com')).toBe('netflix.com')
  })

  it('utm_source simples vira campanha; lixo vira "outro"; vazio é "direto"', () => {
    expect(normalizarOrigem('panfleto-centro')).toBe('utm:panfleto-centro')
    expect(normalizarOrigem('<script>alert(1)</script>')).toBe('outro')
    expect(normalizarOrigem('a b c')).toBe('outro')
    expect(normalizarOrigem('')).toBe('direto')
    expect(normalizarOrigem(undefined)).toBe('direto')
    expect(normalizarOrigem(42)).toBe('direto')
  })

  it('origem do pedido do servidor: cabeçalho ausente é "desconhecida"', () => {
    const c = (v?: string) => ({ req: { header: (n: string) => (n === 'x-funil-origem' ? v : undefined) } })
    expect(origemDoPedido(c())).toBe('desconhecida')
    expect(origemDoPedido(c(encodeURIComponent('l.instagram.com')))).toBe('l.instagram.com')
    expect(origemDoPedido(c('%E0%A4%A'))).toBe('outro')
  })
})
