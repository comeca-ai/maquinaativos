import { Hono } from 'hono'
import type { Produto } from '@maquina/core'
import { produtos } from './registro.gerado'
import { hojeBR } from './publico'
import type { Env } from './env'

/** Funil da vitrine: contadores agregados por dia (sem dado pessoal). */
export const ETAPAS = ['visita', 'consentiu', 'escolheu', 'guardou', 'baixou', 'pediu_link', 'entrou'] as const
export type Etapa = (typeof ETAPAS)[number]
const ETAPAS_DO_NAVEGADOR: readonly Etapa[] = ['visita', 'consentiu', 'escolheu']

/* ---------- origem da visita (sem cookie): de onde a pessoa veio ---------- */
const ORIGENS_CONHECIDAS: readonly [RegExp, string][] = [
  [/(^|\.)instagram\.com$|^ig$|instagram/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^fb$|facebook/, 'facebook'],
  [/(^|\.)(whatsapp\.com|wa\.me)$|whatsapp|^wpp$|^zap$/, 'whatsapp'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$|^twitter$|^x$/, 'x'],
  [/(^|\.)tiktok\.com$|tiktok/, 'tiktok'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$|linkedin/, 'linkedin'],
  [/(^|\.)(youtube\.com|youtu\.be)$|youtube/, 'youtube'],
  [/(^|\.)(telegram\.org|t\.me)$|telegram/, 'telegram'],
  [/(^|\.)kwai\.com$|kwai/, 'kwai'],
  [/(^|\.)reddit\.com$|reddit/, 'reddit'],
  [/^mail\.|(^|\.)(outlook\.(com|live\.com)|mail\.yahoo\.com)$|^e-?mail$|^newsletter$/, 'email'],
  [/(^|\.)google\.[a-z.]+$|^google$/, 'google'],
  [/(^|\.)bing\.com$|^bing$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(chatgpt\.com|openai\.com)$|chatgpt/, 'chatgpt'],
  [/(^|\.)perplexity\.ai$|perplexity/, 'perplexity'],
  [/(^|\.)claude\.ai$/, 'claude'],
]
/** Máximo de origens diferentes por produto e dia; acima disso, "outro". */
export const TETO_ORIGENS_POR_DIA = 40

/**
 * Normaliza a origem enviada pelo navegador: utm_source ou o nome do site de onde a pessoa veio.
 * Nunca guarda URL, caminho ou parâmetro: só um rótulo curto. Pura (testável).
 */
export function normalizarOrigem(bruta: unknown): string {
  if (typeof bruta !== 'string') return 'direto'
  const v = bruta.trim().toLowerCase().slice(0, 80)
  if (!v || v === 'direto') return 'direto'
  const host = v.replace(/^https?:\/\//, '').split(/[/?#:]/)[0]!.replace(/^www\./, '')
  for (const [re, nome] of ORIGENS_CONHECIDAS) if (re.test(host)) return nome
  if (/^[a-z0-9][a-z0-9.-]{0,60}\.[a-z]{2,}$/.test(host)) return host  // outro site (só o domínio)
  if (/^[a-z0-9][a-z0-9_-]{0,29}$/.test(v)) return `utm:${v}`          // campanha própria (utm_source simples)
  return 'outro'
}

/** Contador do funil. Com `origemBruta`, conta também por origem (com teto de origens por dia). */
export async function contar(env: Env, produto: string | null | undefined, etapa: Etapa, origemBruta?: unknown): Promise<void> {
  if (!produto || !produtos[produto]) return
  const dia = hojeBR()
  try {
    await env.DB.prepare('INSERT INTO contagem_vitrine (produto, etapa, dia, total) VALUES (?, ?, ?, 1) ON CONFLICT(produto, etapa, dia) DO UPDATE SET total = total + 1')
      .bind(produto, etapa, dia).run()
    if (origemBruta === undefined) return
    let origem = normalizarOrigem(origemBruta)
    if (origem !== 'direto' && origem !== 'outro') {
      const r = await env.DB.prepare('SELECT COUNT(DISTINCT origem) AS n, MAX(origem = ?) AS existe FROM contagem_origem WHERE produto = ? AND dia = ?')
        .bind(origem, produto, dia).first<{ n: number; existe: number | null }>()
      if (!r?.existe && (r?.n ?? 0) >= TETO_ORIGENS_POR_DIA) origem = 'outro'
    }
    await env.DB.prepare('INSERT INTO contagem_origem (produto, dia, origem, etapa, total) VALUES (?, ?, ?, ?, 1) ON CONFLICT(produto, dia, origem, etapa) DO UPDATE SET total = total + 1')
      .bind(produto, dia, origem, etapa).run()
  } catch { /* contar nunca derruba o fluxo principal */ }
}

/** Origem que o navegador mandou num pedido do servidor (envio, download). Ausente = "desconhecida". */
export const origemDoPedido = (c: { req: { header: (n: string) => string | undefined } }) => {
  const h = c.req.header('x-funil-origem')
  if (!h) return 'desconhecida'
  try { return decodeURIComponent(h) } catch { return 'outro' }
}

export const vitrinePublica = new Hono<{ Bindings: Env }>()
// POST /pub/:produto/evento { etapa, origem? } — só as etapas que acontecem no navegador; o resto o servidor conta sozinho.
vitrinePublica.post('/:produto/evento', async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { etapa?: unknown; origem?: unknown } | null
  const etapa = ETAPAS_DO_NAVEGADOR.find((e) => e === corpo?.etapa)
  if (!etapa) return c.json({ erro: 'etapa_invalida' }, 422)
  await contar(c.env, c.req.param('produto'), etapa, corpo?.origem ?? 'direto')
  return c.body(null, 204)
})

