import { Hono, type Context } from 'hono'
import { executar, jsonEstavel, sha256 as sha256Texto, type FatosCaptura, type Produto } from '@maquina/core'
import { ancorar, atualizar, alturasBitcoin, zipStore, AGREGADORES_PADRAO } from '@maquina/kits'
import { produtos } from './registro.gerado'
import { hojeBR, turnstileOk } from './publico'
import { contaDaSessao } from './sessao'
import type { Env } from './env'

/**
 * Captura de evidência (genérica): o framework recebe o arquivo, guarda no cofre R2 PRIVADO, monta o manifesto,
 * ancora o hash do manifesto no OpenTimestamps e transforma tudo em FATOS. Quem decide o estado é a regra pura do produto.
 * Segurança: o Worker de escrita NUNCA apaga nem sobrescreve (put com etagDoesNotMatch; sem rota de delete);
 * todo acesso entra em `acessos` (append-only); o IP nunca é gravado (só HMAC).
 */
export const capturaPublica = new Hono<{ Bindings: Env }>()

const TETO_RECUSAS_24H = 20
const enc = new TextEncoder()
const hexDe = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b instanceof Uint8Array ? b : b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const diaBR = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function produtoDeCaptura(nome: string): Produto | null {
  const p = produtos[nome]
  return p?.captura ? p : null
}

