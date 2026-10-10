// Utilitários compartilhados pelo frontend genérico (app.js) e pela vitrine de marca (vitrine.js).

export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue
    el.append(f instanceof Node ? f : document.createTextNode(String(f)))
  }
  return el
}

export const get = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j } }
export const post = (url, corpo, headers = {}) => get(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(corpo) })

/**
 * Origem da visita para o funil: utm_source do link ou o site de onde a pessoa veio (só o nome do site).
 * Fica só nesta aba (sessionStorage), sem cookie e sem identificar ninguém. O servidor normaliza e agrega por dia.
 */
export function origemDaVisita() {
  try { const salva = sessionStorage.getItem('funil:origem'); if (salva) return salva } catch { /* sem storage */ }
  let o = 'direto'
  try {
    const utm = new URLSearchParams(location.search).get('utm_source')
    if (utm) o = utm.slice(0, 40)
    else if (document.referrer) { const host = new URL(document.referrer).hostname; if (host && host !== location.hostname) o = host }
  } catch { /* referrer inválido: direto */ }
  try { sessionStorage.setItem('funil:origem', o) } catch { /* sem storage */ }
  return o
}
export const cabecalhoOrigem = () => ({ 'x-funil-origem': encodeURIComponent(origemDaVisita()) })

export const hexDe = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('')
export const sha256Hex = async (blob) => hexDe(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))

export const ROTULO_RECUSA = {
  sem_consentimento: 'Sem o consentimento nada é guardado.',
  conteudo_vedado: 'Este tipo de conteúdo não pode ser preservado aqui.',
  abuso_por_volume: 'Muitas capturas em 24 horas. Tente novamente amanhã.',
}
export const ROTULO_ESTADO = {
  aguardando_captura: 'Aguardando',
  guardada: 'Guardada no cofre',
  ancorando: 'Carimbo enviado, aguardando o Bitcoin',
  preservada: 'Preservada e ancorada no Bitcoin',
  preservada_sem_ancora: 'Preservada (carimbo não confirmado no prazo)',
  falhou: 'Falhou',
  recusada: 'Recusada',
}

/** Baixa o pacote .zip. Com `chave` usa o código de recuperação; sem ela, vale a sessão da conta dona da prova. */
export async function baixarPacote(nome, id, chave, msg) {
  msg.className = ''; msg.textContent = 'Preparando o pacote…'
  const r = await fetch(`/pub/${encodeURIComponent(nome)}/provas/${encodeURIComponent(id)}/pacote`, { method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhoOrigem() }, body: JSON.stringify(chave ? { chave } : {}) })
  if (!r.ok) { msg.className = 'erro'; msg.textContent = r.status === 404 ? 'Código ou identificador não confere.' : r.status === 451 ? 'Esta prova não está disponível.' : 'Não foi possível baixar agora.'; return }
  const url = URL.createObjectURL(await r.blob())
  const a = h('a', { href: url, download: `prova-${id}.zip` }); document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15000); msg.textContent = 'Pacote baixado.'
}

/**
 * Abre o relatório da prova numa aba nova. É um formulário POST (não fetch + blob) porque assim funciona igual no
 * celular: o código de recuperação vai no corpo, nunca na URL. Sem `chave`, vale a sessão da conta dona da prova.
 */
export function abrirRelatorio(nome, id, chave) {
  const f = h('form', { method: 'post', action: `/pub/${encodeURIComponent(nome)}/provas/${encodeURIComponent(id)}/relatorio`, target: '_blank', rel: 'noopener' },
    chave ? h('input', { type: 'hidden', name: 'chave', value: chave }) : null)
  f.style.display = 'none'
  document.body.append(f); f.submit(); f.remove()
}

/** Envia com progresso (XHR, porque fetch não informa progresso de upload). */
export function enviarComProgresso(url, blob, headers, aoProgredir) {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v)
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgredir(e.loaded / e.total) }
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText) } catch { /* corpo vazio */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, j }) }
    x.onerror = () => resolve({ ok: false, status: 0, j: {} })
    x.send(blob)
  })
}
