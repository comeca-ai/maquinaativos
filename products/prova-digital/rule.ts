import type { Contexto, Veredito } from '@maquina/core'
import { somarDias } from '@maquina/core'

export type EstadoProva =
  | 'aguardando_captura'
  | 'guardada'
  | 'ancorando'
  | 'preservada'
  | 'preservada_sem_ancora'
  | 'falhou'
  | 'recusada'

export type MotivoProva =
  | 'sem_arquivo'
  | 'gravacao_pendente'
  | 'guardada_sem_ancora'
  | 'ancora_enviada'
  | 'ancora_confirmada'
  | 'ancora_nao_enviada_no_prazo'
  | 'ancora_nao_confirmada_no_prazo'
  | 'captura_vencida'
  | 'hash_divergente'
  | 'gravacao_incompleta_vencida'
  | 'sem_consentimento'
  | 'conteudo_vedado'
  | 'abuso_por_volume'

export type StatusAncora = 'nao_enviada' | 'enviada' | 'confirmada'

/**
 * Fatos OBJETIVOS vindos do runtime. A regra não lê relógio, rede nem o arquivo: só estes fatos e ctx.hoje.
 * Datas AAAA-MM-DD (fuso America/Sao_Paulo, definido pelo runtime).
 */
export interface EntradaProva {
  solicitadoEm: string
  consentimento: boolean
  /** Marcado por denúncia/operador humano. Nenhuma IA classifica conteúdo aqui. */
  conteudoVedado: boolean
  /** Quantas capturas esta origem fez nas últimas 24h, contada FORA da regra. */
  capturasUltimas24h: number
  /** SHA-256 hex que o servidor calculou sobre os bytes recebidos. null = nada recebido. */
  arquivoSha256: string | null
  /** O hash calculado pelo navegador é igual ao do servidor? */
  hashConferido: boolean
  gravadoNoCofre: boolean
  manifestoGravado: boolean
  gravadoEm: string | null
  ancora: StatusAncora
  ancoraEnviadaEm: string | null
}

/** Parâmetros de PRODUTO (não são fatos legais): ajustáveis por versão. */
export const PRAZO_CAPTURA_DIAS = 3
export const PRAZO_GUARDADA_DIAS = 2
export const PRAZO_ANCORA_DIAS = 3
export const LIMITE_CAPTURAS_24H = 50

export function regra(c: EntradaProva, ctx: Contexto): Veredito<EstadoProva, MotivoProva> {
  // 1) Recusas vencem tudo: sem consentimento nada é guardado.
  if (!c.consentimento) return { estado: 'recusada', motivo: 'sem_consentimento' }
  if (c.conteudoVedado) return { estado: 'recusada', motivo: 'conteudo_vedado' }
  if (c.capturasUltimas24h > LIMITE_CAPTURAS_24H) return { estado: 'recusada', motivo: 'abuso_por_volume' }

  const captura_vencida = ctx.hoje > somarDias(c.solicitadoEm, PRAZO_CAPTURA_DIAS)

  // 2) Nada recebido ainda.
  if (c.arquivoSha256 === null) {
    return captura_vencida ? { estado: 'falhou', motivo: 'captura_vencida' } : { estado: 'aguardando_captura', motivo: 'sem_arquivo' }
  }

  // 3) Integridade: o que o navegador viu tem de ser o que o servidor recebeu.
  if (!c.hashConferido) return { estado: 'falhou', motivo: 'hash_divergente' }

  // 4) Gravação completa = arquivo E manifesto no cofre.
  if (!c.gravadoNoCofre || !c.manifestoGravado || c.gravadoEm === null) {
    return captura_vencida
      ? { estado: 'falhou', motivo: 'gravacao_incompleta_vencida' }
      : { estado: 'aguardando_captura', motivo: 'gravacao_pendente' }
  }

  // 5) Âncora.
  if (c.ancora === 'confirmada') return { estado: 'preservada', motivo: 'ancora_confirmada' }
  if (c.ancora === 'enviada') {
    // O schema garante ancoraEnviadaEm quando ancora != nao_enviada; o fallback só estreita o tipo.
    const desde = c.ancoraEnviadaEm ?? c.gravadoEm
    return ctx.hoje > somarDias(desde, PRAZO_ANCORA_DIAS)
      ? { estado: 'preservada_sem_ancora', motivo: 'ancora_nao_confirmada_no_prazo' }
      : { estado: 'ancorando', motivo: 'ancora_enviada' }
  }
  return ctx.hoje > somarDias(c.gravadoEm, PRAZO_GUARDADA_DIAS)
    ? { estado: 'preservada_sem_ancora', motivo: 'ancora_nao_enviada_no_prazo' }
    : { estado: 'guardada', motivo: 'guardada_sem_ancora' }
}