export async function origemHash(env: Env, ip: string | undefined): Promise<string> {
  const chave = env.SEGREDO_ORIGEM || env.API_TOKEN || 'dev'
  const k = await crypto.subtle.importKey('raw', enc.encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hexDe(await crypto.subtle.sign('HMAC', k, enc.encode(ip ?? 'sem-ip')))
}

function iguaisConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

const nomeSeguro = (n: string | undefined) => (n ?? 'arquivo').replace(/[\\/\u0000-\u001f"]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'arquivo'
const mimeOk = (c: NonNullable<Produto['captura']>, mime: string) => c.tiposMime.some((t) => mime === t || (t.endsWith('/') && mime.startsWith(t)))

export interface LinhaProva {
  id: string; produto: string; caso_id: string; chave_hash: string; origem: string; nome_arquivo: string; mime: string; bytes: number
  sha256: string; manifesto_sha256: string; solicitado_em: string; gravado_em: string; gravado_em_dia: string; origem_hash: string
  volume_na_captura: number; ancora: 'nao_enviada' | 'enviada' | 'confirmada'; ancora_enviada_em: string | null
  ancora_calendarios: number; chave_ots: string | null; chave_ots_confirmada: string | null; ots_altura: number | null; vedado: number; conta_id?: string | null
}

export function fatosDaProva(r: LinhaProva): FatosCaptura {
  return {
    solicitadoEm: r.solicitado_em, consentimento: true, conteudoVedado: r.vedado === 1,
    capturasUltimas24h: r.volume_na_captura, arquivoSha256: r.sha256, hashConferido: true,
    gravadoNoCofre: true, manifestoGravado: true, gravadoEm: r.gravado_em_dia, ancora: r.ancora, ancoraEnviadaEm: r.ancora_enviada_em,
  }
}

const agregadores = (env: Env) => (env.OTS_AGREGADORES ? env.OTS_AGREGADORES.split(',').map((x) => x.trim()).filter(Boolean) : AGREGADORES_PADRAO)

/** Cria o caso e dispara o Workflow (log append-only). Devolve o veredito síncrono para responder já. */
async function registrarCaso(env: Env, p: Produto, casoId: string | null, fatos: FatosCaptura) {
  const entrada = p.captura!.montarEntrada(fatos)
  const hoje = hojeBR()
  const r = await executar(p, entrada, { hoje })
  if (!r.ok) throw new Error(`entrada inválida no produto ${p.nome}: ${r.detalhes.join('; ')}`)
  const id = casoId ?? crypto.randomUUID()
  if (!casoId) {
    const agora = new Date().toISOString()
    await env.DB.prepare(`INSERT INTO casos (id, produto, versao, estado, motivo, final, prazo_ate, criado_em, atualizado_em) VALUES (?, ?, ?, ?, 'recebido', 0, NULL, ?, ?)`)
      .bind(id, p.nome, p.versao, p.estadoInicial, agora, agora).run()
  }
  await env.CASO_WF.create({ id: crypto.randomUUID(), params: { casoId: id, produto: p.nome, entrada, hoje } })
  return { casoId: id, veredito: r.veredito, final: r.transicao.final, prazoAte: r.transicao.prazoAte }
}

async function tentarAncorar(env: Env, r: LinhaProva): Promise<Partial<LinhaProva> | null> {
  try {
    const { ots, calendarios } = await ancorar(r.manifesto_sha256, { calendarios: agregadores(env), timeoutMs: 8000 })
    const chave = `provas/${r.id}/prova.pendente.ots`
    await env.PROVAS.put(chave, ots, { onlyIf: { etagDoesNotMatch: '*' } })
    return { ancora: 'enviada', ancora_enviada_em: hojeBR(), ancora_calendarios: calendarios.length, chave_ots: chave }
  } catch { return null }
}

/* ---------- público ---------- */
capturaPublica.get('/:produto/captura', (c) => {
  const p = produtoDeCaptura(c.req.param('produto'))
  if (!p) return c.json({ erro: 'produto_sem_captura' }, 404)
  const { titulo, subtitulo, aviso, tiposMime, maxBytes, marca } = p.captura!
  return c.json({ nome: p.nome, versao: p.versao, titulo, subtitulo, aviso, tiposMime, maxBytes, marca: marca ?? null, turnstileSitekey: c.env.TURNSTILE_SITEKEY ?? null, preco: p.preco ?? null })
})

// GET /pub/dominio — qual produto responde na raiz deste host? (DOMINIOS = JSON {"tinhaprint.com.br":"prova-digital"})
capturaPublica.get('/dominio', (c) => {
  let mapa: Record<string, string> = {}
  try { mapa = JSON.parse(c.env.DOMINIOS ?? '{}') } catch { /* config inválida = sem domínio mapeado */ }
  const host = (c.req.header('host') ?? '').toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
  const nome = Object.hasOwn(mapa, host) ? mapa[host] : undefined
  if (!nome || !produtoDeCaptura(nome)) return c.json({ erro: 'sem_dominio' }, 404)
  return c.json({ produto: nome })
})

// PUT /pub/:produto/captura?sha256=&origem=navegador|arquivo_enviado&consentimento=1  (corpo = bytes; nome em x-nome-arquivo)
capturaPublica.put('/:produto/captura', async (c) => {
  const p = produtoDeCaptura(c.req.param('produto'))
  if (!p) return c.json({ erro: 'produto_sem_captura' }, 404)
  const cap = p.captura!
  const q = c.req.query()
  const ip = c.req.header('cf-connecting-ip')
  if (!(await turnstileOk(c.env, c.req.header('x-turnstile'), ip))) return c.json({ erro: 'verificacao_falhou' }, 403)

  const mime = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  const tamanho = Number(c.req.header('content-length') ?? '0')
  const hashCliente = (q.sha256 ?? '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(hashCliente)) return c.json({ erro: 'sha256_invalido' }, 422)
  if (!mimeOk(cap, mime)) return c.json({ erro: 'tipo_nao_aceito', aceitos: cap.tiposMime }, 415)
  if (!Number.isInteger(tamanho) || tamanho <= 0) return c.json({ erro: 'tamanho_ausente' }, 411)
  if (tamanho > cap.maxBytes) return c.json({ erro: 'arquivo_grande_demais', maxBytes: cap.maxBytes }, 413)
  const origem = q.origem === 'navegador' ? 'navegador' : 'arquivo_enviado'

  const oh = await origemHash(c.env, ip)
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString()
  const anteriores = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM provas WHERE origem_hash = ? AND gravado_em > ?').bind(oh, desde).first<{ n: number }>())?.n ?? 0
  const hoje = hojeBR()
  const base: FatosCaptura = {
    solicitadoEm: hoje, consentimento: q.consentimento === '1', conteudoVedado: false, capturasUltimas24h: anteriores + 1,
    arquivoSha256: null, hashConferido: true, gravadoNoCofre: false, manifestoGravado: false, gravadoEm: null, ancora: 'nao_enviada', ancoraEnviadaEm: null,
  }

  // Pré-checagem pela regra do produto: se o veredito sem arquivo já é FINAL (ex.: recusada), nada é lido nem guardado.
  const pre = await executar(p, cap.montarEntrada(base), { hoje })
  if (pre.ok && pre.transicao.final) {
    const recentes = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM recusas WHERE origem_hash = ? AND em > ?').bind(oh, desde).first<{ n: number }>())?.n ?? 0
    if (recentes >= TETO_RECUSAS_24H) return c.json({ erro: 'muitas_tentativas' }, 429) // sem registrar: o log não é vetor de abuso
    const caso = await registrarCaso(c.env, p, null, base)
    await c.env.DB.prepare('INSERT INTO recusas (produto, origem_hash, estado, motivo, caso_id, em) VALUES (?, ?, ?, ?, ?, ?)').bind(p.nome, oh, caso.veredito.estado, caso.veredito.motivo, caso.casoId, new Date().toISOString()).run()
    return c.json({ recusada: true, estado: caso.veredito.estado, motivo: caso.veredito.motivo }, 403)
  }

  const contaId = await contaDaSessao(c) // enviada logado: a prova já nasce na conta
  const id = crypto.randomUUID()
  const chaveR2 = `provas/${id}/arquivo`
  let obj: R2Object | null = null
  try {
    obj = await c.env.PROVAS.put(chaveR2, c.req.raw.body, { sha256: hashCliente, httpMetadata: { contentType: mime }, onlyIf: { etagDoesNotMatch: '*' } })
  } catch {
    // O cofre recusa a gravação quando o hash declarado não bate com os bytes recebidos.
    const caso = await registrarCaso(c.env, p, null, { ...base, arquivoSha256: hashCliente, hashConferido: false })
    return c.json({ erro: 'hash_divergente', estado: caso.veredito.estado, motivo: caso.veredito.motivo }, 422)
  }
  if (!obj) return c.json({ erro: 'gravacao_falhou' }, 500)
  const sha = obj.checksums.sha256 ? hexDe(obj.checksums.sha256) : hashCliente

  const agora = new Date()
  // Nome do arquivo vem no cabeçalho (não na URL): a URL entra nos logs do Workers e o nome pode ser dado pessoal.
  let nomeCabecalho: string | undefined
  try { nomeCabecalho = c.req.header('x-nome-arquivo') ? decodeURIComponent(c.req.header('x-nome-arquivo')!) : undefined } catch { nomeCabecalho = undefined }
  const nome = nomeSeguro(nomeCabecalho ?? q.nome)
  const manifesto = jsonEstavel({
    versaoManifesto: 1, produto: p.nome, produtoVersao: p.versao, provaId: id, origem,
    arquivo: { nome, mime, bytes: obj.size, sha256: sha },
    recebidoEm: agora.toISOString(), recebidoEmDia: diaBR(agora),
  })
  const manifestoBytes = enc.encode(manifesto)
  const manifestoSha = await sha256Texto(manifesto)
  await c.env.PROVAS.put(`provas/${id}/manifesto.json`, manifestoBytes, { httpMetadata: { contentType: 'application/json' }, onlyIf: { etagDoesNotMatch: '*' } })

  const chaveUsuario = hexDe(crypto.getRandomValues(new Uint8Array(24))) // 192 bits, mostrado UMA vez
  const linha: LinhaProva = {
    id, produto: p.nome, caso_id: '', chave_hash: await sha256Texto(chaveUsuario), origem, nome_arquivo: nome, mime, bytes: obj.size, sha256: sha,
    manifesto_sha256: manifestoSha, solicitado_em: hoje, gravado_em: agora.toISOString(), gravado_em_dia: diaBR(agora), origem_hash: oh,
    volume_na_captura: anteriores + 1, ancora: 'nao_enviada', ancora_enviada_em: null, ancora_calendarios: 0, chave_ots: null, chave_ots_confirmada: null, ots_altura: null, vedado: 0, conta_id: contaId,
  }
  Object.assign(linha, await tentarAncorar(c.env, linha))

  const caso = await registrarCaso(c.env, p, null, fatosDaProva(linha))
  linha.caso_id = caso.casoId
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO provas (id, produto, caso_id, chave_hash, origem, nome_arquivo, mime, bytes, sha256, manifesto_sha256, solicitado_em, gravado_em, gravado_em_dia, origem_hash, volume_na_captura, ancora, ancora_enviada_em, ancora_calendarios, chave_ots, chave_ots_confirmada, ots_altura, vedado, conta_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      linha.id, linha.produto, linha.caso_id, linha.chave_hash, linha.origem, linha.nome_arquivo, linha.mime, linha.bytes, linha.sha256, linha.manifesto_sha256,
      linha.solicitado_em, linha.gravado_em, linha.gravado_em_dia, linha.origem_hash, linha.volume_na_captura, linha.ancora, linha.ancora_enviada_em,
      linha.ancora_calendarios, linha.chave_ots, linha.chave_ots_confirmada, linha.ots_altura, linha.vedado, linha.conta_id ?? null),
    c.env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'captura', ?, ?)").bind(id, oh, linha.gravado_em),
  ])
  return c.json({
    id, codigoDeRecuperacao: chaveUsuario, sha256: sha, manifestoSha256: manifestoSha, bytes: obj.size, recebidoEm: linha.gravado_em,
    ancora: linha.ancora, estado: caso.veredito.estado, motivo: caso.veredito.motivo, naConta: Boolean(contaId),
  }, 201)
})

export async function carregar(env: Env, produto: string, id: string, chave: unknown): Promise<LinhaProva | null> {
  if (typeof chave !== 'string' || chave.length < 16 || chave.length > 128) return null
  const r = await env.DB.prepare('SELECT * FROM provas WHERE id = ? AND produto = ?').bind(id, produto).first<LinhaProva>()
  if (!r) return null
  return iguaisConstante(r.chave_hash, await sha256Texto(chave)) ? r : null
}

/** Acesso pela chave (código de recuperação) OU pela sessão da conta dona da prova. */
async function carregarComAcesso(c: Context<{ Bindings: Env }>, chave: unknown): Promise<LinhaProva | null> {
  const produto = c.req.param('produto')!, id = c.req.param('id')!
  if (chave) return carregar(c.env, produto, id, chave)
  const contaId = await contaDaSessao(c)
  if (!contaId) return null
  return c.env.DB.prepare('SELECT * FROM provas WHERE id = ? AND produto = ? AND conta_id = ?').bind(id, produto, contaId).first<LinhaProva>()
}

capturaPublica.post('/:produto/provas/:id/estado', async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { chave?: string } | null
  const r = await carregarComAcesso(c, corpo?.chave)
  if (!r) return c.json({ erro: 'nao_encontrada' }, 404) // mesma resposta para id inexistente e chave errada
  const caso = await c.env.DB.prepare('SELECT estado, motivo, final, prazo_ate FROM casos WHERE id = ?').bind(r.caso_id).first()
  return c.json({ id: r.id, nome: r.nome_arquivo, bytes: r.bytes, sha256: r.sha256, manifestoSha256: r.manifesto_sha256, recebidoEm: r.gravado_em, ancora: r.ancora, otsAltura: r.ots_altura, vedado: r.vedado === 1, caso })
})

