import { Hono } from 'hono'
import { sha256 as sha256Texto } from '@maquina/core'
import { produtos } from './registro.gerado'
import { turnstileOk } from './publico'
import { carregar, origemHash } from './captura'
import {
  COOKIE_SESSAO, LINK_MINUTOS, SESSAO_DIAS, contaDaSessao, cookieSessao, hmacHex, lerCookie, mesmaOrigem, normalizarEmail, remetente,
  tokenAleatorio, tokenValido,
} from './sessao'
import { contar, origemDoPedido } from './vitrine'
import type { Env } from './env'

/**
 * Conta por link mágico (Cloudflare Email Service, binding EMAIL).
 * - O e-mail nunca é gravado: só HMAC(SEGREDO_CONTA, email).
 * - O link vale LINK_MINUTOS e uma vez só; guardamos só o hash do token.
 * - O token vai no fragmento (#t=...), que não chega ao servidor numa visita GET: robôs que "abrem" links de e-mail
 *   não consomem o link. Quem entra é a página, com um POST quando a pessoa clica em "Entrar".
 */
export const conta = new Hono<{ Bindings: Env }>()

/** Só oferece o login quando tudo existe E o dono ligou (LOGIN_EMAIL=ligado), depois de verificar o domínio no Email Service. */
const loginLigado = (env: Env): env is Env & { EMAIL: SendEmail; SEGREDO_CONTA: string; EMAIL_REMETENTE: string } =>
  env.LOGIN_EMAIL === 'ligado' && Boolean(env.EMAIL && env.SEGREDO_CONTA && env.EMAIL_REMETENTE)

const MAX_LINKS_POR_EMAIL_15MIN = 3
const MAX_LINKS_POR_ORIGEM_HORA = 10

const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

export function mensagemDoLink(nome: string, link: string, minutos: number) {
  const assunto = `Seu acesso ao ${nome}`
  const texto = `Para entrar no ${nome}, abra este link e toque em "Entrar":\n\n${link}\n\nEle vale ${minutos} minutos e funciona uma vez só.\nSe não foi você que pediu, ignore este e-mail. Ninguém entra sem clicar no link.\n`
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f1ea;color:#141414;font-family:Arial,Helvetica,sans-serif">
<p style="font-size:18px;margin:0 0 16px"><strong>${escapar(nome)}</strong></p>
<p style="font-size:16px;line-height:1.5;margin:0 0 20px">Para entrar, toque no botão abaixo e depois em <strong>Entrar</strong>.</p>
<p style="margin:0 0 24px"><a href="${escapar(link)}" style="display:inline-block;background:#141414;color:#f4f1ea;padding:14px 22px;text-decoration:none;font-weight:bold;border-radius:2px">Abrir meu acesso</a></p>
<p style="font-size:14px;line-height:1.5;color:#555;margin:0 0 8px">O link vale ${minutos} minutos e funciona uma vez só.</p>
<p style="font-size:14px;line-height:1.5;color:#555;margin:0">Se não foi você que pediu, ignore este e-mail.</p>
</body></html>`
  return { assunto, texto, html }
}

// POST /pub/conta/link { email, produto?, vincular?: { id, chave }, turnstile? }
conta.post('/link', async (c) => {
  if (!mesmaOrigem(c)) return c.json({ erro: 'origem_invalida' }, 403)
  const corpo = (await c.req.json().catch(() => null)) as { email?: unknown; produto?: unknown; vincular?: { id?: unknown; chave?: unknown }; turnstile?: unknown } | null
  const ip = c.req.header('cf-connecting-ip')
  if (!(await turnstileOk(c.env, corpo?.turnstile, ip))) return c.json({ erro: 'verificacao_falhou' }, 403)
  const email = normalizarEmail(corpo?.email)
  if (!email) return c.json({ erro: 'email_invalido' }, 422)
  if (!loginLigado(c.env)) return c.json({ erro: 'login_indisponivel' }, 503)

  const produto = typeof corpo?.produto === 'string' && produtos[corpo.produto] ? corpo.produto : null
  const eh = await hmacHex(c.env.SEGREDO_CONTA, `email:${email}`)
  const oh = await origemHash(c.env, ip)
  const agora = new Date()
  const [porEmail, porOrigem] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM links_login WHERE email_hash = ? AND criado_em > ?').bind(eh, new Date(agora.getTime() - 15 * 60_000).toISOString()).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM links_login WHERE origem_hash = ? AND criado_em > ?').bind(oh, new Date(agora.getTime() - 3600_000).toISOString()).first<{ n: number }>(),
  ])
  if ((porEmail?.n ?? 0) >= MAX_LINKS_POR_EMAIL_15MIN || (porOrigem?.n ?? 0) >= MAX_LINKS_POR_ORIGEM_HORA) return c.json({ erro: 'muitas_tentativas' }, 429)

  // Vincular uma prova já guardada: só com o código de recuperação dela (prova que é de quem pede).
  let vincular: string | null = null
  if (corpo?.vincular && produto) {
    const r = await carregar(c.env, produto, String(corpo.vincular.id ?? ''), corpo.vincular.chave)
    if (!r) return c.json({ erro: 'prova_nao_encontrada' }, 404)
    if (!r.conta_id) vincular = r.id
  }

  const token = tokenAleatorio()
  await c.env.DB.prepare('INSERT INTO links_login (token_hash, email_hash, origem_hash, produto, vincular_prova, criado_em, expira_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(await sha256Texto(token), eh, oh, produto, vincular, agora.toISOString(), new Date(agora.getTime() + LINK_MINUTOS * 60_000).toISOString()).run()

  const nome = (produto && produtos[produto]?.captura?.marca?.nome) || 'sua conta'
  const m = mensagemDoLink(nome, `${new URL(c.req.url).origin}/entrar${produto ? `?p=${encodeURIComponent(produto)}` : ''}#t=${token}`, LINK_MINUTOS)
  try {
    await c.env.EMAIL.send({ from: remetente(c.env.EMAIL_REMETENTE), to: email, subject: m.assunto, text: m.texto, html: m.html })
  } catch (e) {
    console.error('email_falhou', (e as { code?: string }).code ?? String(e))
    return c.json({ erro: 'email_falhou' }, 502)
  }
  c.executionCtx.waitUntil(contar(c.env, produto, 'pediu_link', origemDoPedido(c)))
  return c.json({ ok: true, minutos: LINK_MINUTOS })
})

