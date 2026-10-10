import { Hono } from 'hono'
import { validarEntrada } from '@maquina/core'
import { produtos } from './registro.gerado'
import { publico, hojeBR } from './publico'
import { esteira } from './esteira'
import { capturaPublica, capturaInterna, manutencaoCaptura } from './captura'
import { conta, limparContas } from './conta'
import { vitrinePublica, vitrineInterna, produtoDaPagina, comMetaDaMarca } from './vitrine'
import type { Env } from './env'

export { CasoWorkflow } from './workflow'

const app = new Hono<{ Bindings: Env }>()

// Cópia de teste: nunca indexada por buscadores.
app.use('*', async (c, next) => {
  await next()
  if (c.env.AMBIENTE !== 'teste') return
  c.res = new Response(c.res.body, c.res)
  c.res.headers.set('x-robots-tag', 'noindex, nofollow')
})

app.get('/saude', (c) => c.json({ ok: true, ambiente: c.env.AMBIENTE ?? 'producao', produtos: Object.keys(produtos) }))

// Público: a experiência de cada produto, renderizada pelo framework a partir da `tela` declarada.
app.route('/pub/conta', conta)
app.route('/pub', publico)
app.route('/pub', vitrinePublica)
app.route('/pub', capturaPublica)

// Interno: tudo em /api exige Bearer API_TOKEN (Studio). Cloudflare Access entra como 2ª camada.
const api = new Hono<{ Bindings: Env }>()
api.use('*', async (c, next) => {
  const esperado = c.env.API_TOKEN
  if (!esperado || c.req.header('authorization') !== `Bearer ${esperado}`) return c.json({ erro: 'nao_autorizado' }, 401)
  return next()
})

api.get('/p', (c) =>
  c.json(
    Object.values(produtos).map((p) => ({
      nome: p.nome,
      versao: p.versao,
      publico: Boolean(p.tela),
      estados: p.estados,
      motivos: p.motivos,
      criterioDeMorte: p.criterioDeMorte,
      preco: p.preco ?? null,
      naoFaremos: p.naoFaremos,
    })),
  ),
)

api.post('/p/:produto/casos', async (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p) return c.json({ erro: 'produto_desconhecido' }, 404)
  const corpo = await c.req.json().catch(() => null)
  const v = validarEntrada(p, corpo?.entrada)
  if (!v.ok) return c.json({ erro: 'entrada_invalida', detalhes: v.detalhes }, 422)

  const casoId = crypto.randomUUID()
  const agora = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO casos (id, produto, versao, estado, motivo, final, prazo_ate, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, 'recebido', 0, NULL, ?, ?)`,
  ).bind(casoId, p.nome, p.versao, p.estadoInicial, agora, agora).run()

  const inst = await c.env.CASO_WF.create({ id: crypto.randomUUID(), params: { casoId, produto: p.nome, entrada: v.entrada, hoje: hojeBR() } })
  return c.json({ casoId, workflow: inst.id }, 202)
})

// Reavaliar um caso com dados novos. Estado final só reavalia com ?reabrir=1 (a regra do produto decide se aceita).
api.post('/casos/:id/avaliar', async (c) => {
  const caso = await c.env.DB.prepare('SELECT produto, final FROM casos WHERE id = ?').bind(c.req.param('id')).first<{ produto: string; final: number }>()
  if (!caso) return c.json({ erro: 'caso_inexistente' }, 404)
  if (caso.final && c.req.query('reabrir') !== '1') return c.json({ erro: 'caso_em_estado_final', dica: 'use ?reabrir=1 com evidência nova' }, 409)
  const p = produtos[caso.produto]
  if (!p) return c.json({ erro: 'produto_desconhecido' }, 404)
  const corpo = await c.req.json().catch(() => null)
  const v = validarEntrada(p, corpo?.entrada)
  if (!v.ok) return c.json({ erro: 'entrada_invalida', detalhes: v.detalhes }, 422)
  const inst = await c.env.CASO_WF.create({ id: crypto.randomUUID(), params: { casoId: c.req.param('id'), produto: p.nome, entrada: v.entrada, hoje: hojeBR() } })
  return c.json({ workflow: inst.id }, 202)
})

api.get('/casos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM casos ORDER BY atualizado_em DESC LIMIT 100').all()
  return c.json({ casos: results })
})

api.get('/casos/:id', async (c) => {
  const id = c.req.param('id')
  const caso = await c.env.DB.prepare('SELECT * FROM casos WHERE id = ?').bind(id).first()
  if (!caso) return c.json({ erro: 'caso_inexistente' }, 404)
  const { results } = await c.env.DB.prepare('SELECT * FROM transicoes WHERE caso_id = ? ORDER BY id').bind(id).all()
  return c.json({ caso, transicoes: results })
})

// "Casos incompletos": não-finais com prazo vencido. Nada fica em análise para sempre.
api.get('/vencidos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM casos WHERE final = 0 AND prazo_ate IS NOT NULL AND prazo_ate < ? ORDER BY prazo_ate').bind(hojeBR()).all()
  return c.json({ hoje: hojeBR(), vencidos: results })
})

// Sinais do funil: o que mede o critério de morte dos produtos públicos.
api.get('/sinais', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT produto, tipo, COALESCE(motivo, '-') AS motivo, COUNT(*) AS total, MIN(em) AS primeiro, MAX(em) AS ultimo
     FROM sinais GROUP BY produto, tipo, motivo ORDER BY produto, tipo, total DESC`,
  ).all()
  return c.json({ sinais: results })
})

api.get('/interesses', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, produto, contato, motivo, em FROM interesses ORDER BY id DESC LIMIT 200').all()
  return c.json({ interesses: results })
})

api.route('/', esteira)
api.route('/', capturaInterna)
api.route('/', vitrineInterna)

app.route('/api', api)

// Todo o resto (/, /studio, /<produto>) é arquivo estático / SPA, servido pelo binding ASSETS.
app.all('*', async (c) => {
  const r = await c.env.ASSETS.fetch(c.req.raw)
  if (c.req.method !== 'GET' || !(r.headers.get('content-type') ?? '').includes('text/html')) return r
  const url = new URL(c.req.url)
  const p = produtoDaPagina(url, c.req.header('host') ?? '', c.env.DOMINIOS)
  const pagina = p ? comMetaDaMarca(r, p, url) : r
  return c.env.AMBIENTE === 'teste' ? comFaixaDeTeste(pagina) : pagina
})

/** Faixa fixa no topo de toda página da cópia de teste, para ninguém confundir com o serviço de verdade. */
const comFaixaDeTeste = (r: Response) => new HTMLRewriter().on('body', {
  element(e) { e.prepend('<div class="faixa-teste" role="note">Cópia de TESTE. Nada aqui vale como prova, e os dados podem ser apagados.</div>', { html: true }) },
}).transform(r)

export default {
  fetch: app.fetch,
  // Cron: ancora o que faltou, promove a Bitcoin o que já confirmou e reavalia casos abertos.
  async scheduled(_evento: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(manutencaoCaptura(env).then((r) => console.log('manutencao-captura', JSON.stringify(r))))
    ctx.waitUntil(limparContas(env))
  },
} satisfies ExportedHandler<Env>
