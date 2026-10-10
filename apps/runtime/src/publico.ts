import { Hono } from 'hono'
import { executar, montarEntrada } from '@maquina/core'
import { produtos } from './registro.gerado'
import type { Env } from './env'

export const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const publicos = () => Object.values(produtos).filter((p) => p.tela || p.captura)

export async function turnstileOk(env: Env, token: unknown, ip: string | undefined): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true // sem segredo configurado = verificação desligada (dev)
  if (typeof token !== 'string' || !token) return false
  const form = new FormData()
  form.set('secret', env.TURNSTILE_SECRET)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  const j = (await r.json().catch(() => null)) as { success?: boolean } | null
  return j?.success === true
}

/** Rotas públicas: sem token, sem dado pessoal gravado no avaliar. A regra roda aqui mesmo (é pura e barata). */
export const publico = new Hono<{ Bindings: Env }>()

publico.get('/produtos', (c) =>
  c.json(publicos().map((p) => ({ nome: p.nome, titulo: (p.tela ?? p.captura)!.titulo, subtitulo: (p.tela ?? p.captura)!.subtitulo }))),
)

publico.get('/:produto/tela', (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p?.tela) return c.json({ erro: 'produto_nao_publico' }, 404)
  return c.json({ nome: p.nome, versao: p.versao, tela: p.tela, turnstileSitekey: c.env.TURNSTILE_SITEKEY ?? null })
})

publico.post('/:produto/avaliar', async (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p?.tela) return c.json({ erro: 'produto_nao_publico' }, 404)
  const corpo = (await c.req.json().catch(() => null)) as { valores?: Record<string, unknown>; turnstile?: string } | null
  if (!(await turnstileOk(c.env, corpo?.turnstile, c.req.header('cf-connecting-ip')))) return c.json({ erro: 'verificacao_falhou' }, 403)

  const entrada = montarEntrada(p.tela, corpo?.valores ?? {})
  const r = await executar(p, entrada, { hoje: hojeBR() })
  if (!r.ok) return c.json({ erro: 'entrada_invalida', detalhes: r.detalhes }, 422)

  const { motivo } = r.veredito
  await c.env.DB.prepare('INSERT INTO sinais (produto, tipo, motivo, em) VALUES (?, ?, ?, ?)').bind(p.nome, 'avaliou', motivo, new Date().toISOString()).run()
  return c.json({
    estado: r.veredito.estado,
    motivo,
    final: r.transicao.final,
    prazoAte: r.transicao.prazoAte,
    texto: p.tela.resultados[motivo],
    oferecerAjuda: p.tela.oferecerAjudaEm.includes(motivo),
    textoAjuda: p.tela.textoAjuda,
  })
})

publico.post('/:produto/interesse', async (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p?.tela) return c.json({ erro: 'produto_nao_publico' }, 404)
  const corpo = (await c.req.json().catch(() => null)) as { contato?: string; consentimento?: boolean; motivo?: string; turnstile?: string } | null
  if (!(await turnstileOk(c.env, corpo?.turnstile, c.req.header('cf-connecting-ip')))) return c.json({ erro: 'verificacao_falhou' }, 403)
  const contato = (corpo?.contato ?? '').trim()
  if (contato.length < 5 || contato.length > 200) return c.json({ erro: 'contato_invalido' }, 422)
  if (corpo?.consentimento !== true) return c.json({ erro: 'sem_consentimento' }, 422)
  const motivo = corpo.motivo && p.motivos[corpo.motivo as keyof typeof p.motivos] ? corpo.motivo : null
  const agora = new Date().toISOString()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO interesses (produto, contato, motivo, consentimento, em) VALUES (?, ?, ?, 1, ?)').bind(p.nome, contato, motivo, agora),
    c.env.DB.prepare("INSERT INTO sinais (produto, tipo, motivo, em) VALUES (?, 'quero_ajuda', ?, ?)").bind(p.nome, motivo, agora),
  ])
  return c.json({ ok: true })
})

// Preço declarado no contrato (público: a pessoa vê o que é grátis e o que é pago ANTES de qualquer pedido).
publico.get('/:produto/preco', (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p?.tela) return c.json({ erro: 'produto_nao_publico' }, 404)
  return c.json({ preco: p.preco ?? null })
})

// Pedido manual (passo 1): só registra a intenção, com consentimento. O pagamento é combinado fora (Pix); Studio marca "pago".
publico.post('/:produto/pedido', async (c) => {
  const p = produtos[c.req.param('produto')]
  if (!p?.tela) return c.json({ erro: 'produto_nao_publico' }, 404)
  if (p.preco?.modelo !== 'por_caso' && p.preco?.modelo !== 'assinatura') return c.json({ erro: 'produto_sem_cobranca' }, 409)
  const corpo = (await c.req.json().catch(() => null)) as { contato?: string; consentimento?: boolean; turnstile?: string } | null
  if (!(await turnstileOk(c.env, corpo?.turnstile, c.req.header('cf-connecting-ip')))) return c.json({ erro: 'verificacao_falhou' }, 403)
  const contato = (corpo?.contato ?? '').trim()
  if (contato.length < 5 || contato.length > 200) return c.json({ erro: 'contato_invalido' }, 422)
  if (corpo?.consentimento !== true) return c.json({ erro: 'sem_consentimento' }, 422)
  await c.env.DB.prepare("INSERT INTO pedidos (id, produto, valor_centavos, status, contato, consentimento, criado_em) VALUES (?, ?, ?, 'pendente', ?, 1, ?)")
    .bind(crypto.randomUUID(), p.nome, p.preco.centavos ?? 0, contato, new Date().toISOString()).run()
  return c.json({ ok: true, valorCentavos: p.preco.centavos })
})
