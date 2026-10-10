import { describe, it, expect } from 'vitest'
import { zipStore, lerZipStore } from '@maquina/kits'

async function tudo(s: ReadableStream<Uint8Array>) {
  const partes: Uint8Array[] = []; const r = s.getReader()
  for (;;) { const { done, value } = await r.read(); if (done) break; partes.push(value) }
  const o = new Uint8Array(partes.reduce((n, x) => n + x.length, 0)); let i = 0
  for (const x of partes) { o.set(x, i); i += x.length }
  return o
}

describe('zip em streaming', () => {
  it('ida e volta com bytes e stream, nomes em UTF-8', async () => {
    const grande = new Uint8Array(300_000).map((_, i) => (i * 7) % 251)
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(grande.slice(0, 100_000)); c.enqueue(grande.slice(100_000)); c.close() } })
    const zip = await tudo(zipStore([{ nome: 'arquivo.bin', dados: stream }, { nome: 'leia-me ção.txt', dados: new TextEncoder().encode('olá') }]))
    const e = lerZipStore(zip)
    expect(e.map((x) => x.nome)).toEqual(['arquivo.bin', 'leia-me ção.txt'])
    expect(e[0]!.dados).toEqual(grande)
    expect(new TextDecoder().decode(e[1]!.dados)).toBe('olá')
  })
  it('entrada vazia', async () => {
    const e = lerZipStore(await tudo(zipStore([{ nome: 'vazio', dados: new Uint8Array() }])))
    expect(e[0]!.dados.length).toBe(0)
  })
  it('detecta corrupção pelo CRC', async () => {
    const zip = await tudo(zipStore([{ nome: 'a', dados: new TextEncoder().encode('conteudo importante') }]))
    zip[40] = zip[40]! ^ 0xff
    expect(() => lerZipStore(zip)).toThrow(/CRC/)
  })
})
