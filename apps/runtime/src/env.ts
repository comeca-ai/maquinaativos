export interface Env {
  DB: D1Database
  CASO_WF: Workflow
  ASSETS: Fetcher
  /** Cofre de provas (R2 privado, sem domínio público). Criar com: pnpm cf r2:criar maquina-provas */
  PROVAS: R2Bucket
  /** Segredo das rotas /api (Studio). Quando o Cloudflare Access entrar, ele vira a segunda camada. */
  API_TOKEN: string
  /** Turnstile: se TURNSTILE_SECRET existir, as rotas /pub exigem o token do widget. */
  TURNSTILE_SECRET?: string
  TURNSTILE_SITEKEY?: string
  /** Chave do HMAC do IP (limite de abuso). Sem ela usa API_TOKEN. `wrangler secret put SEGREDO_ORIGEM`. */
  SEGREDO_ORIGEM?: string
  /** Agregadores OpenTimestamps separados por vírgula (opcional; padrão do kit). */
  OTS_AGREGADORES?: string
  /** Domínio -> produto que responde na raiz, em JSON. Ex.: {"tinhaprint.com.br":"prova-digital"}. Opcional. */
  DOMINIOS?: string
  /** Cloudflare Email Service (binding send_email). Sem ele, o login por link mágico responde 503. */
  EMAIL?: SendEmail
  /** Remetente do link mágico, ex.: "Tinha Print <acesso@tinhaprint.com.br>". O domínio precisa estar verificado no Email Service. */
  EMAIL_REMETENTE?: string
  /** Chave do HMAC do e-mail das contas. NÃO rotacione sem migração: trocar a chave desliga todas as contas das provas. */
  SEGREDO_CONTA?: string
}

export type ParamsCaso = {
  casoId: string
  produto: string
  entrada: unknown
  /** Data de hoje (America/Sao_Paulo) fixada na entrada; o replay usa a mesma. */
  hoje: string
}
