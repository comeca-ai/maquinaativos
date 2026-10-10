import type { CasoDeTeste } from '@maquina/core'

const base = {
  inicio: '2026-03-01',
  conversasReais: 3,
  disposicaoAPagar: 0,
  margemPorCasoCentavos: 500,
  evidenciaDor: true,
  sacadaCopiavel: false,
}

/** Um caso por motivo. A cobertura é exigida pelo teste central (tests/cobertura.test.ts). */
export const casos: CasoDeTeste[] = [
  { nome: 'dentro do prazo, sem critério ainda', entrada: base, ctx: { hoje: '2026-03-05' }, espera: { estado: 'em_teste', motivo: 'em_andamento' } },
  { nome: 'atingiu 10 conversas e 1 pagador', entrada: { ...base, conversasReais: 10, disposicaoAPagar: 1 }, ctx: { hoje: '2026-03-08' }, espera: { estado: 'viva', motivo: 'criterio_atingido' } },
  { nome: 'prazo vencido, 10 conversas, ninguém paga', entrada: { ...base, conversasReais: 12 }, ctx: { hoje: '2026-03-20' }, espera: { estado: 'morta', motivo: 'sem_pagador' } },
  { nome: 'prazo vencido, sem evidência da dor', entrada: { ...base, evidenciaDor: false }, ctx: { hoje: '2026-03-20' }, espera: { estado: 'morta', motivo: 'dor_sem_evidencia' } },
  { nome: 'planilha negativa mata antes do prazo', entrada: { ...base, margemPorCasoCentavos: -100 }, ctx: { hoje: '2026-03-03' }, espera: { estado: 'morta', motivo: 'planilha_negativa' } },
  { nome: 'sacada copiável mata antes do prazo', entrada: { ...base, sacadaCopiavel: true }, ctx: { hoje: '2026-03-03' }, espera: { estado: 'morta', motivo: 'sacada_copiavel' } },
  { nome: 'prazo vencido com pouco sinal', entrada: base, ctx: { hoje: '2026-03-20' }, espera: { estado: 'morta', motivo: 'prazo_sem_sinal' } },
  { nome: 'morta com evidência nova reabre', entrada: { ...base, estadoAnterior: 'morta', novaEvidencia: true }, ctx: { hoje: '2026-04-01' }, espera: { estado: 'reaberta', motivo: 'nova_evidencia' } },
  { nome: 'morta sem evidência nova continua morta', entrada: { ...base, estadoAnterior: 'morta' }, ctx: { hoje: '2026-04-01' }, espera: { estado: 'morta', motivo: 'reabertura_negada' } },
]
