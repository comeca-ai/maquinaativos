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
