/**
 * Kit Cloudflare: chamadas à API REST da Cloudflare, tipadas, sem dependência.
 * Uso: ferramentas, scripts e agentes ANTES de publicar (criar banco, bucket, rodar modelo).
 * Em produção, o Worker usa BINDINGS (env.DB etc.), não este kit, e NUNCA guarda um token amplo como secret.
 */
export interface ConfigCloudflare {
  accountId: string
  apiToken: string
  /** Injetável para teste. */
  fetch?: typeof fetch
  baseUrl?: string
}

export class ErroCloudflare extends Error {
  status: number
  erros: { code: number; message: string }[]
  rota: string
  constructor(status: number, erros: { code: number; message: string }[], rota: string) {
    super(`Cloudflare ${status} em ${rota}: ${erros.map((e) => `${e.code} ${e.message}`).join('; ') || 'sem detalhe'}`)
    this.status = status
    this.erros = erros
    this.rota = rota
  }
}

interface Envelope<T> {
  success: boolean
  result: T
  errors?: { code: number; message: string }[]
}

export function cloudflare(cfg: ConfigCloudflare) {
  const f = cfg.fetch ?? fetch
  const base = cfg.baseUrl ?? 'https://api.cloudflare.com/client/v4'
  const conta = `/accounts/${cfg.accountId}`

  async function chamar<T>(metodo: string, rota: string, corpo?: unknown): Promise<T> {
    const r = await f(base + rota, {
      method: metodo,
      headers: { authorization: `Bearer ${cfg.apiToken}`, 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const j = (await r.json().catch(() => null)) as Envelope<T> | null
    if (!r.ok || !j?.success) throw new ErroCloudflare(r.status, j?.errors ?? [], `${metodo} ${rota}`)
    return j.result
  }

  return {
    /** Confirma que o token está ativo. */
    verificarToken: () => chamar<{ id: string; status: string }>('GET', `${conta}/tokens/verify`),

    d1: {
      listar: () => chamar<{ uuid: string; name: string }[]>('GET', `${conta}/d1/database`),
      criar: (nome: string, regiao?: 'wnam' | 'enam' | 'weur' | 'eeur' | 'apac' | 'oc') =>
        chamar<{ uuid: string; name: string }>('POST', `${conta}/d1/database`, { name: nome, primary_location_hint: regiao }),
      /** Roda SQL com parâmetros. Devolve um resultado por comando. */
      consultar: <L = Record<string, unknown>>(dbId: string, sql: string, params: unknown[] = []) =>
        chamar<{ results: L[]; success: boolean; meta: Record<string, unknown> }[]>('POST', `${conta}/d1/database/${dbId}/query`, { sql, params }),
    },

    r2: {
      listarBuckets: async () => (await chamar<{ buckets: { name: string; creation_date: string }[] }>('GET', `${conta}/r2/buckets`)).buckets,
      criarBucket: (nome: string) => chamar<{ name: string }>('POST', `${conta}/r2/buckets`, { name: nome }),
    },

    kv: {
      listarNamespaces: () => chamar<{ id: string; title: string }[]>('GET', `${conta}/storage/kv/namespaces`),
      criarNamespace: (titulo: string) => chamar<{ id: string; title: string }>('POST', `${conta}/storage/kv/namespaces`, { title: titulo }),
    },

    workers: {
      listar: () => chamar<{ id: string }[]>('GET', `${conta}/workers/scripts`),
    },

    /** Workers AI pela REST. Em produção, prefira o binding de IA e o AI Gateway (orçamento, cache). */
    ai: {
      rodar: <S = unknown>(modelo: string, entrada: Record<string, unknown>) => chamar<S>('POST', `${conta}/ai/run/${modelo}`, entrada),
    },
  }
}

export type ClienteCloudflare = ReturnType<typeof cloudflare>

/** Lê a configuração do ambiente (CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN). Nunca do repositório. */
export function configDoAmbiente(env: Record<string, string | undefined>): ConfigCloudflare {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) throw new Error('Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no ambiente (nunca no repositório).')
  return { accountId, apiToken }
}
