import { z } from 'zod'
import { defineProduto } from '@maquina/core'
import { regra, PRAZO_DIAS, MIN_CONVERSAS, type EntradaFunil, type EstadoFunil, type MotivoFunil } from './rule'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')

export const funil = defineProduto<EstadoFunil, MotivoFunil, EntradaFunil>({
  nome: 'funil',
  versao: 'v1',
  entrada: z.object({
    inicio: data,
    conversasReais: z.number().int().min(0),
    disposicaoAPagar: z.number().int().min(0),
    margemPorCasoCentavos: z.number().int(),
    evidenciaDor: z.boolean(),
    sacadaCopiavel: z.boolean(),
    estadoAnterior: z.enum(['em_teste', 'viva', 'morta', 'reaberta']).optional(),
    novaEvidencia: z.boolean().optional(),
  }),
  estados: {
    em_teste: { final: false, prazoDias: PRAZO_DIAS },
    reaberta: { final: false, prazoDias: PRAZO_DIAS },
    viva: { final: true },
    morta: { final: true },
  },
  estadoInicial: 'em_teste',
  motivos: {
    em_andamento: 'em_teste',
    criterio_atingido: 'viva',
    sem_pagador: 'morta',
    dor_sem_evidencia: 'morta',
    planilha_negativa: 'morta',
    sacada_copiavel: 'morta',
    prazo_sem_sinal: 'morta',
    reabertura_negada: 'morta',
    nova_evidencia: 'reaberta',
  },
  regra,
  criterioDeMorte: { prazoDias: PRAZO_DIAS, metrica: 'conversas_reais', minimo: MIN_CONVERSAS },
  preco: { modelo: 'interno', gratis: 'Uso interno: decide se uma ideia vive ou morre.', custoPorCasoCentavos: 0 },
  naoFaremos: [
    'Não decide com IA: o veredito é regra pura.',
    'Não estende prazo por simpatia: prazo vencido sem sinal é morte.',
    'Não reabre ideia morta sem evidência nova.',
  ],
})

export default funil
