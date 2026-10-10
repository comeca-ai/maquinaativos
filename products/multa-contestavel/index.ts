import { z } from 'zod'
import { defineProduto } from '@maquina/core'
import { regra, type EntradaMulta, type EstadoMulta, type MotivoMulta } from './rule'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')

export const multaContestavel = defineProduto<EstadoMulta, MotivoMulta, EntradaMulta>({
  nome: 'multa-contestavel',
  versao: 'v1',
  entrada: z
    .object({
      dataInfracao: data,
      dataExpedicaoNA: data.nullable(),
      prazoDefesaAte: data,
      camposAusentes: z.array(z.string().min(1)),
      autuadoNoAto: z.boolean(),
    })
    .refine((e) => e.dataExpedicaoNA === null || e.dataExpedicaoNA >= e.dataInfracao, {
      message: 'dataExpedicaoNA não pode ser anterior à dataInfracao',
      path: ['dataExpedicaoNA'],
    }),
  estados: {
    aguardando_dados: { final: false, prazoDias: 7 },
    contestavel: { final: true },
    sem_vicio: { final: true },
    defesa_vencida: { final: true },
    fora_de_escopo: { final: true },
  },
  estadoInicial: 'aguardando_dados',
  motivos: {
    falta_data_expedicao: 'aguardando_dados',
    na_fora_do_prazo_30d: 'contestavel',
    ait_sem_dados_minimos: 'contestavel',
    nenhum_vicio_detectado: 'sem_vicio',
    prazo_defesa_vencido: 'defesa_vencida',
    abordagem_no_ato: 'fora_de_escopo',
  },
  regra,
  criterioDeMorte: { prazoDias: 14, metrica: 'conversas_reais', minimo: 10 },
  naoFaremos: [
    'Não garantimos êxito do recurso nem substituímos advogado.',
    'Não protocolamos defesa no órgão autuador na v1: só indicamos indício de vício formal e o prazo.',
    'Não analisamos mérito (se você de fato cometeu a infração), só forma e prazo.',
    'Não tratamos autuação no ato (com abordagem) na v1.',
  ],
})

export default multaContestavel