const LEIA_ME = (r: LinhaProva) => `PACOTE DE PROVA DIGITAL ${r.id}

Arquivos:
  arquivo (${r.nome_arquivo})  o arquivo preservado, byte a byte
  manifesto.json               registro do recebimento: hash do arquivo, tamanho, tipo, data/hora do servidor
  prova.ots                    carimbo OpenTimestamps do manifesto (ancorado no Bitcoin; pendente nas primeiras horas)

Como verificar SEM depender do nosso servidor:
  1) sha256sum <arquivo>  -> deve ser igual a arquivo.sha256 dentro de manifesto.json (${r.sha256})
  2) sha256sum manifesto.json -> deve ser ${r.manifesto_sha256}
  3) ots verify prova.ots   (cliente oficial: https://github.com/opentimestamps/opentimestamps-client)
     Se ainda estiver pendente: ots upgrade prova.ots   (depois de algumas horas)
  4) Ou rode o verificador deste projeto: node scripts/verificar-pacote.mjs <pasta-ou-zip>

O que este pacote prova: que ESTE arquivo existia nesta data e não foi alterado desde então.
O que NÃO prova: que o conteúdo é verdadeiro, nem que será aceito como prova. Isso é decisão do juiz.
`

capturaPublica.post('/:produto/provas/:id/pacote', async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { chave?: string } | null
  const r = await carregarComAcesso(c, corpo?.chave)
  if (!r) return c.json({ erro: 'nao_encontrada' }, 404)
  if (r.vedado) return c.json({ erro: 'indisponivel' }, 451)
  const [arq, man] = await Promise.all([c.env.PROVAS.get(`provas/${r.id}/arquivo`), c.env.PROVAS.get(`provas/${r.id}/manifesto.json`)])
  const chaveOts = r.chave_ots_confirmada ?? r.chave_ots
  const ots = chaveOts ? await c.env.PROVAS.get(chaveOts) : null
  if (!arq || !man) return c.json({ erro: 'objeto_ausente' }, 500)
  await c.env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'pacote', ?, ?)").bind(r.id, await origemHash(c.env, c.req.header('cf-connecting-ip')), new Date().toISOString()).run()
  const entradas = [
    { nome: nomeSeguro(r.nome_arquivo), dados: arq.body },
    { nome: 'manifesto.json', dados: new Uint8Array(await man.arrayBuffer()) },
    ...(ots ? [{ nome: 'prova.ots', dados: new Uint8Array(await ots.arrayBuffer()) }] : []),
    { nome: 'LEIA-ME.txt', dados: enc.encode(LEIA_ME(r)) },
  ]
  return new Response(zipStore(entradas, new Date(r.gravado_em)), {
    headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="prova-${r.id}.zip"`, 'cache-control': 'no-store' },
  })
})

/* ---------- interno (/api, Bearer) ---------- */
export const capturaInterna = new Hono<{ Bindings: Env }>()

capturaInterna.get('/provas', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.produto, p.nome_arquivo, p.bytes, p.sha256, p.gravado_em, p.ancora, p.ots_altura, p.vedado, p.origem, c.estado, c.motivo,
            (SELECT COUNT(*) FROM acessos a WHERE a.prova_id = p.id AND a.tipo = 'pacote') AS downloads
     FROM provas p LEFT JOIN casos c ON c.id = p.caso_id ORDER BY p.gravado_em DESC LIMIT 200`,
  ).all()
  return c.json({ provas: results })
})

