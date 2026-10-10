import type { Contexto, Veredito } from '@maquina/core'
import { diasEntre } from '@maquina/core'

export type EstadoFunil = 'em_teste' | 'viva' | 'morta' | 'reaberta'
export type MotivoFunil =
  | 'em_andamento'
  | 'criterio_atingido'
  | 'sem_pagador'
  | 'dor_sem_evidencia'
  | 'planilha_negativa'
  | 'sacada_copiavel'
  | 'prazo_sem_sinal'
  | 'nova_evidencia'
  | 'reabertura_negada'

export interface EntradaFunil {
  /** Data de início do teste, AAAA-MM-DD. */
  inicio: string
  conversasReais: number
  /** Quantas pessoas disseram que pagariam / pagaram. */
  disposicaoAPagar: number
  /** Margem por caso na planilha mínima, em centavos. Negativa mata. */
  margemPorCasoCentavos: number
  /** Há evidência pública ou direta da dor (reclamações, dados, conversas)? */
  evidenciaDor: boolean
  /** Outra pessoa copiaria isto em uma semana sem a sacada exclusiva? */
  sacadaCopiavel: boolean
  /** Estado em que a ideia já estava. Padrão: em_teste. */
  estadoAnterior?: EstadoFunil
  /** Reabrir morta exige evidência nova (nunca "mudei de ideia"). */
  novaEvidencia?: boolean
}

export const PRAZO_DIAS = 14
export const MIN_CONVERSAS = 10
export const MIN_PAGADORES = 1

/** Regra pura. Ordem importa: as mortes por estrutura vencem o relógio. */
export function regra(c: EntradaFunil, ctx: Contexto): Veredito<EstadoFunil, MotivoFunil> {
  if (c.estadoAnterior === 'morta') {
    return c.novaEvidencia
      ? { estado: 'reaberta', motivo: 'nova_evidencia' }
      : { estado: 'morta', motivo: 'reabertura_negada' }
  }

  if (c.sacadaCopiavel) return { estado: 'morta', motivo: 'sacada_copiavel' }
  if (c.margemPorCasoCentavos < 0) return { estado: 'morta', motivo: 'planilha_negativa' }

  const atingiu = c.conversasReais >= MIN_CONVERSAS && c.disposicaoAPagar >= MIN_PAGADORES && c.evidenciaDor
  if (atingiu) return { estado: 'viva', motivo: 'criterio_atingido' }

  const decorridos = diasEntre(c.inicio, ctx.hoje)
  if (decorridos < PRAZO_DIAS) return { estado: 'em_teste', motivo: 'em_andamento' }

  if (!c.evidenciaDor) return { estado: 'morta', motivo: 'dor_sem_evidencia' }
  if (c.conversasReais >= MIN_CONVERSAS && c.disposicaoAPagar < MIN_PAGADORES) {
    return { estado: 'morta', motivo: 'sem_pagador' }
  }
  return { estado: 'morta', motivo: 'prazo_sem_sinal' }
}
