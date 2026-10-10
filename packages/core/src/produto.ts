import type { ZodType } from 'zod'
import type { Tela } from './tela'
import { validarTela } from './tela'
import type { Preco } from './preco'
import { validarPreco } from './preco'
import type { Captura } from './captura'
import { validarCaptura } from './captura'

/** Estado final não tem prazo. Estado não-final OBRIGATORIAMENTE tem prazo (nada de "em análise" eterno). */
export type DefEstado = { final: true } | { final: false; prazoDias: number }

export type Veredito<E extends string, M extends string> = { estado: E; motivo: M }

/** Contexto injetado pelo runtime e gravado no log. A regra nunca lê relógio nem rede: replay é determinístico. */
export interface Contexto {
  /** Data de hoje, AAAA-MM-DD, fornecida pelo runtime. */
  hoje: string
}

export interface Efeito {
  /** Nome estável; compõe a chave de idempotência (caso + estado + nome). */
  nome: string
  /** `chave` é estável por caso+estado+efeito: use como idempotency-key no serviço externo (ex.: Pix). */
  executar: (c: { chave: string; casoId: string; produto: string; versao: string; veredito: Veredito<string, string> }) => Promise<void>
}

export interface CriterioDeMorte {
  prazoDias: number
  metrica: string
  minimo: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Produto<E extends string = string, M extends string = string, In = any> {
  nome: string
  versao: `v${number}`
  entrada: ZodType<In>
  estados: Record<E, DefEstado>
  estadoInicial: E
  /** Todo motivo aponta para UM estado. O motor recusa veredito cujo estado não bate com o motivo. */
  motivos: Record<M, E>
  /** Regra pura: sem I/O, sem relógio, sem modelo. */
  regra: (caso: In, ctx: Contexto) => Veredito<E, M>
  /** Efeitos colaterais por estado. Nunca fazem parte da prova da regra. */
  efeitos?: Partial<Record<E, Efeito[]>>
  criterioDeMorte: CriterioDeMorte
  /** Tela pública declarada como DADOS. O framework renderiza; o produto não escreve HTML. Sem tela = produto interno. */
  tela?: Tela<M>
  /** Prazo oficial de um estado não-final, quando ele depende de datas de fato (ex.: data da gravação) e não da data da avaliação. Devolve AAAA-MM-DD. Sem isto: hoje + prazoDias. */
  prazoAte?(caso: In, estado: E, ctx: Contexto): string
  /** Captura de evidência (arquivo + cofre + âncora) gerida pelo framework. Sem isto o produto não recebe arquivos. */
  captura?: Captura<In>
  /** Preço declarado como dado (ver preco.ts). Opcional (produtos antigos seguem válidos); sem preço declarado a plataforma não abre pedido. */
  preco?: Preco
  /** Arquivo "o que não faremos" é obrigatório por produto (ver products/<x>/NAO-FAREMOS.md). */
  naoFaremos: readonly string[]
}

export function defineProduto<E extends string, M extends string, In>(p: Produto<E, M, In>): Produto<E, M, In> {
  const erros = validarProduto(p as Produto)
  if (erros.length) throw new Error(`Produto "${p.nome}" inválido:\n- ${erros.join('\n- ')}`)
  return Object.freeze(p)
}

export function validarProduto(p: Produto): string[] {
  const erros: string[] = []
  const estados = Object.keys(p.estados)
  if (!/^[a-z][a-z0-9-]*$/.test(p.nome)) erros.push('nome deve ser kebab-case minúsculo')
  if (estados.length < 2) erros.push('precisa de ao menos 2 estados')
  if (!estados.includes(p.estadoInicial)) erros.push(`estadoInicial "${p.estadoInicial}" não existe em estados`)
  const finais = estados.filter((e) => p.estados[e]?.final)
  if (finais.length === 0) erros.push('precisa de ao menos um estado final')
  for (const [e, def] of Object.entries(p.estados)) {
    if (!def.final && !(def.prazoDias > 0)) erros.push(`estado "${e}" não é final e não tem prazoDias > 0`)
  }
  if (p.estados[p.estadoInicial]?.final) erros.push('estadoInicial não pode ser final')
  for (const [m, e] of Object.entries(p.motivos)) {
    if (!estados.includes(e as string)) erros.push(`motivo "${m}" aponta para estado inexistente "${e}"`)
  }
  for (const e of estados) {
    if (e === p.estadoInicial) continue
    if (!Object.values(p.motivos).includes(e)) erros.push(`estado "${e}" não tem nenhum motivo que leve a ele`)
  }
  if (!(p.criterioDeMorte.prazoDias > 0)) erros.push('criterioDeMorte.prazoDias deve ser > 0')
  if (!p.criterioDeMorte.metrica) erros.push('criterioDeMorte.metrica é obrigatória')
  if (p.tela) erros.push(...validarTela(p.tela, Object.keys(p.motivos)))
  if (p.preco) erros.push(...validarPreco(p.preco))
  if (p.captura) erros.push(...validarCaptura(p.captura))
  if (p.naoFaremos.length === 0) erros.push('naoFaremos não pode ser vazio: diga o que este produto NÃO faz')
  return erros
}
