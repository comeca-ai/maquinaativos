import { describe, it, expect } from 'vitest'
import { ancorar, atualizar, lerOts, montarOts, pendentes, alturasBitcoin, deHex, hex } from '@maquina/kits'

// Vetores gerados com a biblioteca oficial (python-opentimestamps 0.4.x): cadeia típica de calendário e uma resposta de upgrade com bloco 840000.
const DIGEST = '64354eac0b09dc32ca9bd688532497124d708560f4970cf77f2e5189cd68599d'
const CAL_A = 'f0101111111111111111111111111111111108f1082222222222222222080083dfe30d2ef90c8e222168747470733a2f2f612e706f6f6c2e6f70656e74696d657374616d70732e6f7267'
const CAL_B = 'f0101111111111111111111111111111111108f1082222222222222222080083dfe30d2ef90c8e222168747470733a2f2f622e706f6f6c2e6f70656e74696d657374616d70732e6f7267'
const COMMITMENT = 'b95549f6a999c10959dbe83aa385c2248380467c4d1cf8085e5a6135f1bfdf28'
const UPGRADE = '000588960d73d7190103c0a233'

const resp = (h: string) => new Response(deHex(h), { status: 200 })
const cals = ['https://a.pool.opentimestamps.org', 'https://b.pool.opentimestamps.org', 'https://a.pool.eternitywall.com']

function fakeFetch(opts: { upgrade?: boolean } = {}) {
  const chamadas: string[] = []
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === 'https://a.pool.opentimestamps.org/digest') return resp(CAL_A)
    if (url === 'https://b.pool.opentimestamps.org/digest') return resp(CAL_B)
    if (url.endsWith('/digest')) return new Response('erro', { status: 503 })
    if (opts.upgrade && url === `https://a.pool.opentimestamps.org/timestamp/${COMMITMENT}`) return resp(UPGRADE)
    return new Response('nao', { status: 404 })
  }) as unknown as typeof fetch
  return { f, chamadas }
}

describe('OpenTimestamps', () => {
  it('ancora: funde calendários que responderam e ignora os que falharam', async () => {
    const { f } = fakeFetch()
    const { ots, calendarios } = await ancorar(DIGEST, { fetch: f, calendarios: cals })
    expect(calendarios).toEqual(cals.slice(0, 2))
    const lido = lerOts(ots)
    expect(lido.digestHex).toBe(DIGEST)
    expect(pendentes(ots).sort()).toEqual(cals.slice(0, 2))
    expect(alturasBitcoin(ots)).toEqual([])
    expect(hex(montarOts(lido.digestHex, lido.raiz))).toBe(hex(ots)) // ida e volta sem perda
  })

  it('envia o digest cru (32 bytes) por POST', async () => {
    const { f, chamadas } = fakeFetch()
    await ancorar(DIGEST, { fetch: f, calendarios: cals })
    expect(chamadas).toContain('POST https://a.pool.opentimestamps.org/digest')
  })

  it('falha se nenhum calendário responde', async () => {
    const f = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    await expect(ancorar(DIGEST, { fetch: f, calendarios: cals })).rejects.toThrow(/nenhum calendário/)
  })

  it('recusa digest que não é SHA-256 hex', async () => {
    await expect(ancorar('abc', { fetch: fakeFetch().f })).rejects.toThrow()
  })

  it('atualizar promove a Bitcoin só o calendário que já confirmou', async () => {
    const { f } = fakeFetch()
    const { ots } = await ancorar(DIGEST, { fetch: f, calendarios: cals })
    const { f: f2, chamadas } = fakeFetch({ upgrade: true })
    const r = await atualizar(ots, { fetch: f2, calendarios: cals })
    expect(r.mudou).toBe(true)
    expect(r.alturas).toEqual([840000])
    expect(pendentes(r.ots)).toEqual(['https://b.pool.opentimestamps.org']) // b ainda não confirmou
    expect(chamadas).toContain(`GET https://a.pool.opentimestamps.org/timestamp/${COMMITMENT}`)
  })

  it('atualizar sem confirmação devolve o mesmo arquivo', async () => {
    const { f } = fakeFetch()
    const { ots } = await ancorar(DIGEST, { fetch: f, calendarios: cals })
    const r = await atualizar(ots, { fetch: f, calendarios: cals })
    expect(r.mudou).toBe(false)
    expect(hex(r.ots)).toBe(hex(ots))
  })

  it('não consulta URI fora da lista de calendários (SSRF)', async () => {
    const { f } = fakeFetch()
    const { ots } = await ancorar(DIGEST, { fetch: f, calendarios: cals })
    const { f: f2, chamadas } = fakeFetch({ upgrade: true })
    const r = await atualizar(ots, { fetch: f2, calendarios: ['https://outro.exemplo'] })
    expect(r.mudou).toBe(false)
    expect(chamadas).toEqual([])
  })

  it('rejeita arquivo que não é .ots e bytes sobrando', () => {
    expect(() => lerOts(new Uint8Array([1, 2, 3]))).toThrow()
  })
})
