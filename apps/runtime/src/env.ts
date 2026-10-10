export interface Env {
  DB: D1Database
  CASO_WF: Workflow
  API_TOKEN: string
}

export type ParamsCaso = {
  casoId: string
  produto: string
  entrada: unknown
  /** Data de hoje (America/Sao_Paulo) fixada na entrada; o replay usa a mesma. */
  hoje: string
}
