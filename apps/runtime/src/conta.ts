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

/** E-mail do link mágico. Layout em tabela e estilos inline (é o que os clientes de e-mail respeitam). */
export function mensagemDoLink(nome: string, link: string, minutos: number, destaque?: string) {
  const assunto = `Seu acesso ao ${nome}`
  const texto = `Toque no link para entrar no ${nome}:\n\n${link}\n\nEle abre a página do ${nome}. Lá, toque em "Entrar" e pronto.\nO link vale ${minutos} minutos e funciona uma vez só.\nNão foi você que pediu? Ignore este e-mail. Ninguém entra sem tocar no link.\n\n${nome} · esta caixa não recebe respostas.\n`
  const marca = destaque && nome.endsWith(destaque)
    ? `${escapar(nome.slice(0, nome.length - destaque.length))}<span style="color:#C52D23">${escapar(destaque)}</span>`
    : escapar(nome)
  const l = escapar(link)
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${escapar(assunto)}</title></head>
<body style="margin:0;padding:0;background:#E4DFD5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E4DFD5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#F6F3ED;border:1px solid #CCC6BD"><tr><td style="padding:32px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:#161311">
<p style="margin:0 0 22px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:24px;line-height:1;letter-spacing:0.5px;text-transform:uppercase">${marca}</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:bold">Toque no botão para entrar.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55">Ele abre a página do ${escapar(nome)}. Lá, toque em <strong>Entrar</strong> e pronto: o que você guardou aparece em Minhas provas.</p>
<a href="${l}" style="display:inline-block;background:#161311;color:#F6F3ED;padding:15px 26px;font-size:16px;font-weight:bold;text-decoration:none;border-radius:2px">Abrir meu acesso</a>
<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #CCC6BD;font-size:14px;line-height:1.5;color:#554E49">O link vale <strong style="color:#161311">${minutos} minutos</strong> e funciona <strong style="color:#161311">uma vez só</strong>.<br>Não foi você que pediu? Ignore este e-mail. Ninguém entra sem tocar no botão.</p>
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#554E49">${escapar(nome)} · esta caixa não recebe respostas.</p>
</td></tr></table>
<p style="margin:16px 0 0;max-width:520px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#554E49">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${l}</span></p>
</td></tr></table>
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

  const marca = produto ? produtos[produto]?.captura?.marca : undefined
  const m = mensagemDoLink(marca?.nome || 'sua conta', `${new URL(c.req.url).origin}/entrar${produto ? `?p=${encodeURIComponent(produto)}` : ''}#t=${token}`, LINK_MINUTOS, marca?.destaque)
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
  const ligado = loginLigado(c.env)
  // remetente: só o endereço, para a dica "procure por ... no spam"; sessaoDias: quanto tempo a pessoa fica conectada.
  const remetenteEmail = ligado ? (/<([^>]+)>/.exec(c.env.EMAIL_REMETENTE!)?.[1] ?? c.env.EMAIL_REMETENTE) : null
  return c.json({ logado: Boolean(id), loginDisponivel: ligado, remetente: remetenteEmail, sessaoDias: SESSAO_DIAS, linkMinutos: LINK_MINUTOS })
})

// POST /pub/conta/vincular { produto, id, chave } — logado, traz para a conta uma prova guardada antes (prova de posse: o código).
conta.post('/vincular', async (c) => {
  if (!mesmaOrigem(c)) return c.json({ erro: 'origem_invalida' }, 403)
  const contaId = await contaDaSessao(c)
  if (!contaId) return c.json({ erro: 'sem_sessao' }, 401)
  const corpo = (await c.req.json().catch(() => null)) as { produto?: unknown; id?: unknown; chave?: unknown } | null
  const produto = typeof corpo?.produto === 'string' && produtos[corpo.produto] ? corpo.produto : null
  if (!produto) return c.json({ erro: 'produto_invalido' }, 422)
  const r = await carregar(c.env, produto, String(corpo?.id ?? '').trim(), typeof corpo?.chave === 'string' ? corpo.chave.trim() : corpo?.chave)
  if (!r) return c.json({ erro: 'prova_nao_encontrada' }, 404) // id inexistente e código errado: mesma resposta
  if (r.conta_id === contaId) return c.json({ ok: true, jaEstava: true })
  if (r.conta_id) return c.json({ erro: 'outra_conta' }, 409)
  const u = await c.env.DB.prepare('UPDATE provas SET conta_id = ? WHERE id = ? AND conta_id IS NULL').bind(contaId, r.id).run()
  return u.meta.changes ? c.json({ ok: true }) : c.json({ erro: 'outra_conta' }, 409)
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
