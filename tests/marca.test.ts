import { describe, it, expect } from 'vitest'
import { validarCaptura, MAX_BYTES_CAPTURA, type Captura } from '@maquina/core'

const base: Captura = { titulo: 't', subtitulo: 's', aviso: 'a', tiposMime: ['image/'], maxBytes: MAX_BYTES_CAPTURA, montarEntrada: (f) => f }
const marca = { nome: 'Tinha Print', destaque: 'Print', promessa: 'p', passos: [{ titulo: 'a', texto: 'b' }], perguntas: [], limites: ['x'] }

describe('marca da captura', () => {
  it('sem marca é válido', () => expect(validarCaptura(base)).toEqual([]))
  it('marca completa é válida', () => expect(validarCaptura({ ...base, marca })).toEqual([]))
  it('destaque precisa ser o final do nome', () => expect(validarCaptura({ ...base, marca: { ...marca, destaque: 'Tinha' } })).toHaveLength(1))
  it('exige passos e limites', () => {
    expect(validarCaptura({ ...base, marca: { ...marca, passos: [] } })).toHaveLength(1)
    expect(validarCaptura({ ...base, marca: { ...marca, limites: [] } })).toHaveLength(1)
  })
})

describe('base legal e planos na marca', () => {
  const item = { norma: 'CPC, art. 369', trecho: 't', link: 'https://www.planalto.gov.br/x', leitura: 'l' }
  it('aceita base legal com fonte https e ressalva', () => expect(validarCaptura({ ...base, marca: { ...marca, baseLegal: { intro: 'i', itens: [item], ressalva: 'r' } } })).toEqual([]))
  it('recusa norma sem link https (sem fonte não entra)', () => expect(validarCaptura({ ...base, marca: { ...marca, baseLegal: { intro: 'i', itens: [{ ...item, link: 'planalto' }], ressalva: 'r' } } })).toHaveLength(1))
  it('exige ressalva do que não foi confirmado', () => expect(validarCaptura({ ...base, marca: { ...marca, baseLegal: { intro: 'i', itens: [item], ressalva: '' } } })).toHaveLength(1))
  it('plano precisa dizer o que inclui', () => expect(validarCaptura({ ...base, marca: { ...marca, planos: [{ nome: 'A', preco: 'R$ 1', unidade: 'x', inclui: [] }] } })).toHaveLength(1))
})
