import { Hono } from 'hono'
import { produtos } from './registro.gerado'
import { hojeBR } from './publico'
import type { Env } from './env'

/** Esteira, pedidos manuais, custos e métricas. Montado dentro de /api (já exige Bearer). */
export const esteira = new Hono<{ Bindings: Env }>()

const SELECT_IDEIA = `SELECT i.*, c.estado AS estado, c.motivo AS motivo, c.final AS final, c.prazo_ate AS prazo_ate
  FROM ideias i LEFT JOIN casos c ON c.id = i.caso_id`

const int = (v: unknown, padrao = 0) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : padrao)
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

esteira.get('/ideias', async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT_IDEIA} ORDER BY i.atualizado_em DESC LIMIT 200`).all()
  return c.json({ hoje: hojeBR(), ideias: results })
})

esteira.post('/ideias', async (c) => {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const titulo = texto(b?.titulo, 120)
  const dor = texto(b?.dor, 1000)
  if (titulo.length < 3 || dor.length < 10) return c.json({ erro: 'ficha_incompleta', dica: 'título (3+) e dor (10+ caracteres)' }, 422)
  const id = crypto.randomUUID()
  const agora = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO ideias (id, titulo, dor, quem_paga, inicio, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, titulo, dor, texto(b?.quemPaga, 300), hojeBR(), agora, agora).run()
  return c.json({ id }, 201)
})

// Atualiza a planilha e a evidência (os números que o funil lê). Não mexe no estado: quem decide é a regra.
esteira.patch('/ideias/:id', async (c) => {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return c.json({ erro: 'corpo_invalido' }, 422)
  const atual = await c.env.DB.prepare('SELECT * FROM ideias WHERE id = ?').bind(c.req.param('id')).first<Record<string, number | string>>()
  if (!atual) return c.json({ erro: 'ideia_inexistente' }, 404)
  const margem = Number.isInteger(b.margemPorCasoCentavos) ? (b.margemPorCasoCentavos as number) : (atual.margem_por_caso_centavos as number)
  await c.env.DB.prepare(
    `UPDATE ideias SET conversas_reais=?, disposicao_a_pagar=?, margem_por_caso_centavos=?, evidencia_dor=?, sacada_copiavel=?, notas=?, quem_paga=?, produto_alvo=?, atualizado_em=? WHERE id=?`,
  ).bind(
    int(b.conversasReais, atual.conversas_reais as number),
    int(b.disposicaoAPagar, atual.disposicao_a_pagar as number),
    margem,
    typeof b.evidenciaDor === 'boolean' ? Number(b.evidenciaDor) : atual.evidencia_dor,
    typeof b.sacadaCopiavel === 'boolean' ? Number(b.sacadaCopiavel) : atual.sacada_copiavel,
    typeof b.notas === 'string' ? texto(b.notas, 2000) : atual.notas,
    typeof b.quemPaga === 'string' ? texto(b.quemPaga, 300) : atual.quem_paga,
    typeof b.produtoAlvo === 'string' ? texto(b.produtoAlvo, 60) || null : atual.produto_alvo,
    new Date().toISOString(),
    c.req.param('id'),
  ).run()
  return c.json({ ok: true })
})

// Roda o funil (produto "funil") sobre a ficha. Estado oficial vive em `casos`; o log é append-only.
esteira.post('/ideias/:id/avaliar', async (c) => {
  const funil = produtos['funil']
  if (!funil) return c.json({ erro: 'funil_nao_registrado' }, 500)
  const i = await c.env.DB.prepare(`${SELECT_IDEIA} WHERE i.id = ?`).bind(c.req.param('id')).first<Record<string, string | number | null>>()
  if (!i) return c.json({ erro: 'ideia_inexistente' }, 404)
  if (i.final) return c.json({ erro: 'ideia_em_estado_final', dica: 'reabrir exige evidência nova (rota /api/casos/:id/avaliar?reabrir=1)' }, 409)

  const agora = new Date().toISOString()
  let casoId = i.caso_id as string | null
  if (!casoId) {
    casoId = crypto.randomUUID()
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO casos (id, produto, versao, estado, motivo, final, prazo_ate, criado_em, atualizado_em) VALUES (?, 'funil', ?, ?, 'recebido', 0, NULL, ?, ?)`,
      ).bind(casoId, funil.versao, funil.estadoInicial, agora, agora),
      c.env.DB.prepare('UPDATE ideias SET caso_id = ?, atualizado_em = ? WHERE id = ?').bind(casoId, agora, i.id),
    ])
  }
  const entrada = {
    inicio: i.inicio,
    conversasReais: i.conversas_reais,
    disposicaoAPagar: i.disposicao_a_pagar,
    margemPorCasoCentavos: i.margem_por_caso_centavos,
    evidenciaDor: Boolean(i.evidencia_dor),
    sacadaCopiavel: Boolean(i.sacada_copiavel),
  }
  const inst = await c.env.CASO_WF.create({ id: crypto.randomUUID(), params: { casoId, produto: 'funil', entrada, hoje: hojeBR() } })
  return c.json({ casoId, workflow: inst.id }, 202)
})

