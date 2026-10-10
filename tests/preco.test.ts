import { describe, it, expect } from 'vitest'
import { validarPreco, margemPorCaso, cobraAgora, type Preco } from '@maquina/core'

const base: Preco = { modelo: 'por_caso', centavos: 4900, gratis: 'diagnóstico', pago: 'minuta pronta', custoPorCasoCentavos: 1200 }

describe('preço como dado', () => {
  it('aceita por_caso válido e calcula margem', () => {
    expect(validarPreco(base)).toEqual([])
    expect(margemPorCaso(base)).toBe(3700)
    expect(cobraAgora(base)).toBe(true)
  })
  it('exige valor e o que é pago quando cobra', () => {
    expect(validarPreco({ ...base, centavos: 0 }).length).toBeGreaterThan(0)
    expect(validarPreco({ ...base, pago: undefined })).toContain('preco.pago é obrigatório: diga o que se paga')
  })
  it('exige o que é grátis (a checagem)', () => {
    expect(validarPreco({ ...base, gratis: '' }).length).toBeGreaterThan(0)
  })
  it('fração tem limites e não tem margem fixa', () => {
    const f: Preco = { modelo: 'fracao', fracaoPct: 10, gratis: 'cálculo', pago: 'recuperação', custoPorCasoCentavos: 0 }
    expect(validarPreco(f)).toEqual([])
    expect(validarPreco({ ...f, fracaoPct: 80 }).length).toBeGreaterThan(0)
    expect(margemPorCaso(f)).toBeNull()
    expect(cobraAgora(f)).toBe(false)
  })
  it('interno e grátis não cobram', () => {
    expect(cobraAgora({ modelo: 'interno', gratis: 'x', custoPorCasoCentavos: 0 })).toBe(false)
    expect(cobraAgora(undefined)).toBe(false)
  })
  it('custo negativo ou fracionado é inválido', () => {
    expect(validarPreco({ ...base, custoPorCasoCentavos: -1 }).length).toBeGreaterThan(0)
    expect(validarPreco({ ...base, custoPorCasoCentavos: 1.5 }).length).toBeGreaterThan(0)
  })
})
