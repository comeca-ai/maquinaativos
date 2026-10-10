/**
 * Tela declarativa. O produto descreve campos e textos; o framework desenha a página pública.
 * Invariante: todo motivo da regra tem um texto para a PESSOA (nada de "erro_042" na cara do usuário).
 */
export type Campo =
  | { nome: string; rotulo: string; tipo: 'data'; ajuda?: string; opcional?: boolean }
  | { nome: string; rotulo: string; tipo: 'sim_nao'; ajuda?: string }
  | { nome: string; rotulo: string; tipo: 'numero'; ajuda?: string; opcional?: boolean }

export interface TextoResultado {
  titulo: string
  explicacao: string
  proximoPasso?: string
  /** Só afeta a cor/ícone. alerta = achou algo a favor do usuário; espera = falta dado. */
  tom: 'ok' | 'alerta' | 'neutro' | 'espera'
}

export interface Tela<M extends string = string> {
  titulo: string
  subtitulo: string
  /** Aviso fixo, sempre visível (ex.: "não é aconselhamento jurídico"). */
  aviso: string
  campos: Campo[]
  /** Valores fixos mesclados à entrada (campos que a v1 não pergunta ao público). */
  fixos?: Record<string, unknown>
  resultados: Record<M, TextoResultado>
  /** Motivos em que se oferece "quero ajuda" (o sinal de pagador do funil). */
  oferecerAjudaEm: M[]
  textoAjuda: string
}

export function validarTela(t: Tela, motivos: string[]): string[] {
  const erros: string[] = []
  if (!t.titulo || !t.subtitulo) erros.push('tela: titulo e subtitulo são obrigatórios')
  if (!t.aviso) erros.push('tela: aviso é obrigatório')
  const nomes = t.campos.map((c) => c.nome)
  if (new Set(nomes).size !== nomes.length) erros.push('tela: nomes de campo repetidos')
  for (const m of motivos) if (!t.resultados[m]) erros.push(`tela: motivo "${m}" não tem texto para a pessoa`)
  for (const m of Object.keys(t.resultados)) if (!motivos.includes(m)) erros.push(`tela: resultado para motivo inexistente "${m}"`)
  for (const m of t.oferecerAjudaEm) if (!motivos.includes(m)) erros.push(`tela: oferecerAjudaEm tem motivo inexistente "${m}"`)
  return erros
}

/** Converte o que veio do formulário na entrada do produto (a validação de verdade é o Zod do produto). */
export function montarEntrada(t: Tela, valores: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(t.fixos ?? {}) }
  for (const c of t.campos) {
    const v = valores[c.nome]
    const vazio = v === undefined || v === null || v === ''
    if (c.tipo === 'sim_nao') out[c.nome] = v === true || v === 'sim'
    else if (c.tipo === 'data') out[c.nome] = vazio ? (c.opcional ? null : undefined) : v
    else out[c.nome] = vazio ? (c.opcional ? null : undefined) : Number(v)
  }
  return out
}