/* ---------- preço e pedidos (pagamento manual) ---------- */
esteira.get('/pedidos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT 200').all()
  return c.json({ pedidos: results })
})

esteira.post('/pedidos/:id/pago', async (c) => {
  const r = await c.env.DB.prepare("UPDATE pedidos SET status='pago', pago_em=? WHERE id=? AND status='pendente'").bind(new Date().toISOString(), c.req.param('id')).run()
  return r.meta.changes ? c.json({ ok: true }) : c.json({ erro: 'pedido_nao_pendente' }, 409)
})

esteira.post('/pedidos/:id/cancelar', async (c) => {
  const r = await c.env.DB.prepare("UPDATE pedidos SET status='cancelado' WHERE id=? AND status='pendente'").bind(c.req.param('id')).run()
  return r.meta.changes ? c.json({ ok: true }) : c.json({ erro: 'pedido_nao_pendente' }, 409)
})

esteira.post('/custos', async (c) => {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const produto = texto(b?.produto, 60)
  if (!produto || !Number.isInteger(b?.centavos) || (b!.centavos as number) < 0) return c.json({ erro: 'custo_invalido' }, 422)
  await c.env.DB.prepare('INSERT INTO custos (produto, tipo, centavos, nota, em) VALUES (?, ?, ?, ?, ?)')
    .bind(produto, texto(b?.tipo, 40) || 'outro', b!.centavos, texto(b?.nota, 200), new Date().toISOString()).run()
  return c.json({ ok: true }, 201)
})

/* ---------- métricas ---------- */
esteira.get('/metricas', async (c) => {
  const db = c.env.DB
  const [ideias, vivas, pedidos, custos, casos] = await Promise.all([
    db.prepare(`SELECT COALESCE(c.estado,'rascunho') AS estado, COUNT(*) AS total FROM ideias i LEFT JOIN casos c ON c.id=i.caso_id GROUP BY 1`).all<{ estado: string; total: number }>(),
    db.prepare(`SELECT AVG(julianday(c.atualizado_em) - julianday(i.criado_em)) AS dias FROM ideias i JOIN casos c ON c.id=i.caso_id WHERE c.estado='viva'`).first<{ dias: number | null }>(),
    db.prepare(`SELECT produto, status, COUNT(*) AS total, COALESCE(SUM(valor_centavos),0) AS centavos FROM pedidos GROUP BY produto, status`).all<{ produto: string; status: string; total: number; centavos: number }>(),
    db.prepare(`SELECT produto, COALESCE(SUM(centavos),0) AS centavos FROM custos GROUP BY produto`).all<{ produto: string; centavos: number }>(),
    db.prepare(`SELECT produto, COUNT(*) AS total FROM casos WHERE produto <> 'funil' GROUP BY produto`).all<{ produto: string; total: number }>(),
  ])
  const receita: Record<string, number> = {}
  for (const p of pedidos.results) if (p.status === 'pago') receita[p.produto] = (receita[p.produto] ?? 0) + p.centavos
  const custo: Record<string, number> = Object.fromEntries(custos.results.map((x) => [x.produto, x.centavos]))
  const nomes = new Set([...Object.keys(receita), ...Object.keys(custo), ...casos.results.map((x) => x.produto)])
  const porProduto = [...nomes].map((produto) => {
    const nCasos = casos.results.find((x) => x.produto === produto)?.total ?? 0
    const r = receita[produto] ?? 0
    const k = custo[produto] ?? 0
    return {
      produto, casos: nCasos, receitaCentavos: r, custoCentavos: k, margemCentavos: r - k,
      custoPorCasoCentavos: nCasos ? Math.round(k / nCasos) : null,
      precoDeclarado: produtos[produto]?.preco ?? null,
    }
  })
  return c.json({
    ideiasPorEstado: ideias.results,
    diasIdeiaAteViva: vivas?.dias == null ? null : Math.round(vivas.dias * 10) / 10,
    pedidosPorStatus: pedidos.results,
    porProduto,
  })
})
