import { z } from 'zod'
import { defineProduto } from '@maquina/core'
import { regra, PRAZO_CAPTURA_DIAS, PRAZO_GUARDADA_DIAS, PRAZO_ANCORA_DIAS, type EntradaProva, type EstadoProva, type MotivoProva } from './rule'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 em hexadecimal minúsculo (64 caracteres)')

export const provaDigital = defineProduto<EstadoProva, MotivoProva, EntradaProva>({
  nome: 'prova-digital',
  versao: 'v1',
  entrada: z
    .object({
      solicitadoEm: data,
      consentimento: z.boolean(),
      conteudoVedado: z.boolean(),
      capturasUltimas24h: z.number().int().min(0),
      arquivoSha256: sha256.nullable(),
      hashConferido: z.boolean(),
      gravadoNoCofre: z.boolean(),
      manifestoGravado: z.boolean(),
      gravadoEm: data.nullable(),
      ancora: z.enum(['nao_enviada', 'enviada', 'confirmada']),
      ancoraEnviadaEm: data.nullable(),
    })
    .superRefine((v, ctx) => {
      if (v.gravadoNoCofre && v.gravadoEm === null) ctx.addIssue({ code: 'custom', path: ['gravadoEm'], message: 'gravadoEm é obrigatório quando gravadoNoCofre = true' })
      if (v.ancora !== 'nao_enviada' && v.ancoraEnviadaEm === null) ctx.addIssue({ code: 'custom', path: ['ancoraEnviadaEm'], message: 'ancoraEnviadaEm é obrigatório quando a âncora foi enviada' })
    }),
  estados: {
    aguardando_captura: { final: false, prazoDias: PRAZO_CAPTURA_DIAS },
    guardada: { final: false, prazoDias: PRAZO_GUARDADA_DIAS },
    ancorando: { final: false, prazoDias: PRAZO_ANCORA_DIAS },
    preservada: { final: true },
    preservada_sem_ancora: { final: true },
    falhou: { final: true },
    recusada: { final: true },
  },
  estadoInicial: 'aguardando_captura',
  motivos: {
    sem_arquivo: 'aguardando_captura',
    gravacao_pendente: 'aguardando_captura',
    guardada_sem_ancora: 'guardada',
    ancora_enviada: 'ancorando',
    ancora_confirmada: 'preservada',
    ancora_nao_enviada_no_prazo: 'preservada_sem_ancora',
    ancora_nao_confirmada_no_prazo: 'preservada_sem_ancora',
    captura_vencida: 'falhou',
    hash_divergente: 'falhou',
    gravacao_incompleta_vencida: 'falhou',
    sem_consentimento: 'recusada',
    conteudo_vedado: 'recusada',
    abuso_por_volume: 'recusada',
  },
  regra,
  criterioDeMorte: { prazoDias: 14, metrica: 'conversas_reais', minimo: 10 },
  naoFaremos: [
    'Não afirma validade jurídica: a admissibilidade é decisão do juiz. Entrega integridade e data, não sentença.',
    'Não substitui ata notarial.',
    'Não prova que o conteúdo é verdadeiro: prova que ESTE arquivo existia nesta data, sem alteração desde então.',
    'Nenhuma IA toca no arquivo capturado nem decide o estado.',
    'Não captura sem consentimento, nem conteúdo íntimo ou de menores.',
    'Não guarda IP nem user-agent sem consentimento explícito.',
  ],
})

export default provaDigital
