/**
 * Capacidade genérica de "captura de evidência": o runtime recebe um arquivo, grava no cofre (R2 privado),
 * monta o manifesto, ancora o hash e transforma tudo em FATOS objetivos. O produto só diz como esses fatos
 * viram entrada da regra pura. O framework nunca conhece o produto.
 */
export type StatusAncoraFato = 'nao_enviada' | 'enviada' | 'confirmada'

export interface FatosCaptura {
  /** AAAA-MM-DD (America/Sao_Paulo) em que o caso foi aberto. */
  solicitadoEm: string
  consentimento: boolean
  /** Marcado por denúncia ou operador humano. Nenhuma IA classifica. */
  conteudoVedado: boolean
  /** Capturas desta origem (HMAC do IP) nas últimas 24h, contadas pelo runtime, fora da regra. */
  capturasUltimas24h: number
  /** SHA-256 hex dos bytes recebidos, verificado pelo cofre na gravação. null = nada recebido. */
  arquivoSha256: string | null
  /** O hash calculado pelo navegador bate com o do servidor? */
  hashConferido: boolean
  gravadoNoCofre: boolean
  manifestoGravado: boolean
  gravadoEm: string | null
  ancora: StatusAncoraFato
  ancoraEnviadaEm: string | null
}

/** Identidade pública opcional da página de captura (nome, promessa, passos, perguntas e limites). Só texto: o framework não interpreta. */
export interface MarcaCaptura {
  nome: string
  /** Parte do nome destacada na cor de acento (ex.: 'Print' em 'Tinha Print'). Deve ser sufixo de `nome`. */
  destaque?: string
  /** Promessa em uma frase (a manchete). */
  promessa: string
  /** Situações reais em que a pessoa precisa disto (vira a seção de abertura da landing). */
  cenas?: readonly { titulo: string; texto: string }[]
  /** Texto do botão principal da landing. Padrão: 'Guardar uma prova agora'. */
  chamada?: string
  /** Frase de fechamento da página, antes do último botão. */
  fechamento?: string
  /** Arquivo fictício do recibo de exemplo no topo da página (rotulado como exemplo). */
  exemplo?: { arquivo: string; bytes: number }
  /** Planos à venda (só vitrine: quem cobra e libera crédito é outra peça). */
  planos?: readonly { nome: string; preco: string; unidade: string; inclui: readonly string[]; destaque?: boolean }[]
  /** Frase sob os planos (ex.: condição atual de teste). */
  planosNota?: string
  /** Seção BASE LEGAL: só norma lida em fonte oficial (link https), com o trecho literal e a leitura honesta. */
  baseLegal?: {
    intro: string
    itens: readonly { norma: string; trecho: string; link: string; leitura: string }[]
    ressalva: string
  }
  passos: readonly { titulo: string; texto: string }[]
  perguntas: readonly { pergunta: string; resposta: string }[]
  /** O que a ferramenta NÃO faz, dito de forma clara. */
  limites: readonly string[]
  /**
   * Seção "sua conta" (benefícios de entrar pelo e-mail). Só aparece quando o login por e-mail está LIGADO:
   * com a chave desligada, a página não promete o que não funciona.
   */
  conta?: {
    titulo: string
    texto: string
    beneficios: readonly { titulo: string; texto: string }[]
    /** Texto do botão. Padrão: 'Entrar com meu e-mail'. */
    chamada?: string
  }
}

export interface Captura<In = unknown> {
  titulo: string
  subtitulo: string
  /** Aviso jurídico visível antes de capturar. */
  aviso: string
  /** Prefixos de MIME aceitos (ex.: 'image/', 'video/', 'application/pdf'). */
  tiposMime: readonly string[]
  maxBytes: number
  marca?: MarcaCaptura
  /** Pura: fatos -> entrada da regra do produto. */
  montarEntrada: (f: FatosCaptura) => In
}

/**
 * Limite do corpo da requisição na Cloudflare depende do plano da ZONA: Free/Pro 100 MB, Business 200 MB
 * (https://developers.cloudflare.com/workers/platform/limits/, consultado em 10/10/2026). Ficamos abaixo com folga.
 */
export const MAX_BYTES_CAPTURA = 95 * 1024 * 1024

export function validarCaptura(c: Captura): string[] {
  const e: string[] = []
  if (!c.titulo || !c.subtitulo || !c.aviso) e.push('captura: titulo, subtitulo e aviso são obrigatórios')
  if (c.tiposMime.length === 0) e.push('captura.tiposMime não pode ser vazio')
  if (!Number.isInteger(c.maxBytes) || c.maxBytes <= 0 || c.maxBytes > MAX_BYTES_CAPTURA) e.push(`captura.maxBytes deve estar entre 1 e ${MAX_BYTES_CAPTURA}`)
  const m = c.marca
  if (m) {
    if (!m.nome || !m.promessa) e.push('captura.marca: nome e promessa são obrigatórios')
    if (m.destaque && !m.nome.endsWith(m.destaque)) e.push('captura.marca.destaque deve ser o final do nome')
    if (m.passos.length === 0 || m.passos.some((x) => !x.titulo || !x.texto)) e.push('captura.marca.passos: ao menos um passo, todos com título e texto')
    if (m.cenas?.some((x) => !x.titulo || !x.texto)) e.push('captura.marca.cenas: título e texto não podem ser vazios')
    if (m.perguntas.some((x) => !x.pergunta || !x.resposta)) e.push('captura.marca.perguntas: pergunta e resposta não podem ser vazias')
    if (m.limites.length === 0) e.push('captura.marca.limites: declare o que a ferramenta não faz')
    if (m.baseLegal) {
      if (!m.baseLegal.ressalva) e.push('captura.marca.baseLegal.ressalva é obrigatória (o que NÃO foi confirmado)')
      for (const i of m.baseLegal.itens) if (!/^https:\/\//.test(i.link) || !i.trecho || !i.leitura) e.push(`captura.marca.baseLegal: "${i.norma}" precisa de link https da fonte, trecho e leitura`)
    }
    if (m.planos?.some((p) => !p.nome || !p.preco || p.inclui.length === 0)) e.push('captura.marca.planos: nome, preço e o que inclui são obrigatórios')
    if (m.conta && (!m.conta.titulo || !m.conta.texto || m.conta.beneficios.length === 0 || m.conta.beneficios.some((b) => !b.titulo || !b.texto)))
      e.push('captura.marca.conta: título, texto e ao menos um benefício (com título e texto)')
  }
  return e
}
