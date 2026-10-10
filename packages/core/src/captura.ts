/**
 * Capacidade genérica de "captura de evidência": o runtime recebe um arquivo, grava no cofre (R2 privado),
 * monta o manifesto, ancora o hash e transforma tudo em FATOS objetivos. O produto só diz como esses fatos
 * viram entrada da regra pura. O framework nunca conhece o produto.
 */
export type StatusAncoraFato = 'nao_enviada' | 'enviada' | 'confirmada'

export interface FatosCaptura {
  /** AAAA-MM-DD (America/Sao_Paulo) em que o caso foi aberto. */
  solicitadoEm: string
  consentimento: boolean
  /** Marcado por denúncia ou operador humano. Nenhuma IA classifica. */
  conteudoVedado: boolean
  /** Capturas desta origem (HMAC do IP) nas últimas 24h, contadas pelo runtime, fora da regra. */
  capturasUltimas24h: number
  /** SHA-256 hex dos bytes recebidos, verificado pelo cofre na gravação. null = nada recebido. */
  arquivoSha256: string | null
  /** O hash calculado pelo navegador bate com o do servidor? */
  hashConferido: boolean
  gravadoNoCofre: boolean
  manifestoGravado: boolean
  gravadoEm: string | null
  ancora: StatusAncoraFato
  ancoraEnviadaEm: string | null
}

export interface Captura<In = unknown> {
  titulo: string
  subtitulo: string
  /** Aviso jurídico visível antes de capturar. */
  aviso: string
  /** Prefixos de MIME aceitos (ex.: 'image/', 'video/', 'application/pdf'). */
  tiposMime: readonly string[]
  maxBytes: number
  /** Pura: fatos -> entrada da regra do produto. */
  montarEntrada: (f: FatosCaptura) => In
}

export const MAX_BYTES_CAPTURA = 100 * 1024 * 1024 // limite do corpo de requisição em Workers (plano gratuito/pago)

export function validarCaptura(c: Captura): string[] {
  const e: string[] = []
  if (!c.titulo || !c.subtitulo || !c.aviso) e.push('captura: titulo, subtitulo e aviso são obrigatórios')
  if (c.tiposMime.length === 0) e.push('captura.tiposMime não pode ser vazio')
  if (!Number.isInteger(c.maxBytes) || c.maxBytes <= 0 || c.maxBytes > MAX_BYTES_CAPTURA) e.push(`captura.maxBytes deve estar entre 1 e ${MAX_BYTES_CAPTURA}`)
  return e
}
