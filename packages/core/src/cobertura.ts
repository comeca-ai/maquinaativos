import type { Contexto, Produto } from './produto'
import { executar } from './motor'

/** Caso de teste de um produto: entrada + contexto + o que a regra DEVE responder. */
export interface CasoDeTeste {
  nome: string
  entrada: unknown
  ctx?: Contexto
  espera: { estado: string; motivo: string }
}

export const HOJE_PADRAO: Contexto = { hoje: '2026-03-02' }

/** Quais estados (exceto o inicial) e quais motivos NÃO têm nenhum caso de teste. */
export function lacunas(p: Produto, casos: readonly CasoDeTeste[]) {
  const estadosCobertos = new Set(casos.map((c) => c.espera.estado))
  const motivosCobertos = new Set(casos.map((c) => c.espera.motivo))
  return {
    estados: Object.keys(p.estados).filter((e) => e !== p.estadoInicial && !estadosCobertos.has(e)),
    motivos: Object.keys(p.motivos).filter((m) => !motivosCobertos.has(m)),
  }
}

/** Roda todos os casos e devolve as divergências (lista vazia = tudo certo). */
export async function divergencias(p: Produto, casos: readonly CasoDeTeste[]): Promise<string[]> {
  const out: string[] = []
  for (const c of casos) {
    const r = await executar(p, c.entrada, c.ctx ?? HOJE_PADRAO)
    if (!r.ok) {
      out.push(`${c.nome}: entrada inválida (${r.detalhes.join('; ')})`)
      continue
    }
    if (r.veredito.estado !== c.espera.estado || r.veredito.motivo !== c.espera.motivo) {
      out.push(
        `${c.nome}: esperado ${c.espera.estado}/${c.espera.motivo}, veio ${r.veredito.estado}/${r.veredito.motivo}`,
      )
    }
  }
  return out
}
