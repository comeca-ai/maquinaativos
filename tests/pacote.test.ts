import { describe, it, expect } from 'vitest'
import { verificarPacote, montarOts } from '@maquina/kits'
import { sha256, jsonEstavel } from '@maquina/core'

const enc = new TextEncoder()
const raizPendente = (uri: string) => {
  const u = enc.encode(uri)
  return { atestados: [{ tag: '83dfe30d2ef90c8e', payload: Uint8Array.from([u.length, ...u]) }], ops: [] }
}
async function pacote(adultera = false) {
  const arquivo = enc.encode('conteudo da prova')
  const h = await sha256('conteudo da prova')
  const manifesto = enc.encode(jsonEstavel({ arquivo: { nome: 'a.txt', bytes: arquivo.length, sha256: h } }))
  const hm = await sha256(new TextDecoder().decode(manifesto))
  const ots = montarOts(hm, raizPendente('https://alice.btc.calendar.opentimestamps.org'))
  return [{ nome: 'a.txt', dados: adultera ? enc.encode('conteudo ALTERADO!!') : arquivo }, { nome: 'manifesto.json', dados: manifesto }, { nome: 'prova.ots', dados: ots }, { nome: 'LEIA-ME.txt', dados: enc.encode('x') }]
}

describe('verificador offline do pacote', () => {
  it('pacote íntegro com carimbo pendente', async () => {
    const r = await verificarPacote(await pacote())
    expect(r.integro).toBe(true)
    expect(r.ots).toBe('pendente')
  })
  it('arquivo adulterado é detectado', async () => {
    const r = await verificarPacote(await pacote(true))
    expect(r.integro).toBe(false)
    expect(r.itens.some((i) => !i.ok && /DIFERE/.test(i.texto))).toBe(true)
  })
  it('manifesto adulterado não bate com o digest carimbado', async () => {
    const p = await pacote()
    p[1] = { nome: 'manifesto.json', dados: enc.encode(new TextDecoder().decode(p[1]!.dados).replace('a.txt', 'b.txt')) }
    const r = await verificarPacote(p)
    expect(r.integro).toBe(false)
  })
  it('sem prova.ots não é íntegro: falta o carimbo', async () => {
    const p = (await pacote()).filter((x) => x.nome !== 'prova.ots')
    const r = await verificarPacote(p)
    expect(r.integro).toBe(false)
    expect(r.ots).toBe('ausente')
  })
  it('sem manifesto', async () => {
    const r = await verificarPacote((await pacote()).filter((x) => x.nome !== 'manifesto.json'))
    expect(r.integro).toBe(false)
  })
  it('RELATORIO.html lido antes do arquivo (ordem de pasta) não é confundido com o arquivo preservado', async () => {
    const p = await pacote()
    const r = await verificarPacote([{ nome: 'RELATORIO.html', dados: enc.encode('<html></html>') }, ...p])
    expect(r.integro).toBe(true)
  })
})
