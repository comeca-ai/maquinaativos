import type { Context } from 'hono'
import { sha256 as sha256Texto } from '@maquina/core'
import type { Env } from './env'

/** Sessão por cookie HttpOnly. Tudo aqui é genérico: o framework não sabe de produto. */
export const COOKIE_SESSAO = 'sessao'
export const SESSAO_DIAS = 30
export const LINK_MINUTOS = 15

const enc = new TextEncoder()

/** 32 bytes aleatórios em base64url (43 caracteres). */
export function tokenAleatorio(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const tokenValido = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t)

/** E-mail em forma canônica (minúsculas, sem espaços) ou null se não parecer um e-mail. */
export function normalizarEmail(e: unknown): string | null {
  if (typeof e !== 'string') return null
  const x = e.trim().toLowerCase()
  if (x.length < 6 || x.length > 254) return null
  return /^[^\s@<>()"',;:\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(x) ? x : null
}

export function lerCookie(cabecalho: string | undefined, nome: string): string | null {
  if (!cabecalho) return null
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim()
  }
  return null
}

export function cookieSessao(token: string, https: boolean, maxAgeSeg = SESSAO_DIAS * 86400): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeg}${https ? '; Secure' : ''}`
}

/** "Nome <email@x>" -> { name, email }; "email@x" -> "email@x". */
export function remetente(s: string): string | { name: string; email: string } {
  const m = /^\s*(.+?)\s*<([^>]+)>\s*$/.exec(s)
  return m ? { name: m[1]!, email: m[2]! } : s.trim()
}

export async function hmacHex(chave: string, texto: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(texto)))].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Requisição que muda estado precisa vir da própria página (Origin igual ao host). Defesa extra além do SameSite=Lax. */
/**
 * O pedido veio da nossa própria página? Origin igual ao nosso, ou, quando o navegador manda Origin "null"
 * (formulário que abre aba nova com Referrer-Policy: no-referrer), Sec-Fetch-Site = same-origin. Os dois
 * cabeçalhos são proibidos para scripts: uma página de outro site não consegue forjá-los.
 */
export function mesmaOrigem(c: Pick<Context<{ Bindings: Env }>, 'req'>): boolean {
  const o = c.req.header('origin')
  if (o && o !== 'null') return o === new URL(c.req.url).origin
  return c.req.header('sec-fetch-site') === 'same-origin'
}

/** id da conta logada, ou null. */
export async function contaDaSessao(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const t = lerCookie(c.req.header('cookie'), COOKIE_SESSAO)
  if (!tokenValido(t)) return null
  const r = await c.env.DB.prepare('SELECT conta_id FROM sessoes WHERE token_hash = ? AND encerrada_em IS NULL AND expira_em > ?')
    .bind(await sha256Texto(t), new Date().toISOString()).first<{ conta_id: string }>()
  return r?.conta_id ?? null
}
