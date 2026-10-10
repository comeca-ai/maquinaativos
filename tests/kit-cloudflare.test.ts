import { describe, it, expect } from 'vitest'
import { cloudflare, configDoAmbiente, ErroCloudflare } from '../packages/kits/src/cloudflare'

function falso(resposta: unknown, status = 200) {
  const chamadas: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    return new Response(JSON.stringify(resposta), { status })
  }) as unknown as typeof fetch
  return { f, chamadas }
}

describe('kit cloudflare', () => {
  it('monta rota da conta, envia Bearer e devolve o result', async () => {
    const { f, chamadas } = falso({ success: true, result: [{ uuid: 'u1', name: 'maquina' }] })
    const cf = cloudflare({ accountId: 'ACC', apiToken: 'TOK', fetch: f })
    expect(await cf.d1.listar()).toEqual([{ uuid: 'u1', name: 'maquina' }])
    expect(chamadas[0]!.url).toBe('https://api.cloudflare.com/client/v4/accounts/ACC/d1/database')
    expect((chamadas[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer TOK')
  })
  it('d1.consultar manda sql e params', async () => {
    const { f, chamadas } = falso({ success: true, result: [{ results: [], success: true, meta: {} }] })
    await cloudflare({ accountId: 'A', apiToken: 'T', fetch: f }).d1.consultar('db1', 'SELECT ?', [1])
    expect(JSON.parse(chamadas[0]!.init.body as string)).toEqual({ sql: 'SELECT ?', params: [1] })
  })
  it('r2.listarBuckets desembrulha buckets', async () => {
    const { f } = falso({ success: true, result: { buckets: [{ name: 'b', creation_date: 'x' }] } })
    expect(await cloudflare({ accountId: 'A', apiToken: 'T', fetch: f }).r2.listarBuckets()).toEqual([{ name: 'b', creation_date: 'x' }])
  })
  it('erro da API vira ErroCloudflare sem vazar o token', async () => {
    const { f } = falso({ success: false, result: null, errors: [{ code: 10000, message: 'Authentication error' }] }, 403)
    const cf = cloudflare({ accountId: 'A', apiToken: 'SEGREDO', fetch: f })
    const e = await cf.workers.listar().catch((x) => x)
    expect(e).toBeInstanceOf(ErroCloudflare)
    expect(String(e.message)).toContain('10000')
    expect(String(e.message)).not.toContain('SEGREDO')
  })
  it('config do ambiente exige as duas variáveis', () => {
    expect(() => configDoAmbiente({})).toThrow(/CLOUDFLARE_ACCOUNT_ID/)
    expect(configDoAmbiente({ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' })).toEqual({ accountId: 'a', apiToken: 't' })
  })
})
