export interface Env {
  DB: D1Database
  CASO_WF: Workflow
  ASSETS: Fetcher
  /** Segredo das rotas /api (Studio). Quando o Cloudflare Access entrar, ele vira a segunda camada. */
  API_TOKEN: string
  /** Turnstile: se TURNSTILE_SECRET existir, as rotas /pub exigem o token do widget. */
  TURNSTILE_SECRET?: string
  TURNSTILE_SITEKEY?: string
}

export type ParamsCaso = {
  casoId: string
  produto: string
  entrada: unknown
  /** Data de hoje (America/Sao_Paulo) fixada na entrada; o replay usa a mesma. */
  hoje: string
}
