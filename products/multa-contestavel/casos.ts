import type { CasoDeTeste } from '@maquina/core'

const base = {
  dataInfracao: '2026-01-10',
  dataExpedicaoNA: '2026-01-25',
  prazoDefesaAte: '2026-03-10',
  camposAusentes: [] as string[],
  autuadoNoAto: false,
}
const hoje = { hoje: '2026-02-01' }

export const casos: CasoDeTeste[] = [
  { nome: 'NA no dia 30 ainda está no prazo', entrada: { ...base, dataExpedicaoNA: '2026-02-09' }, ctx: hoje, espera: { estado: 'sem_vicio', motivo: 'nenhum_vicio_detectado' } },
  { nome: 'NA no dia 31 está fora do prazo', entrada: { ...base, dataExpedicaoNA: '2026-02-10' }, ctx: hoje, espera: { estado: 'contestavel', motivo: 'na_fora_do_prazo_30d' } },
  { nome: 'campo mínimo ausente no auto', entrada: { ...base, camposAusentes: ['local'] }, ctx: hoje, espera: { estado: 'contestavel', motivo: 'ait_sem_dados_minimos' } },
  { nome: 'sem data de expedição, pede dado', entrada: { ...base, dataExpedicaoNA: null }, ctx: hoje, espera: { estado: 'aguardando_dados', motivo: 'falta_data_expedicao' } },
  { nome: 'defesa vencida sem vício', entrada: base, ctx: { hoje: '2026-03-11' }, espera: { estado: 'defesa_vencida', motivo: 'prazo_defesa_vencido' } },
  { nome: 'último dia de defesa ainda vale', entrada: base, ctx: { hoje: '2026-03-10' }, espera: { estado: 'sem_vicio', motivo: 'nenhum_vicio_detectado' } },
  { nome: 'abordagem no ato fica fora do escopo', entrada: { ...base, autuadoNoAto: true }, ctx: hoje, espera: { estado: 'fora_de_escopo', motivo: 'abordagem_no_ato' } },
  { nome: 'vício vence mesmo com defesa vencida (vira recurso)', entrada: { ...base, dataExpedicaoNA: '2026-03-01', prazoDefesaAte: '2026-03-31' }, ctx: { hoje: '2026-05-01' }, espera: { estado: 'contestavel', motivo: 'na_fora_do_prazo_30d' } },
]
