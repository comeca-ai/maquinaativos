import { z } from 'zod'
import { defineProduto, type Tela } from '@maquina/core'
import { regra, type EntradaMulta, type EstadoMulta, type MotivoMulta } from './rule'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')

const tela: Tela<MotivoMulta> = {
  titulo: 'Sua multa tem problema de prazo?',
  subtitulo: 'Digite três datas do documento da notificação. Em segundos você vê se há indício de vício de prazo.',
  aviso:
    'Esta ferramenta aponta indício de vício de prazo com base na Resolução 918/2022 do Contran. Não é aconselhamento jurídico e não garante o resultado de nenhum recurso. Não pedimos placa, CPF nem foto do documento.',
  campos: [
    { nome: 'dataInfracao', rotulo: 'Data da infração', tipo: 'data', ajuda: 'O dia em que a infração aconteceu, como consta no documento.' },
    { nome: 'dataExpedicaoNA', rotulo: 'Data de expedição da notificação', tipo: 'data', opcional: true, ajuda: 'A data em que o órgão expediu a notificação, não a data em que você recebeu. Se não achar, deixe em branco.' },
    { nome: 'prazoDefesaAte', rotulo: 'Último dia para apresentar defesa', tipo: 'data', ajuda: 'Consta na própria notificação.' },
    { nome: 'autuadoNoAto', rotulo: 'Fui parado e autuado na hora (abordagem)?', tipo: 'sim_nao' },
  ],
  fixos: { camposAusentes: [] },
  resultados: {
    falta_data_expedicao: {
      tom: 'espera',
      titulo: 'Falta a data de expedição',
      explicacao: 'Sem ela não dá para checar o prazo de 30 dias entre a infração e a notificação.',
      proximoPasso: 'Procure no documento o campo de data de expedição da notificação e preencha de novo.',
    },
    na_fora_do_prazo_30d: {
      tom: 'alerta',
      titulo: 'Há indício de vício de prazo',
      explicacao:
        'Pelas datas que você informou, a notificação foi expedida mais de 30 dias depois da infração. A Resolução 918/2022 do Contran (art. 4º) prevê o arquivamento do auto nesse caso.',
      proximoPasso: 'Confira as datas no documento original. Se confirmarem, leve o caso a um advogado ou ao órgão autuador. Fique atento ao último dia de defesa que você informou.',
    },
    ait_sem_dados_minimos: {
      tom: 'alerta',
      titulo: 'Há indício de falta de dados no auto',
      explicacao: 'Alguns dados mínimos do auto de infração parecem ausentes no documento.',
      proximoPasso: 'Leve o documento a um profissional para conferir.',
    },
    nenhum_vicio_detectado: {
      tom: 'ok',
      titulo: 'Não encontramos vício de prazo',
      explicacao: 'Isso não significa que a multa seja válida nem que não haja outro motivo para contestar: olhamos apenas o prazo de 30 dias da notificação.',
      proximoPasso: 'Se você discorda da infração em si, a defesa ainda pode ser apresentada até o dia que você informou.',
    },
    prazo_defesa_vencido: {
      tom: 'neutro',
      titulo: 'O prazo de defesa informado já passou',
      explicacao: 'Pela data que você informou, o prazo de defesa já terminou. Pode haver outras fases do processo; confira no documento.',
      proximoPasso: 'Se tiver dúvida, converse com um profissional sobre as etapas seguintes.',
    },
    abordagem_no_ato: {
      tom: 'neutro',
      titulo: 'Este caso ainda não é coberto',
      explicacao: 'Quando a pessoa é parada e autuada na hora, o processo é diferente e esta versão não o analisa.',
    },
  },
  oferecerAjudaEm: ['na_fora_do_prazo_30d', 'ait_sem_dados_minimos'],
  textoAjuda: 'Estamos avaliando oferecer ajuda para contestar casos como este. Deixe um contato para conversarmos sobre o seu caso.',
}

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
  tela,
  criterioDeMorte: { prazoDias: 14, metrica: 'conversas_reais', minimo: 10 },
  naoFaremos: [
    'Não garantimos êxito do recurso nem substituímos advogado.',
    'Não protocolamos defesa no órgão autuador na v1: só indicamos indício de vício formal e o prazo.',
    'Não analisamos mérito (se você de fato cometeu a infração), só forma e prazo.',
    'Não tratamos autuação no ato (com abordagem) na v1.',
  ],
})

export default multaContestavel