export const vitrineInterna = new Hono<{ Bindings: Env }>()
const desdeDias = (dias: number) => new Date(Date.now() - (dias - 1) * 86400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// GET /api/funil?dias=14
vitrineInterna.get('/funil', async (c) => {
  const dias = Math.min(90, Math.max(1, Number(c.req.query('dias') ?? 14) || 14))
  const desde = desdeDias(dias)
  const [etapas, origens] = await Promise.all([
    c.env.DB.prepare('SELECT produto, etapa, SUM(total) AS total FROM contagem_vitrine WHERE dia >= ? GROUP BY produto, etapa').bind(desde).all<{ produto: string; etapa: Etapa; total: number }>(),
    c.env.DB.prepare('SELECT produto, origem, etapa, SUM(total) AS total FROM contagem_origem WHERE dia >= ? GROUP BY produto, origem, etapa').bind(desde).all<{ produto: string; origem: string; etapa: Etapa; total: number }>(),
  ])
  const porProduto: Record<string, Record<string, number>> = {}
  for (const r of etapas.results) (porProduto[r.produto] ??= {})[r.etapa] = r.total
  const porOrigem: Record<string, Record<string, Record<string, number>>> = {}
  for (const r of origens.results) ((porOrigem[r.produto] ??= {})[r.origem] ??= {})[r.etapa] = r.total
  return c.json({ desde, dias, etapas: ETAPAS, porProduto, porOrigem })
})

// GET /api/retorno?dias=30 — quem VOLTOU, calculado do log de acessos que já existe (nada novo é coletado).
// "Voltou" = baixou o pacote ou abriu o relatório 24 h ou mais depois de guardar (sem contar equipe e sistema).
vitrineInterna.get('/retorno', async (c) => {
  const dias = Math.min(180, Math.max(1, Number(c.req.query('dias') ?? 30) || 30))
  const desde = desdeDias(dias)
  const umDiaAtras = new Date(Date.now() - 86400_000).toISOString()
  const [provas, contas] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.produto,
              COUNT(*) AS provas,
              SUM(p.gravado_em <= ?2) AS elegiveis,
              SUM(EXISTS (SELECT 1 FROM acessos a WHERE a.prova_id = p.id AND a.tipo IN ('pacote', 'relatorio') AND COALESCE(a.origem_hash, '') NOT IN ('equipe', 'cron'))) AS baixaram,
              SUM(p.gravado_em <= ?2 AND EXISTS (SELECT 1 FROM acessos a WHERE a.prova_id = p.id AND a.tipo IN ('pacote', 'relatorio') AND COALESCE(a.origem_hash, '') NOT IN ('equipe', 'cron')
                  AND a.em >= strftime('%Y-%m-%dT%H:%M:%fZ', p.gravado_em, '+1 day'))) AS voltaram,
              SUM(p.conta_id IS NOT NULL) AS na_conta
       FROM provas p WHERE p.gravado_em_dia >= ?1 GROUP BY p.produto`,
    ).bind(desde, umDiaAtras).all<{ produto: string; provas: number; elegiveis: number; baixaram: number; voltaram: number; na_conta: number }>(),
    c.env.DB.prepare(
      `SELECT produto, COUNT(*) AS contas, SUM(n >= 2) AS com_duas_ou_mais
       FROM (SELECT produto, conta_id, COUNT(*) AS n FROM provas WHERE conta_id IS NOT NULL AND gravado_em_dia >= ? GROUP BY produto, conta_id) GROUP BY produto`,
    ).bind(desde).all<{ produto: string; contas: number; com_duas_ou_mais: number }>(),
  ])
  const porProduto: Record<string, Record<string, number>> = {}
  for (const r of provas.results) porProduto[r.produto] = { provas: r.provas, elegiveis: r.elegiveis ?? 0, baixaram: r.baixaram ?? 0, voltaram: r.voltaram ?? 0, naConta: r.na_conta ?? 0, contas: 0, contasComDuasOuMais: 0 }
  for (const r of contas.results) Object.assign(porProduto[r.produto] ??= { provas: 0, elegiveis: 0, baixaram: 0, voltaram: 0, naConta: 0 }, { contas: r.contas, contasComDuasOuMais: r.com_duas_ou_mais ?? 0 })
  return c.json({ desde, dias, porProduto })
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