capturaInterna.post('/provas/:id/vedar', async (c) => {
  const r = await c.env.DB.prepare('UPDATE provas SET vedado = 1 WHERE id = ?').bind(c.req.param('id')).run()
  if (!r.meta.changes) return c.json({ erro: 'prova_inexistente' }, 404)
  await c.env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'vedado', 'equipe', ?)").bind(c.req.param('id'), new Date().toISOString()).run()
  return c.json({ ok: true })
})

// Equipe lê o arquivo só com registro no log, e nunca de prova vedada.
capturaInterna.get('/provas/:id/arquivo', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM provas WHERE id = ?').bind(c.req.param('id')).first<LinhaProva>()
  if (!r) return c.json({ erro: 'prova_inexistente' }, 404)
  if (r.vedado) return c.json({ erro: 'indisponivel' }, 451)
  await c.env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'arquivo_equipe', 'equipe', ?)").bind(r.id, new Date().toISOString()).run()
  const o = await c.env.PROVAS.get(`provas/${r.id}/arquivo`)
  if (!o) return c.json({ erro: 'objeto_ausente' }, 500)
  return new Response(o.body, { headers: { 'content-type': r.mime, 'content-disposition': `attachment; filename="${nomeSeguro(r.nome_arquivo)}"`, 'cache-control': 'no-store' } })
})

