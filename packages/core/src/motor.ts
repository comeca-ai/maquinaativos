import type { Contexto, Produto, Veredito } from './produto'

export type Transicao = {
  produto: string
  versao: string
  de: string
  para: string
  motivo: string
  final: boolean
  /** Para estados não-finais: data limite AAAA-MM-DD. */
  prazoAte: string | null
  hashEntrada: string
  hoje: string
}

export type Resultado =
  | { ok: true; veredito: Veredito<string, string>; transicao: Transicao }
  | { ok: false; erro: 'entrada_invalida'; detalhes: string[] }

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** JSON estável (chaves ordenadas) para hash reproduzível. */
export function jsonEstavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${jsonEstavel(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

export async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Valida somente a entrada (usado na porta de entrada da API, antes de criar o caso). */
export function validarEntrada(p: Produto, bruta: unknown): { ok: true; entrada: unknown } | { ok: false; detalhes: string[] } {
  const r = p.entrada.safeParse(bruta)
  if (r.success) return { ok: true, entrada: r.data }
  return { ok: false, detalhes: r.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`) }
}

function prazoDoEstado(p: Produto, entrada: unknown, estado: string, prazoDias: number, ctx: Contexto): string {
  if (!p.prazoAte) return somarDias(ctx.hoje, prazoDias)
  const d = p.prazoAte(entrada, estado, ctx)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`[${p.nome}] prazoAte devolveu data inválida: ${d}`)
  return d
}

/**
 * Executa a regra pura e garante as invariantes da plataforma:
 * estado existe, motivo existe, motivo bate com o estado, estado não-final tem prazo.
 */
export async function executar(p: Produto, bruta: unknown, ctx: Contexto, de?: string): Promise<Resultado> {
  const v = validarEntrada(p, bruta)
  if (!v.ok) return { ok: false, erro: 'entrada_invalida', detalhes: v.detalhes }

  const veredito = p.regra(v.entrada, ctx)
  const def = p.estados[veredito.estado]
  if (!def) throw new Error(`[${p.nome}] regra devolveu estado inexistente: ${veredito.estado}`)
  const alvo = p.motivos[veredito.motivo]
  if (!alvo) throw new Error(`[${p.nome}] regra devolveu motivo inexistente: ${veredito.motivo}`)
  if (alvo !== veredito.estado) {
    throw new Error(`[${p.nome}] motivo "${veredito.motivo}" pertence ao estado "${alvo}", não a "${veredito.estado}"`)
  }

  return {
    ok: true,
    veredito,
    transicao: {
      produto: p.nome,
      versao: p.versao,
      de: de ?? p.estadoInicial,
      para: veredito.estado,
      motivo: veredito.motivo,
      final: def.final,
      prazoAte: def.final ? null : prazoDoEstado(p, v.entrada, veredito.estado, def.prazoDias, ctx),
      hashEntrada: await sha256(jsonEstavel(v.entrada)),
      hoje: ctx.hoje,
    },
  }
}
