import type { Contexto, Veredito } from '@maquina/core'
import { diasEntre } from '@maquina/core'

export type EstadoMulta = 'aguardando_dados' | 'contestavel' | 'sem_vicio' | 'defesa_vencida' | 'fora_de_escopo'
export type MotivoMulta =
  | 'falta_data_expedicao'
  | 'na_fora_do_prazo_30d'
  | 'ait_sem_dados_minimos'
  | 'nenhum_vicio_detectado'
  | 'prazo_defesa_vencido'
  | 'abordagem_no_ato'

export interface EntradaMulta {
  /** Data do cometimento da infração, AAAA-MM-DD. */
  dataInfracao: string
  /** Data de expedição da Notificação da Autuação (NA), conforme o documento. null = não consta. */
  dataExpedicaoNA: string | null
  /** Último dia para defesa prévia, conforme consta na NA. */
  prazoDefesaAte: string
  /** Campos mínimos do auto de infração que NÃO constam no documento (informados pela leitura/operador). */
  camposAusentes: string[]
  /** Condutor foi abordado e autuado no ato (sem NA). Fora do escopo da v1. */
  autuadoNoAto: boolean
}

/** Resolução Contran 918/2022, art. 4º: NA em até 30 dias do cometimento. Dia 30 ainda está no prazo (ver FONTES.md). */
export const PRAZO_NA_DIAS = 30

/** Regra pura. Aponta indício de vício FORMAL; não é aconselhamento jurídico nem garantia de êxito. */
export function regra(c: EntradaMulta, ctx: Contexto): Veredito<EstadoMulta, MotivoMulta> {
  if (c.autuadoNoAto) return { estado: 'fora_de_escopo', motivo: 'abordagem_no_ato' }
  if (c.dataExpedicaoNA === null) return { estado: 'aguardando_dados', motivo: 'falta_data_expedicao' }
  if (diasEntre(c.dataInfracao, c.dataExpedicaoNA) > PRAZO_NA_DIAS) {
    return { estado: 'contestavel', motivo: 'na_fora_do_prazo_30d' }
  }
  if (c.camposAusentes.length > 0) return { estado: 'contestavel', motivo: 'ait_sem_dados_minimos' }
  if (ctx.hoje > c.prazoDefesaAte) return { estado: 'defesa_vencida', motivo: 'prazo_defesa_vencido' }
  return { estado: 'sem_vicio', motivo: 'nenhum_vicio_detectado' }
}
