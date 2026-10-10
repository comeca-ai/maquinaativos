import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineProduto, executar, validarProduto, somarDias, cpfValido, cnpjValido, normalizarPlaca, reaisParaCentavos, somarDiasUteis, ehDiaUtil, diasEntre } from '@maquina/core'

const ok = {
  nome: 'exemplo',
  versao: 'v1' as const,
  entrada: z.object({ n: z.number() }),
  estados: { a: { final: false as const, prazoDias: 3 }, b: { final: true as const } },
  estadoInicial: 'a' as const,
  motivos: { esperando: 'a', pronto: 'b' } as const,
  regra: (c: { n: number }) => (c.n > 0 ? { estado: 'b' as const, motivo: 'pronto' as const } : { estado: 'a' as const, motivo: 'esperando' as const }),
  criterioDeMorte: { prazoDias: 3, metrica: 'n', minimo: 1 },
  naoFaremos: ['x'],
}

describe('defineProduto', () => {
  it('aceita contrato válido', () => expect(() => defineProduto(ok)).not.toThrow())
  it('recusa estado não-final sem prazo', () => {
    expect(validarProduto({ ...ok, estados: { a: { final: false, prazoDias: 0 }, b: { final: true } } } as never)).toContain('estado "a" não é final e não tem prazoDias > 0')
  })
  it('recusa sem estado final', () => {
    expect(validarProduto({ ...ok, estados: { a: { final: false, prazoDias: 1 }, b: { final: false, prazoDias: 1 } } } as never)).toContain('precisa de ao menos um estado final')
  })
  it('recusa motivo para estado inexistente', () => {
    expect(validarProduto({ ...ok, motivos: { esperando: 'a', pronto: 'zzz' } } as never).join()).toContain('inexistente')
  })
  it('recusa naoFaremos vazio', () => {
    expect(validarProduto({ ...ok, naoFaremos: [] } as never).join()).toContain('naoFaremos')
  })
})

describe('executar', () => {
  const p = defineProduto(ok)
  it('devolve transição com prazo para estado não-final', async () => {
    const r = await executar(p, { n: 0 }, { hoje: '2026-03-02' })
    expect(r.ok && r.transicao.prazoAte).toBe('2026-03-05')
  })
  it('estado final não tem prazo', async () => {
    const r = await executar(p, { n: 1 }, { hoje: '2026-03-02' })
    expect(r.ok && r.transicao.final && r.transicao.prazoAte).toBe(null)
  })
  it('entrada inválida não vira estado', async () => {
    const r = await executar(p, { n: 'x' }, { hoje: '2026-03-02' })
    expect(r.ok).toBe(false)
  })
  it('hash da entrada é estável', async () => {
    const a = await executar(p, { n: 1 }, { hoje: '2026-03-02' })
    const b = await executar(p, { n: 1 }, { hoje: '2026-03-09' })
    expect(a.ok && b.ok && a.transicao.hashEntrada === b.transicao.hashEntrada).toBe(true)
  })
  it('recusa regra que mente: motivo de outro estado', async () => {
    const mente = defineProduto({ ...ok, regra: () => ({ estado: 'a' as const, motivo: 'pronto' as const }) })
    await expect(executar(mente, { n: 1 }, { hoje: '2026-03-02' })).rejects.toThrow(/pertence ao estado/)
  })
})

describe('ontologia brasileira', () => {
  it('cpf', () => { expect(cpfValido('529.982.247-25')).toBe(true); expect(cpfValido('111.111.111-11')).toBe(false); expect(cpfValido('529.982.247-24')).toBe(false) })
  it('cnpj', () => { expect(cnpjValido('11.222.333/0001-81')).toBe(true); expect(cnpjValido('11.222.333/0001-80')).toBe(false) })
  it('placa antiga e mercosul', () => { expect(normalizarPlaca('abc-1234')).toBe('ABC1234'); expect(normalizarPlaca('BRA1D23')).toBe('BRA1D23'); expect(normalizarPlaca('1234ABC')).toBe(null) })
  it('dinheiro em centavos', () => { expect(reaisParaCentavos('R$ 1.234,56')).toBe(123456); expect(reaisParaCentavos(0.1 + 0.2)).toBe(30) })
  it('dias úteis com feriado', () => {
    expect(ehDiaUtil('2026-03-07')).toBe(false) // sábado
    expect(somarDiasUteis('2026-03-06', 1)).toBe('2026-03-09') // sexta -> segunda
    expect(somarDiasUteis('2026-03-06', 1, ['2026-03-09'])).toBe('2026-03-10')
  })
  it('datas', () => { expect(somarDias('2026-02-27', 3)).toBe('2026-03-02'); expect(diasEntre('2026-03-01', '2026-03-15')).toBe(14) })
})

import { validarTela, montarEntrada, type Tela } from '@maquina/core'

describe('tela declarativa', () => {
  const tela: Tela = {
    titulo: 'T', subtitulo: 'S', aviso: 'A',
    campos: [
      { nome: 'quando', rotulo: 'Quando', tipo: 'data' },
      { nome: 'depois', rotulo: 'Depois', tipo: 'data', opcional: true },
      { nome: 'flagrante', rotulo: 'No ato?', tipo: 'sim_nao' },
    ],
    fixos: { extras: [] },
    resultados: { a: { titulo: 'x', explicacao: 'y', tom: 'ok' }, b: { titulo: 'x', explicacao: 'y', tom: 'ok' } },
    oferecerAjudaEm: ['a'],
    textoAjuda: 'ajuda',
  }
  it('exige texto para toda motivo', () => {
    expect(validarTela(tela, ['a', 'b'])).toEqual([])
    expect(validarTela(tela, ['a', 'b', 'c']).join()).toContain('motivo "c" não tem texto')
  })
  it('recusa oferecerAjudaEm inexistente', () => {
    expect(validarTela({ ...tela, oferecerAjudaEm: ['zzz'] }, ['a', 'b']).join()).toContain('inexistente')
  })
  it('monta a entrada: data opcional vazia vira null, sim_nao vira boolean, fixos entram', () => {
    expect(montarEntrada(tela, { quando: '2026-01-01', depois: '', flagrante: 'sim' })).toEqual({
      extras: [], quando: '2026-01-01', depois: null, flagrante: true,
    })
    expect(montarEntrada(tela, { quando: '', flagrante: false }).quando).toBeUndefined()
  })
})

describe('prazoAte definido pelo produto', () => {
  it('usa a data de fato em vez de hoje + prazoDias', async () => {
    const { z } = await import('zod')
    const { defineProduto, executar } = await import('@maquina/core')
    const p = defineProduto({
      nome: 'prazo-fato', versao: 'v1', entrada: z.object({ desde: z.string() }),
      estados: { a: { final: false, prazoDias: 5 }, b: { final: true } }, estadoInicial: 'a',
      motivos: { m_a: 'a', m_b: 'b' }, regra: (): { estado: 'a' | 'b'; motivo: 'm_a' | 'm_b' } => ({ estado: 'a', motivo: 'm_a' }),
      prazoAte: (c) => c.desde, criterioDeMorte: { prazoDias: 1, metrica: 'x', minimo: 1 }, naoFaremos: ['x'],
    })
    const r = await executar(p, { desde: '2026-04-10' }, { hoje: '2026-04-01' })
    expect(r.ok && r.transicao.prazoAte).toBe('2026-04-10')
  })
})
