import { Hono } from 'hono'
import type { Produto } from '@maquina/core'
import { produtos } from './registro.gerado'
import { hojeBR } from './publico'
import type { Env } from './env'

/** Funil da vitrine: contadores agregados por dia (sem dado pessoal). */
export const ETAPAS = ['visita', 'consentiu', 'escolheu', 'guardou', 'baixou', 'pediu_link', 'entrou'] as const
export type Etapa = (typeof ETAPAS)[number]
const ETAPAS_DO_NAVEGADOR: readonly Etapa[] = ['visita', 'consentiu', 'escolheu']

export async function contar(env: Env, produto: string | null | undefined, etapa: Etapa): Promise<void> {
  if (!produto || !produtos[produto]) return
  try {
    await env.DB.prepare('INSERT INTO contagem_vitrine (produto, etapa, dia, total) VALUES (?, ?, ?, 1) ON CONFLICT(produto, etapa, dia) DO UPDATE SET total = total + 1')
      .bind(produto, etapa, hojeBR()).run()
  } catch { /* contar nunca derruba o fluxo principal */ }
}

export const vitrinePublica = new Hono<{ Bindings: Env }>()
// POST /pub/:produto/evento { etapa } — só as etapas que acontecem no navegador; o resto o servidor conta sozinho.
vitrinePublica.post('/:produto/evento', async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { etapa?: unknown } | null
  const etapa = ETAPAS_DO_NAVEGADOR.find((e) => e === corpo?.etapa)
  if (!etapa) return c.json({ erro: 'etapa_invalida' }, 422)
  await contar(c.env, c.req.param('produto'), etapa)
  return c.body(null, 204)
})

export const vitrineInterna = new Hono<{ Bindings: Env }>()
// GET /api/funil?dias=14
vitrineInterna.get('/funil', async (c) => {
  const dias = Math.min(90, Math.max(1, Number(c.req.query('dias') ?? 14) || 14))
  const desde = new Date(Date.now() - (dias - 1) * 86400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const { results } = await c.env.DB.prepare('SELECT produto, etapa, SUM(total) AS total FROM contagem_vitrine WHERE dia >= ? GROUP BY produto, etapa').bind(desde).all<{ produto: string; etapa: Etapa; total: number }>()
  const porProduto: Record<string, Record<string, number>> = {}
  for (const r of results) (porProduto[r.produto] ??= {})[r.etapa] = r.total
  return c.json({ desde, dias, etapas: ETAPAS, porProduto })
})

/* ---------- prévia de compartilhamento (WhatsApp, redes): meta tags no HTML da marca ---------- */
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

export function produtoDaPagina(url: URL, host: string, dominios: string | undefined): Produto | null {
  const partes = url.pathname.split('/').filter(Boolean)
  let nome: string | null | undefined
  if (partes.length === 0) {
    try { nome = (JSON.parse(dominios ?? '{}') as Record<string, string>)[host.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')] } catch { nome = null }
  } else if (partes[0] === 'entrar' || partes[0] === 'minhas-provas') nome = url.searchParams.get('p')
  else nome = decodeURIComponent(partes[0]!)
  const p = nome && Object.hasOwn(produtos, nome) ? produtos[nome] : null
  return p?.captura?.marca ? p : null
}

export function comMetaDaMarca(r: Response, p: Produto, url: URL): Response {
  const cap = p.captura!, m = cap.marca!
  const titulo = `${m.nome} — ${m.promessa}`
  const imagem = `${url.origin}/marcas/${encodeURIComponent(p.nome)}/og.png`
  const metas = [
    `<meta name="description" content="${esc(cap.subtitulo)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(m.nome)}">`,
    `<meta property="og:title" content="${esc(m.promessa)}">`,
    `<meta property="og:description" content="${esc(cap.subtitulo)}">`,
    `<meta property="og:url" content="${esc(url.origin + url.pathname)}">`,
    `<meta property="og:image" content="${esc(imagem)}">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="preload" href="/fontes/anton-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="preload" href="/fontes/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>`,
  ].join('\n')
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(titulo) } })
    .on('head', { element(e) { e.append(metas, { html: true }) } })
    .transform(r)
}