// POST /pub/conta/entrar { token } — consome o link (uma vez) e abre a sessão.
conta.post('/entrar', async (c) => {
  if (!mesmaOrigem(c)) return c.json({ erro: 'origem_invalida' }, 403)
  const corpo = (await c.req.json().catch(() => null)) as { token?: unknown } | null
  if (!tokenValido(corpo?.token)) return c.json({ erro: 'link_invalido' }, 410)
  const agora = new Date().toISOString()
  const link = await c.env.DB.prepare('UPDATE links_login SET usado_em = ? WHERE token_hash = ? AND usado_em IS NULL AND expira_em > ? RETURNING email_hash, vincular_prova, produto')
    .bind(agora, await sha256Texto(corpo.token), agora).first<{ email_hash: string; vincular_prova: string | null; produto: string | null }>()
  if (!link) return c.json({ erro: 'link_invalido' }, 410) // vencido, usado ou inexistente: mesma resposta

  await c.env.DB.prepare('INSERT INTO contas (id, email_hash, criada_em) VALUES (?, ?, ?) ON CONFLICT(email_hash) DO NOTHING').bind(crypto.randomUUID(), link.email_hash, agora).run()
  const contaRow = await c.env.DB.prepare('SELECT id FROM contas WHERE email_hash = ?').bind(link.email_hash).first<{ id: string }>()
  if (!contaRow) return c.json({ erro: 'conta_falhou' }, 500)

  let vinculada = false
  if (link.vincular_prova) {
    const r = await c.env.DB.prepare('UPDATE provas SET conta_id = ? WHERE id = ? AND conta_id IS NULL').bind(contaRow.id, link.vincular_prova).run()
    vinculada = r.meta.changes > 0
  }
  const sessao = tokenAleatorio()
  await c.env.DB.prepare('INSERT INTO sessoes (token_hash, conta_id, criada_em, expira_em) VALUES (?, ?, ?, ?)')
    .bind(await sha256Texto(sessao), contaRow.id, agora, new Date(Date.now() + SESSAO_DIAS * 86400_000).toISOString()).run()
  c.header('set-cookie', cookieSessao(sessao, new URL(c.req.url).protocol === 'https:'))
  c.executionCtx.waitUntil(contar(c.env, link.produto, 'entrou', origemDoPedido(c)))
  c.header('cache-control', 'no-store')
  return c.json({ ok: true, vinculada })
})

conta.get('/eu', async (c) => {
  c.header('cache-control', 'no-store')
  const id = await contaDaSessao(c)
  return c.json({ logado: Boolean(id), loginDisponivel: loginLigado(c.env) })
})

conta.post('/sair', async (c) => {
  if (!mesmaOrigem(c)) return c.json({ erro: 'origem_invalida' }, 403)
  const t = lerCookie(c.req.header('cookie'), COOKIE_SESSAO)
  if (tokenValido(t)) await c.env.DB.prepare('UPDATE sessoes SET encerrada_em = ? WHERE token_hash = ? AND encerrada_em IS NULL').bind(new Date().toISOString(), await sha256Texto(t)).run()
  c.header('set-cookie', cookieSessao('', new URL(c.req.url).protocol === 'https:', 0))
  return c.json({ ok: true })
})

// GET /pub/conta/provas — as provas desta conta, em todos os produtos.
conta.get('/provas', async (c) => {
  c.header('cache-control', 'no-store')
  const id = await contaDaSessao(c)
  if (!id) return c.json({ erro: 'sem_sessao' }, 401)
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.produto, p.nome_arquivo AS nome, p.bytes, p.sha256, p.gravado_em AS recebidoEm, p.ancora, p.ots_altura AS otsAltura, p.vedado, c.estado
     FROM provas p LEFT JOIN casos c ON c.id = p.caso_id WHERE p.conta_id = ? ORDER BY p.gravado_em DESC LIMIT 200`,
  ).bind(id).all()
  return c.json({ provas: results })
})

/** Limpeza agendada: links vencidos há mais de 1 dia e sessões vencidas. Não toca em provas. */
export async function limparContas(env: Env) {
  const ontem = new Date(Date.now() - 86400_000).toISOString()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM links_login WHERE expira_em < ?').bind(ontem),
    env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?').bind(ontem),
  ])
}
