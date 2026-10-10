import type { CasoDeTeste } from '@maquina/core'

const H = 'a'.repeat(64)

const vazio = {
  solicitadoEm: '2026-03-02',
  consentimento: true,
  conteudoVedado: false,
  capturasUltimas24h: 1,
  arquivoSha256: null as string | null,
  hashConferido: true,
  gravadoNoCofre: false,
  manifestoGravado: false,
  gravadoEm: null as string | null,
  ancora: 'nao_enviada' as 'nao_enviada' | 'enviada' | 'confirmada',
  ancoraEnviadaEm: null as string | null,
}
const guardado = { ...vazio, arquivoSha256: H, gravadoNoCofre: true, manifestoGravado: true, gravadoEm: '2026-03-02' }
const d = (hoje: string) => ({ hoje })

export const casos: CasoDeTeste[] = [
  // aguardando_captura
  { nome: 'caso aberto, nada recebido, dentro do prazo', entrada: vazio, ctx: d('2026-03-04'), espera: { estado: 'aguardando_captura', motivo: 'sem_arquivo' } },
  { nome: 'último dia do prazo de captura ainda vale', entrada: vazio, ctx: d('2026-03-05'), espera: { estado: 'aguardando_captura', motivo: 'sem_arquivo' } },
  { nome: 'hash recebido mas cofre/manifesto ainda não gravados', entrada: { ...vazio, arquivoSha256: H }, ctx: d('2026-03-03'), espera: { estado: 'aguardando_captura', motivo: 'gravacao_pendente' } },
  { nome: 'só o arquivo no cofre, manifesto faltando', entrada: { ...guardado, manifestoGravado: false }, ctx: d('2026-03-03'), espera: { estado: 'aguardando_captura', motivo: 'gravacao_pendente' } },

  // guardada
  { nome: 'arquivo e manifesto no cofre, âncora ainda não enviada', entrada: guardado, ctx: d('2026-03-03'), espera: { estado: 'guardada', motivo: 'guardada_sem_ancora' } },
  { nome: 'último dia do prazo da guarda ainda vale', entrada: guardado, ctx: d('2026-03-04'), espera: { estado: 'guardada', motivo: 'guardada_sem_ancora' } },

  // ancorando
  { nome: 'âncora enviada, aguardando confirmação', entrada: { ...guardado, ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-03-04'), espera: { estado: 'ancorando', motivo: 'ancora_enviada' } },
  { nome: 'último dia do prazo da âncora ainda vale', entrada: { ...guardado, ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-03-05'), espera: { estado: 'ancorando', motivo: 'ancora_enviada' } },

  // preservada (final)
  { nome: 'âncora confirmada: preservada', entrada: { ...guardado, ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-03-03'), espera: { estado: 'preservada', motivo: 'ancora_confirmada' } },
  { nome: 'confirmação tardia ainda vale como preservada', entrada: { ...guardado, ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-04-30'), espera: { estado: 'preservada', motivo: 'ancora_confirmada' } },

  // preservada_sem_ancora (final): honesto, sem fingir âncora
  { nome: 'âncora nunca enviada e prazo da guarda esgotado', entrada: guardado, ctx: d('2026-03-05'), espera: { estado: 'preservada_sem_ancora', motivo: 'ancora_nao_enviada_no_prazo' } },
  { nome: 'âncora enviada e não confirmada no prazo', entrada: { ...guardado, ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-03-06'), espera: { estado: 'preservada_sem_ancora', motivo: 'ancora_nao_confirmada_no_prazo' } },

  // falhou (final)
  { nome: 'nada recebido e prazo de captura vencido', entrada: vazio, ctx: d('2026-03-06'), espera: { estado: 'falhou', motivo: 'captura_vencida' } },
  { nome: 'hash do navegador diferente do hash do servidor', entrada: { ...guardado, hashConferido: false }, ctx: d('2026-03-03'), espera: { estado: 'falhou', motivo: 'hash_divergente' } },
  { nome: 'gravação incompleta e prazo vencido', entrada: { ...vazio, arquivoSha256: H }, ctx: d('2026-03-06'), espera: { estado: 'falhou', motivo: 'gravacao_incompleta_vencida' } },

  // recusada (final): cada motivo separado
  { nome: 'sem consentimento nada é guardado', entrada: { ...guardado, consentimento: false }, ctx: d('2026-03-03'), espera: { estado: 'recusada', motivo: 'sem_consentimento' } },
  { nome: 'conteúdo vedado marcado por denúncia', entrada: { ...guardado, conteudoVedado: true }, ctx: d('2026-03-03'), espera: { estado: 'recusada', motivo: 'conteudo_vedado' } },
  { nome: 'volume acima do limite em 24h', entrada: { ...guardado, capturasUltimas24h: 51 }, ctx: d('2026-03-03'), espera: { estado: 'recusada', motivo: 'abuso_por_volume' } },
  { nome: 'exatamente no limite de volume ainda passa', entrada: { ...guardado, capturasUltimas24h: 50 }, ctx: d('2026-03-03'), espera: { estado: 'guardada', motivo: 'guardada_sem_ancora' } },

  // fronteiras e combinações que faltavam
  { nome: 'arquivo recebido, gravação incompleta, último dia do prazo ainda vale', entrada: { ...vazio, arquivoSha256: H }, ctx: d('2026-03-05'), espera: { estado: 'aguardando_captura', motivo: 'gravacao_pendente' } },
  { nome: 'arquivo no cofre sem manifesto e prazo vencido', entrada: { ...guardado, manifestoGravado: false }, ctx: d('2026-03-06'), espera: { estado: 'falhou', motivo: 'gravacao_incompleta_vencida' } },
  { nome: 'recusa posterior vence até uma prova já preservada (runtime não reavalia finais)', entrada: { ...guardado, ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02', conteudoVedado: true }, ctx: d('2026-03-03'), espera: { estado: 'recusada', motivo: 'conteudo_vedado' } },

  // precedência
  { nome: 'recusa por consentimento vence hash divergente', entrada: { ...guardado, consentimento: false, hashConferido: false }, ctx: d('2026-03-03'), espera: { estado: 'recusada', motivo: 'sem_consentimento' } },
  { nome: 'hash divergente vence âncora confirmada', entrada: { ...guardado, hashConferido: false, ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02' }, ctx: d('2026-03-03'), espera: { estado: 'falhou', motivo: 'hash_divergente' } },
]
