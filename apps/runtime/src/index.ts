import { Hono } from 'hono'
import { validarEntrada } from '@maquina/core'
import { produtos } from './registro.gerado'
import type { Env } from './env'

export { CasoWorkflow } from './workflow'

const app = new Hono<{ Bindings: Env }>()

const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

app.get('/saude', (c) => c.json({ ok: true, produtos: Object.keys(produtos) }))

// Tudo abaixo é interno: exige Bearer API_TOKEN (o Studio entra depois, atrás do Cloudflare Access).
app.use('*', async (c, next) => {
  if (c.req.path === '/saude') return next()
  const esperado = c.env.API_TOKEN
  if (!esperado || c.req.header('authorization') !== `Bearer ${esperado}`) return c.json({ erro: 'nao_autorizado' }, 401)
  return next()
})

app.get('/p', (c) =>
  c.json(
    Object.values(produtos).map((p) => ({
      nome: p.nome,
      versao: p.versao,
      estados: p.estados,
      motivos: p.motivos,
      criterioDeMorte: p.criterioDeMorte,
      naoFaremos: p.naoFaremos,
    })),
  ),
)

app.post('/p/:produto/casos', async (c) => {
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

// Reavaliar um caso com dados novos. Caso em estado final só reavalia com ?reabrir=1 (a regra do produto decide se aceita).
app.post('/casos/:id/avaliar', async (c) => {
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

app.get('/casos/:id', async (c) => {
  const id = c.req.param('id')
  const caso = await c.env.DB.prepare('SELECT * FROM casos WHERE id = ?').bind(id).first()
  if (!caso) return c.json({ erro: 'caso_inexistente' }, 404)
  const { results } = await c.env.DB.prepare('SELECT * FROM transicoes WHERE caso_id = ? ORDER BY id').bind(id).all()
  return c.json({ caso, transicoes: results })
})

// "Casos incompletos": não-finais com prazo vencido. Nada fica em análise para sempre.
app.get('/vencidos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM casos WHERE final = 0 AND prazo_ate IS NOT NULL AND prazo_ate < ? ORDER BY prazo_ate').bind(hojeBR()).all()
  return c.json({ hoje: hojeBR(), vencidos: results })
})

export default app