capturaInterna.get('/provas/:id/acessos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT tipo, em FROM acessos WHERE prova_id = ? ORDER BY id').bind(c.req.param('id')).all()
  return c.json({ acessos: results })
})

/* ---------- agendado: tenta ancorar, promove a Bitcoin e reavalia casos abertos ---------- */
export async function manutencaoCaptura(env: Env): Promise<{ ancoradas: number; confirmadas: number; reavaliadas: number }> {
  let ancoradas = 0, confirmadas = 0, reavaliadas = 0
  const { results: abertas } = await env.DB.prepare(
    `SELECT p.* FROM provas p JOIN casos c ON c.id = p.caso_id
     WHERE c.final = 0 OR (p.ancora <> 'confirmada' AND p.gravado_em > ?) ORDER BY p.gravado_em DESC LIMIT 50`,
  ).bind(new Date(Date.now() - 30 * 24 * 3600_000).toISOString()).all<LinhaProva>()

  for (const r of abertas) {
    const p = produtoDeCaptura(r.produto)
    if (!p) continue
    let mudou = false
    if (r.ancora === 'nao_enviada') {
      const novo = await tentarAncorar(env, r)
      if (novo) {
        Object.assign(r, novo)
        await env.DB.batch([
          env.DB.prepare('UPDATE provas SET ancora = ?, ancora_enviada_em = ?, ancora_calendarios = ?, chave_ots = ? WHERE id = ?').bind(r.ancora, r.ancora_enviada_em, r.ancora_calendarios, r.chave_ots, r.id),
          env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'ancora', 'cron', ?)").bind(r.id, new Date().toISOString()),
        ])
        ancoradas++; mudou = true
      }
    } else if (r.ancora === 'enviada' && r.chave_ots) {
      const atual = await env.PROVAS.get(r.chave_ots)
      if (atual) {
        const bytes = new Uint8Array(await atual.arrayBuffer())
        const up = await atualizar(bytes, { timeoutMs: 8000 })
        if (up.mudou && alturasBitcoin(up.ots).length > 0) {
          const chave = `provas/${r.id}/prova.confirmada.ots`
          await env.PROVAS.put(chave, up.ots, { onlyIf: { etagDoesNotMatch: '*' } }) // novo objeto: a prova pendente original continua intacta
          r.ancora = 'confirmada'; r.chave_ots_confirmada = chave; r.ots_altura = Math.min(...up.alturas)
          await env.DB.batch([
            env.DB.prepare("UPDATE provas SET ancora = 'confirmada', chave_ots_confirmada = ?, ots_altura = ? WHERE id = ?").bind(chave, r.ots_altura, r.id),
            env.DB.prepare("INSERT INTO acessos (prova_id, tipo, origem_hash, em) VALUES (?, 'confirmacao', 'cron', ?)").bind(r.id, new Date().toISOString()),
          ])
          confirmadas++; mudou = true
        }
      }
    }
    // Reavalia só quando um fato mudou ou o prazo do estado chegou: evita um Workflow por prova a cada hora (custo de steps).
    const caso = await env.DB.prepare('SELECT final, prazo_ate FROM casos WHERE id = ?').bind(r.caso_id).first<{ final: number; prazo_ate: string | null }>()
    if (caso && !caso.final && (mudou || !caso.prazo_ate || caso.prazo_ate <= hojeBR())) {
      await registrarCaso(env, p, r.caso_id, fatosDaProva(r)).catch(() => undefined)
      reavaliadas++
    } else if (mudou) {
      // caso já final: o estado não muda (finais são imutáveis), mas o fato novo fica nas tabelas provas/acessos
    }
  }
  return { ancoradas, confirmadas, reavaliadas }
}
