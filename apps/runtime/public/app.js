// Frontend genérico: não conhece nenhum produto. Renderiza o que a `tela` declarada manda.
import { h, get, post, sha256Hex, ROTULO_RECUSA, ROTULO_ESTADO, baixarPacote, abrirRelatorio, origemDaVisita } from './base.js'

// Fixa a origem da visita já na primeira página (antes de qualquer navegação interna mudar a URL).
origemDaVisita()

const app = document.getElementById('app')
const TOPO_ORIGINAL = document.querySelector('.topo').innerHTML
const RODAPE_ORIGINAL = document.querySelector('.rodape').innerHTML
const vitrine = () => import('./vitrine.js')

const limpar = () => { app.replaceChildren() }

/* ---------- roteador ---------- */
function ir(caminho) { history.pushState({}, '', caminho); scrollTo(0, 0); rotear() }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]')
  if (a && a.origin === location.origin) { e.preventDefault(); ir(a.pathname + a.search) }
})
addEventListener('popstate', rotear)

async function produtoDoDominio() {
  const d = await get('/pub/dominio')
  return d.ok && d.j.produto ? d.j.produto : null
}

async function rotear() {
  limpar()
  app.classList.remove('studio')
  document.body.classList.remove('vitrine', 'com-fixa')
  document.querySelector('.topo').innerHTML = TOPO_ORIGINAL
  document.querySelector('.rodape').innerHTML = RODAPE_ORIGINAL
  const partes = location.pathname.split('/').filter(Boolean)
  if (partes.length === 0) {
    const p = await produtoDoDominio()
    return p ? paginaProduto(p, { raiz: true }) : paginaInicial()
  }
  if (partes[0] === 'studio') return studio()
  if (partes[0] === 'entrar' || partes[0] === 'minhas-provas') {
    const p = new URLSearchParams(location.search).get('p') || (await produtoDoDominio())
    const v = await vitrine()
    return partes[0] === 'entrar' ? v.paginaEntrar(p) : v.paginaMinhasProvas(p)
  }
  return paginaProduto(partes[0])
}

/* ---------- público: lista de produtos ---------- */
async function paginaInicial() {
  document.title = 'Máquina de Produtos'
  const { j } = await get('/pub/produtos')
  const itens = Array.isArray(j) ? j : []
  app.append(
    h('h1', {}, 'Ferramentas de triagem'),
    h('p', { class: 'sub' }, 'Cada uma resolve uma dor específica. Escolha a sua.'),
    itens.length
      ? h('ul', { class: 'lista' }, itens.map((p) => h('li', {}, h('a', { href: '/' + p.nome, 'data-link': true }, h('strong', {}, p.titulo), p.subtitulo))))
      : h('p', { class: 'vazio' }, 'Nenhuma ferramenta pública no ar ainda.'),
  )
}

/* ---------- público: página de produto gerada da tela ---------- */
async function paginaProduto(nome, { raiz = false } = {}) {
  const cap = await get(`/pub/${encodeURIComponent(nome)}/captura`)
  if (cap.ok && cap.j.marca) return (await vitrine()).paginaVitrine(nome, cap.j, { raiz })
  if (cap.ok) return paginaCaptura(nome, cap.j)
  const { ok, j } = await get(`/pub/${encodeURIComponent(nome)}/tela`)
  if (!ok) return app.append(h('h1', {}, 'Não encontramos esta página'), h('p', {}, h('a', { href: '/', 'data-link': true }, 'Voltar ao início')))
  const t = j.tela
  document.title = t.titulo
  let tokenTurnstile = null
  const status = h('p', { class: 'erro', role: 'alert' })
  const saida = h('div')
  const botao = h('button', { type: 'submit' }, 'Verificar')

  const campos = t.campos.map((c) => {
    const id = 'c_' + c.nome
    if (c.tipo === 'sim_nao') {
      return h('fieldset', { class: 'grupo' },
        h('legend', { class: 'rotulo' }, c.rotulo, c.ajuda ? h('span', { class: 'ajuda' }, c.ajuda) : null),
        h('div', { class: 'sim-nao' },
          h('label', {}, h('input', { type: 'radio', name: c.nome, value: 'nao', checked: true }), h('span', {}, 'Não')),
          h('label', {}, h('input', { type: 'radio', name: c.nome, value: 'sim' }), h('span', {}, 'Sim'))))
    }
    return h('div', {},
      h('label', { for: id }, c.rotulo, c.opcional ? ' (opcional)' : '', c.ajuda ? h('span', { class: 'ajuda' }, c.ajuda) : null),
      h('input', { id, name: c.nome, type: c.tipo === 'data' ? 'date' : 'number', required: !c.opcional }))
  })

  const form = h('form', { novalidate: false, onsubmit: async (e) => {
    e.preventDefault(); status.textContent = ''; saida.replaceChildren(); botao.disabled = true
    const valores = {}
    for (const c of t.campos) {
      const el = form.elements[c.nome]
      valores[c.nome] = c.tipo === 'sim_nao' ? el.value : el.value
    }
    const r = await post(`/pub/${nome}/avaliar`, { valores, turnstile: tokenTurnstile })
    botao.disabled = false
    if (!r.ok) { status.textContent = r.status === 422 ? 'Confira os campos: ' + (r.j.detalhes || []).join('; ') : 'Não foi possível verificar agora. Tente de novo.'; return }
    saida.replaceChildren(resultado(nome, r.j, () => tokenTurnstile))
    saida.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } }, campos, botao, status)

  app.append(h('h1', {}, t.titulo), h('p', { class: 'sub' }, t.subtitulo), h('p', { class: 'aviso' }, t.aviso), form, saida)

  if (j.turnstileSitekey) {
    const alvo = h('div'); form.insertBefore(alvo, botao)
    const s = h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true })
    s.onload = () => window.turnstile.render(alvo, { sitekey: j.turnstileSitekey, callback: (tk) => { tokenTurnstile = tk } })
    document.head.append(s)
  }
}

function resultado(nome, r, pegarToken) {
  const cartao = h('section', { class: 'cartao resultado ' + r.texto.tom },
    h('h2', {}, r.texto.titulo), h('p', {}, r.texto.explicacao),
    r.texto.proximoPasso ? h('p', {}, h('strong', {}, 'Próximo passo: '), r.texto.proximoPasso) : null)
  if (r.oferecerAjuda) cartao.append(h('hr', { class: 'sep' }), pedidoAjuda(nome, r, pegarToken))
  return cartao
}

function pedidoAjuda(nome, r, pegarToken) {
  const msg = h('p', { role: 'status' })
  const contato = h('input', { type: 'text', id: 'contato', autocomplete: 'email', placeholder: 'seu e-mail ou WhatsApp', maxlength: 200 })
  const aceite = h('input', { type: 'checkbox', id: 'aceite' })
  const enviar = h('button', { type: 'submit' }, 'Quero ajuda')
  const f = h('form', { onsubmit: async (e) => {
    e.preventDefault(); msg.className = ''; msg.textContent = ''
    if (!aceite.checked) { msg.className = 'erro'; msg.textContent = 'Marque o consentimento para continuar.'; return }
    enviar.disabled = true
    const x = await post(`/pub/${nome}/interesse`, { contato: contato.value, consentimento: true, motivo: r.motivo, turnstile: pegarToken() })
    enviar.disabled = false
    if (x.ok) { f.replaceChildren(h('p', {}, 'Recebido. Vamos falar com você sobre este caso, e só sobre ele.')); return }
    msg.className = 'erro'; msg.textContent = x.j.erro === 'contato_invalido' ? 'Informe um e-mail ou telefone válido.' : 'Não foi possível enviar agora.'
  } },
    h('p', {}, r.textoAjuda),
    h('label', { for: 'contato' }, 'Como falamos com você?'), contato,
    h('label', { class: 'consent', for: 'aceite' }, aceite, 'Autorizo o uso deste contato apenas para falar sobre este caso. Posso pedir a exclusão a qualquer momento.'),
    enviar, msg)
  return f
}

/* ---------- Studio (interno; Cloudflare Access entra como 2ª camada) ---------- */
const tokenGuardado = () => { try { return sessionStorage.getItem('studio_token') || '' } catch { return '' } }
const guardarToken = (t) => { try { sessionStorage.setItem('studio_token', t) } catch { /* sem armazenamento */ } }
const api = (caminho) => get('/api' + caminho, { headers: { authorization: 'Bearer ' + tokenGuardado() } })

function studio() {
  document.title = 'Studio'
  app.classList.add('studio')
  if (!tokenGuardado()) return entrarNoStudio()
  const corpo = h('div'); let aba = 'esteira'
  const nomes = { esteira: 'Esteira', provas: 'Provas', metricas: 'Métricas', pedidos: 'Pedidos', sinais: 'Sinais do funil', produtos: 'Produtos', vencidos: 'Casos vencidos', interessados: 'Interessados' }
  const abas = h('div', { class: 'abas', role: 'group', 'aria-label': 'Seções' })
  const desenhar = async () => {
    abas.replaceChildren(...Object.entries(nomes).map(([k, v]) => h('button', { class: 'sec', 'aria-pressed': String(k === aba), onclick: () => { aba = k; desenhar() } }, v)),
      h('button', { class: 'sec', onclick: () => { guardarToken(''); studio() } }, 'Sair'))
    corpo.replaceChildren(h('p', { class: 'vazio' }, 'Carregando…'))
    corpo.replaceChildren(await secao(aba))
  }
  app.replaceChildren(h('h1', {}, 'Studio'), abas, corpo)
  desenhar()
}

function entrarNoStudio() {
  const campo = h('input', { type: 'password', id: 'tk', autocomplete: 'current-password' })
  const msg = h('p', { class: 'erro', role: 'alert' })
  app.replaceChildren(h('h1', {}, 'Studio'), h('form', { onsubmit: async (e) => {
    e.preventDefault(); guardarToken(campo.value)
    const r = await api('/p'); if (r.ok) return studio()
    guardarToken(''); msg.textContent = 'Token inválido.'
  } }, h('label', { for: 'tk' }, 'Token de acesso'), campo, h('button', { type: 'submit' }, 'Entrar'), msg))
}

function tabela(colunas, linhas, numericas = []) {
  if (!linhas.length) return h('p', { class: 'vazio' }, 'Nada aqui ainda.')
  return h('div', { class: 'rolagem' }, h('table', { class: 'tabela' },
    h('thead', {}, h('tr', {}, colunas.map(([, r]) => h('th', { class: numericas.includes(r) ? 'num' : '' }, r)))),
    h('tbody', {}, linhas.map((l) => h('tr', {}, colunas.map(([k]) => h('td', { class: numericas.includes(k) ? 'num' : '' }, l[k] ?? '-')))))))
}

async function secao(aba) {
  if (aba === 'esteira') return esteiraView()
  if (aba === 'provas') return provasView()
  if (aba === 'metricas') return metricasView()
  if (aba === 'pedidos') return pedidosView()
  if (aba === 'sinais') {
    const [s, p] = await Promise.all([api('/sinais'), api('/p')])
    if (!s.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
    const por = {}; for (const x of s.j.sinais) { (por[x.produto] ??= { avaliou: 0, quero_ajuda: 0 })[x.tipo] += x.total }
    const resumo = Object.entries(por).map(([produto, v]) => ({ produto, avaliacoes: v.avaliou, pedidos_de_ajuda: v.quero_ajuda,
      conversao: v.avaliou ? ((v.quero_ajuda / v.avaliou) * 100).toFixed(1) + '%' : '-',
      criterio: (p.j || []).find((q) => q.nome === produto)?.criterioDeMorte ? `${p.j.find((q) => q.nome === produto).criterioDeMorte.minimo} em ${p.j.find((q) => q.nome === produto).criterioDeMorte.prazoDias} dias` : '-' }))
    return h('div', {}, h('h2', {}, 'Por produto'), tabela([['produto', 'produto'], ['avaliacoes', 'avaliações'], ['pedidos_de_ajuda', 'pedidos de ajuda'], ['conversao', 'conversão'], ['criterio', 'critério de morte']], resumo, ['avaliacoes', 'pedidos_de_ajuda']),
      h('h2', {}, 'Por motivo'), tabela([['produto', 'produto'], ['tipo', 'tipo'], ['motivo', 'motivo'], ['total', 'total'], ['ultimo', 'último']], s.j.sinais, ['total']))
  }
  if (aba === 'produtos') {
    const p = await api('/p'); if (!p.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
    return h('div', {}, p.j.map((x) => h('section', { class: 'cartao' },
      h('h2', { class: 'sem-topo' }, `${x.nome} · ${x.versao}`, x.publico ? ' · público' : ' · interno'),
      h('p', {}, h('strong', {}, 'Critério de morte: '), `${x.criterioDeMorte.minimo} × ${x.criterioDeMorte.metrica} em ${x.criterioDeMorte.prazoDias} dias`),
      h('p', {}, h('strong', {}, 'Preço: '), descreverPreco(x.preco)),
      h('p', {}, h('strong', {}, 'Estados: '), Object.entries(x.estados).map(([e, d]) => d.final ? `${e} (final)` : `${e} (prazo ${d.prazoDias}d)`).join(' · ')),
      h('p', {}, h('strong', {}, 'Não faremos: '), x.naoFaremos.join(' '))))) 
  }
  if (aba === 'vencidos') {
    const v = await api('/vencidos'); if (!v.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
    return tabela([['produto', 'produto'], ['estado', 'estado'], ['prazo_ate', 'prazo'], ['id', 'caso']], v.j.vencidos)
  }
  const i = await api('/interesses'); if (!i.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
  return tabela([['em', 'quando'], ['produto', 'produto'], ['motivo', 'motivo'], ['contato', 'contato']], i.j.interesses)
}

/* ---------- público: captura de evidência (print, gravação, arquivo) ---------- */
function paginaCaptura(nome, cfg) {
  document.title = cfg.titulo
  let tokenTurnstile = null
  const maxMB = Math.round(cfg.maxBytes / 1048576)
  const aceite = h('input', { type: 'checkbox', id: 'aceite-captura' })
  const msg = h('p', { class: 'erro', role: 'alert' })
  const saida = h('div')
  const botoes = h('div', { class: 'acoes' })
  const consentido = () => { if (!aceite.checked) { msg.className = 'erro'; msg.textContent = 'Marque o consentimento para continuar.'; return false } msg.textContent = ''; return true }

  async function preservar(blob, nomeArquivo, origem) {
    botoes.querySelectorAll('button').forEach((b) => { b.disabled = true })
    msg.className = ''; msg.textContent = 'Calculando a impressão digital (SHA-256) no seu navegador…'
    try {
      const sha = await sha256Hex(blob)
      msg.textContent = 'Enviando para o cofre…'
      const q = new URLSearchParams({ sha256: sha, origem, consentimento: '1' })
      const r = await get(`/pub/${encodeURIComponent(nome)}/captura?${q}`, { method: 'PUT', headers: { 'content-type': blob.type || 'application/octet-stream', 'x-nome-arquivo': encodeURIComponent(nomeArquivo), ...(tokenTurnstile ? { 'x-turnstile': tokenTurnstile } : {}) }, body: blob })
      if (!r.ok) {
        msg.className = 'erro'
        msg.textContent = r.j.recusada ? (ROTULO_RECUSA[r.j.motivo] || 'Recusada.') : r.status === 413 ? `Arquivo maior que ${maxMB} MB.` : r.status === 415 ? 'Tipo de arquivo não aceito.' : r.status === 429 ? 'Muitas tentativas. Tente mais tarde.' : r.j.erro === 'hash_divergente' ? 'O arquivo mudou durante o envio. Nada foi guardado. Tente de novo.' : 'Não foi possível preservar agora.'
        return
      }
      msg.textContent = ''
      saida.replaceChildren(cartaoResultado(r.j))
      saida.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch { msg.className = 'erro'; msg.textContent = 'Falha de conexão. Nada foi guardado.' }
    finally { botoes.querySelectorAll('button').forEach((b) => { b.disabled = false }) }
  }

  function cartaoResultado(r) {
    const m = h('p', { role: 'status' })
    return h('section', { class: 'cartao resultado ok' },
      h('h2', {}, 'Prova guardada'),
      h('p', {}, ROTULO_ESTADO[r.estado] || r.estado),
      h('p', {}, h('strong', {}, 'Guarde este código agora. Ele não será mostrado de novo e não podemos recuperá-lo:')),
      h('p', { class: 'codigo' }, r.codigoDeRecuperacao),
      h('p', {}, h('strong', {}, 'Identificador: '), h('span', { class: 'mono' }, r.id)),
      h('p', {}, h('strong', {}, 'SHA-256: '), h('span', { class: 'mono' }, r.sha256)),
      h('p', {}, h('strong', {}, 'Recebido em (relógio do servidor): '), r.recebidoEm),
      h('div', { class: 'acoes' },
        h('button', { onclick: () => baixarPacote(nome, r.id, r.codigoDeRecuperacao, m) }, 'Baixar pacote (.zip)'),
        h('button', { class: 'sec', onclick: () => abrirRelatorio(nome, r.id, r.codigoDeRecuperacao) }, 'Ver relatório'),
        h('button', { class: 'sec', onclick: () => { const u = URL.createObjectURL(new Blob([`Identificador: ${r.id}\nCódigo de recuperação: ${r.codigoDeRecuperacao}\nSHA-256: ${r.sha256}\n`], { type: 'text/plain' })); const a = h('a', { href: u, download: `codigo-${r.id}.txt` }); document.body.append(a); a.click(); a.remove() } }, 'Salvar código (.txt)')),
      m, h('p', { class: 'ajuda' }, 'O pacote traz o arquivo, o manifesto, a prova OpenTimestamps e o relatório, verificáveis sem depender do nosso servidor.'))
  }

  if (navigator.mediaDevices?.getDisplayMedia) {
    botoes.append(h('button', { onclick: async () => {
      if (!consentido()) return
      let stream
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }) } catch { msg.className = 'erro'; msg.textContent = 'Captura de tela cancelada ou não permitida.'; return }
      const v = h('video', { muted: true, playsinline: true }); v.srcObject = stream
      await v.play(); await new Promise((r) => setTimeout(r, 350))
      const c = h('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0)
      stream.getTracks().forEach((t) => t.stop())
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
      if (blob) preservar(blob, `print-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, 'navegador')
    } }, 'Tirar print da tela'))

    botoes.append(h('button', { onclick: async (e) => {
      if (!consentido()) return
      let stream
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) } catch { msg.className = 'erro'; msg.textContent = 'Gravação cancelada ou não permitida.'; return }
      const tipo = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: tipo }); const partes = []; let total = 0
      const parar = h('button', { class: 'sec' }, 'Parar e preservar')
      const finalizar = () => { if (rec.state !== 'inactive') rec.stop() }
      rec.ondataavailable = (ev) => { if (ev.data.size) { partes.push(ev.data); total += ev.data.size; if (total > cfg.maxBytes * 0.95) { msg.textContent = `Limite de ${maxMB} MB atingido; encerrando.`; finalizar() } } }
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); parar.remove(); e.target.disabled = false; preservar(new Blob(partes, { type: 'video/webm' }), `gravacao-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, 'navegador') }
      stream.getVideoTracks()[0].addEventListener('ended', finalizar)
      parar.onclick = finalizar; botoes.append(parar); e.target.disabled = true
      msg.className = ''; msg.textContent = 'Gravando… use "Parar e preservar" ou encerre o compartilhamento.'
      rec.start(1000)
    } }, 'Gravar a tela'))
  }

  const arquivo = h('input', { type: 'file', id: 'arq', accept: cfg.tiposMime.map((t) => (t.endsWith('/') ? t + '*' : t)).join(',') })
  arquivo.addEventListener('change', () => {
    const f = arquivo.files[0]; if (!f) return
    if (!consentido()) { arquivo.value = ''; return }
    if (f.size > cfg.maxBytes) { msg.className = 'erro'; msg.textContent = `Arquivo maior que ${maxMB} MB.`; arquivo.value = ''; return }
    preservar(f, f.name, 'arquivo_enviado'); arquivo.value = ''
  })

  const recuperar = recuperarForm(nome)
  const consentimento = h('label', { class: 'consent', for: 'aceite-captura' }, aceite, 'Autorizo guardar este arquivo em cofre privado e enviar apenas o seu hash (uma impressão digital, nunca o conteúdo) a calendários públicos OpenTimestamps. Não guardamos o seu IP.')
  const ferramenta = [consentimento, botoes, h('label', { for: 'arq' }, `Ou envie um arquivo (até ${maxMB} MB)`), arquivo, msg, saida]
  app.append(h('h1', {}, cfg.titulo), h('p', { class: 'sub' }, cfg.subtitulo), h('p', { class: 'aviso' }, cfg.aviso), ...ferramenta, h('hr', { class: 'sep' }), recuperar)

  if (cfg.turnstileSitekey) {
    const alvo = h('div'); app.insertBefore(alvo, botoes)
    const sc = h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true })
    sc.onload = () => window.turnstile.render(alvo, { sitekey: cfg.turnstileSitekey, callback: (tk) => { tokenTurnstile = tk } })
    document.head.append(sc)
  }
}

function recuperarForm(nome) {
  const id = h('input', { type: 'text', id: 'rid', autocomplete: 'off', maxlength: 64 })
  const ch = h('input', { type: 'password', id: 'rch', autocomplete: 'off', maxlength: 128 })
  const msg = h('p', { role: 'status' }); const saida = h('div')
  const f = h('form', { onsubmit: async (e) => {
    e.preventDefault(); saida.replaceChildren(); msg.className = ''; msg.textContent = ''
    const r = await post(`/pub/${encodeURIComponent(nome)}/provas/${encodeURIComponent(id.value.trim())}/estado`, { chave: ch.value.trim() })
    if (!r.ok) { msg.className = 'erro'; msg.textContent = 'Identificador ou código não confere.'; return }
    const x = r.j
    saida.replaceChildren(h('section', { class: 'cartao' },
      h('p', {}, h('strong', {}, ROTULO_ESTADO[x.caso?.estado] || x.caso?.estado || 'Em andamento')),
      h('p', {}, `${x.nome} · ${x.bytes} bytes · carimbo: ${x.ancora}${x.otsAltura ? ' (bloco ' + x.otsAltura + ')' : ''}`),
      h('p', {}, h('span', { class: 'mono' }, x.sha256)),
      h('button', { type: 'button', onclick: () => baixarPacote(nome, x.id, ch.value.trim(), msg) }, 'Baixar pacote (.zip)'),
      h('button', { type: 'button', class: 'sec', onclick: () => abrirRelatorio(nome, x.id, ch.value.trim()) }, 'Ver relatório')))
  } }, h('h2', { class: 'sem-topo' }, 'Já guardei uma prova'), h('label', { for: 'rid' }, 'Identificador'), id, h('label', { for: 'rch' }, 'Código de recuperação'), ch, h('button', { type: 'submit', class: 'sec' }, 'Ver estado'), msg, saida)
  return f
}

/* ---------- Studio: preço, esteira, pedidos, métricas ---------- */
const reais = (c) => (c == null ? '-' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const mudar = (rota, metodo, corpo) => get('/api' + rota, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tokenGuardado() }, body: corpo ? JSON.stringify(corpo) : undefined })

function descreverPreco(p) {
  if (!p) return 'não declarado (a plataforma não abre pedido)'
  const base = { interno: 'uso interno', gratis: 'grátis', por_caso: `${reais(p.centavos)} por caso`, assinatura: `${reais(p.centavos)} por mês`, fracao: `${p.fracaoPct}% do valor recuperado` }[p.modelo]
  return `${base}. Grátis: ${p.gratis}${p.pago ? ' · Pago: ' + p.pago : ''} · custo estimado ${reais(p.custoPorCasoCentavos)}/caso`
}

const COLUNAS = [['rascunho', 'Rascunho'], ['em_teste', 'Em teste (14 dias)'], ['reaberta', 'Reaberta'], ['viva', 'Viva'], ['morta', 'Morta']]
const ROTULO_MOTIVO = { sem_pagador: 'ninguém pagaria', dor_sem_evidencia: 'dor sem evidência', planilha_negativa: 'planilha negativa', sacada_copiavel: 'copiável em 1 semana', prazo_sem_sinal: 'prazo sem sinal', criterio_atingido: 'critério atingido', em_andamento: 'em andamento', nova_evidencia: 'nova evidência', reabertura_negada: 'reabertura negada' }

async function esteiraView() {
  const raiz = h('div')
  const recarregar = async () => { raiz.replaceChildren(await esteiraConteudo(recarregar)) }
  await recarregar()
  return raiz
}

async function esteiraConteudo(recarregar) {
  const r = await api('/ideias'); if (!r.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
  const titulo = h('input', { type: 'text', id: 'ti', maxlength: 120, placeholder: 'Ex.: multa de trânsito com vício formal' })
  const dor = h('input', { type: 'text', id: 'do', maxlength: 1000, placeholder: 'Qual dor, de quem, com que evidência?' })
  const msg = h('p', { class: 'erro', role: 'alert' })
  const nova = h('form', { class: 'cartao', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''
    const x = await mudar('/ideias', 'POST', { titulo: titulo.value, dor: dor.value })
    if (!x.ok) { msg.textContent = 'Preencha o título (3+) e a dor (10+ caracteres).'; return }
    recarregar()
  } }, h('h2', { class: 'sem-topo' }, 'Nova dor'), h('label', { for: 'ti' }, 'Título'), titulo, h('label', { for: 'do' }, 'Dor e evidência'), dor, h('button', { type: 'submit' }, 'Abrir ficha'), msg)
  const colunas = COLUNAS.map(([k, nome]) => {
    const itens = r.j.ideias.filter((i) => (i.estado || 'rascunho') === k)
    return h('section', { class: 'coluna' }, h('h2', { class: 'sem-topo' }, `${nome} · ${itens.length}`), itens.length ? itens.map((i) => cartaoIdeia(i, r.j.hoje, recarregar)) : h('p', { class: 'vazio' }, 'vazio'))
  })
  return h('div', {}, nova, h('div', { class: 'kanban' }, colunas))
}

function cartaoIdeia(i, hoje, recarregar) {
  const n = (id, v, rot) => { const el = h('input', { type: 'number', min: 0, value: v, id: id + i.id }); return [h('label', { for: id + i.id }, rot), el] }
  const [lc, ic] = n('c', i.conversas_reais, 'Conversas reais (meta 10)')
  const [lp, ip] = n('p', i.disposicao_a_pagar, 'Disposição a pagar')
  const [lm, im] = n('m', (i.margem_por_caso_centavos / 100).toFixed(2), 'Margem por caso (R$)'); im.step = '0.01'; im.min = ''
  const ev = h('input', { type: 'checkbox', id: 'e' + i.id }); ev.checked = !!i.evidencia_dor
  const sc = h('input', { type: 'checkbox', id: 's' + i.id }); sc.checked = !!i.sacada_copiavel
  const msg = h('p', { role: 'status' })
  const salvar = async () => mudar('/ideias/' + i.id, 'PATCH', { conversasReais: Number(ic.value), disposicaoAPagar: Number(ip.value), margemPorCasoCentavos: Math.round(Number(im.value) * 100), evidenciaDor: ev.checked, sacadaCopiavel: sc.checked })
  const prazo = i.prazo_ate ? h('p', { class: 'ajuda' }, `Prazo: ${i.prazo_ate}${i.prazo_ate < hoje ? ' (vencido)' : ''}`) : null
  const decisao = i.motivo ? h('p', {}, h('strong', {}, 'Regra: '), ROTULO_MOTIVO[i.motivo] || i.motivo) : null
  const acoes = i.final ? null : h('button', { onclick: async (e) => {
    e.target.disabled = true; msg.textContent = ''
    const a = await salvar(); if (!a.ok) { msg.className = 'erro'; msg.textContent = 'Não foi possível salvar.'; e.target.disabled = false; return }
    const b = await mudar(`/ideias/${i.id}/avaliar`, 'POST')
    if (!b.ok) { msg.className = 'erro'; msg.textContent = 'Não foi possível avaliar.'; e.target.disabled = false; return }
    msg.textContent = 'Avaliando…'; setTimeout(recarregar, 2500)
  } }, 'Salvar e avaliar pela regra')
  return h('article', { class: 'cartao ideia' }, h('h3', { class: 'sem-topo' }, i.titulo), h('p', {}, i.dor), decisao, prazo,
    i.final ? h('p', { class: 'ajuda' }, 'Estado final: reabrir só com evidência nova.') : [lc, ic, lp, ip, lm, im,
      h('label', { class: 'consent', for: 'e' + i.id }, ev, 'Há evidência da dor'), h('label', { class: 'consent', for: 's' + i.id }, sc, 'Copiável em 1 semana sem a sacada')],
    acoes, msg)
}

async function metricasView() {
  const r = await api('/metricas'); if (!r.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
  const m = r.j
  const kpi = (v, t) => h('div', { class: 'kpi' }, h('strong', {}, v), h('span', {}, t))
  const total = m.ideiasPorEstado.reduce((a, x) => a + x.total, 0)
  const vivas = m.ideiasPorEstado.find((x) => x.estado === 'viva')?.total ?? 0
  return h('div', {}, h('div', { class: 'kpis' }, kpi(String(total), 'ideias'), kpi(String(vivas), 'vivas'), kpi(m.diasIdeiaAteViva == null ? '-' : m.diasIdeiaAteViva + ' d', 'ideia → viva')),
    h('h2', {}, 'Por produto'),
    tabela([['produto', 'produto'], ['casos', 'casos'], ['receita', 'receita'], ['custo', 'custo'], ['margem', 'margem'], ['custoCaso', 'custo/caso']],
      m.porProduto.map((x) => ({ produto: x.produto, casos: x.casos, receita: reais(x.receitaCentavos), custo: reais(x.custoCentavos), margem: reais(x.margemCentavos), custoCaso: reais(x.custoPorCasoCentavos) })), ['casos', 'receita', 'custo', 'margem', 'custoCaso']),
    h('p', { class: 'ajuda' }, 'Receita = pedidos marcados como pagos. Custo = lançamentos em /api/custos. Sem lançamento, o custo aparece zerado: não é prova de custo zero.'),
    await funilView())
}

const ROTULO_ETAPA = { visita: 'visitas', consentiu: 'autorizaram', escolheu: 'escolheram arquivo', guardou: 'guardaram', baixou: 'baixaram pacote', pediu_link: 'pediram acesso', entrou: 'entraram' }
const pct = (n, d) => (d ? `${Math.round((n / d) * 1000) / 10}%` : '-')
async function funilView() {
  const [r, ret] = await Promise.all([api('/funil?dias=14'), api('/retorno?dias=30')])
  if (!r.ok) return h('p', { class: 'erro' }, 'Falha ao carregar o funil.')
  const produtosComDado = Object.entries(r.j.porProduto)
  if (!produtosComDado.length) return h('div', {}, h('h2', {}, 'Funil da vitrine (14 dias)'), h('p', { class: 'vazio' }, 'Sem eventos ainda.'))
  return h('div', {}, h('h2', {}, `Funil da vitrine (desde ${r.j.desde})`),
    ...produtosComDado.map(([produto, c]) => {
      const base = c.visita || 0
      const origens = Object.entries(r.j.porOrigem?.[produto] || {})
        .map(([origem, e]) => ({ origem, visitas: e.visita || 0, guardaram: e.guardou || 0, baixaram: e.baixou || 0, conv: pct(e.guardou || 0, e.visita || 0) }))
        .sort((x, y) => y.visitas - x.visitas || y.guardaram - x.guardaram)
      const v = ret.ok ? ret.j.porProduto?.[produto] : null
      return h('div', {}, h('h3', {}, produto),
        tabela([['etapa', 'etapa'], ['total', 'total'], ['pct', '% das visitas']],
          r.j.etapas.map((e) => ({ etapa: ROTULO_ETAPA[e] || e, total: c[e] || 0, pct: pct(c[e] || 0, base) })), ['total', 'pct']),
        h('h4', {}, 'De onde vêm'),
        origens.length ? tabela([['origem', 'origem'], ['visitas', 'visitas'], ['guardaram', 'guardaram'], ['baixaram', 'baixaram'], ['conv', 'guardaram / visitas']], origens, ['visitas', 'guardaram', 'baixaram', 'conv'])
          : h('p', { class: 'vazio' }, 'Ainda sem origem registrada (começa a contar com esta versão).'),
        h('h4', {}, `Quem voltou (provas desde ${ret.ok ? ret.j.desde : '-'})`),
        v ? tabela([['m', 'medida'], ['n', 'total'], ['p', '%']], [
          { m: 'provas guardadas', n: v.provas, p: '' },
          { m: 'baixaram o pacote ou abriram o relatório', n: v.baixaram, p: pct(v.baixaram, v.provas) },
          { m: 'voltaram depois de 24 h (entre as com mais de 1 dia)', n: v.voltaram, p: pct(v.voltaram, v.elegiveis) },
          { m: 'guardadas numa conta', n: v.naConta, p: pct(v.naConta, v.provas) },
          { m: 'contas com 2 provas ou mais', n: v.contasComDuasOuMais, p: pct(v.contasComDuasOuMais, v.contas) },
        ], ['n', 'p']) : h('p', { class: 'vazio' }, 'Sem provas no período.'))
    }),
    h('p', { class: 'ajuda' }, 'Tudo é contagem agregada, sem dado pessoal e sem cookie. A origem é o utm_source do link ou o nome do site de onde a pessoa veio; "desconhecida" é quem guardou sem passar pela vitrine nesta versão. "Voltou" sai do log de acessos que já existia. Robôs podem inflar as visitas.'))
}

async function pedidosView() {
  const r = await api('/pedidos'); if (!r.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
  const raiz = h('div')
  const act = (id, rota) => async () => { await mudar(`/pedidos/${id}/${rota}`, 'POST'); raiz.replaceChildren(await pedidosView()) }
  if (!r.j.pedidos.length) return h('p', { class: 'vazio' }, 'Nenhum pedido ainda. Pagamento nesta etapa é manual: combine o Pix e marque aqui.')
  raiz.append(h('div', { class: 'rolagem' }, h('table', { class: 'tabela' },
    h('thead', {}, h('tr', {}, ['quando', 'produto', 'valor', 'contato', 'status', ''].map((t) => h('th', {}, t)))),
    h('tbody', {}, r.j.pedidos.map((p) => h('tr', {}, h('td', {}, p.criado_em.slice(0, 10)), h('td', {}, p.produto), h('td', { class: 'num' }, reais(p.valor_centavos)), h('td', {}, p.contato), h('td', {}, p.status),
      h('td', {}, p.status === 'pendente' ? [h('button', { class: 'sec', onclick: act(p.id, 'pago') }, 'Marcar pago'), ' ', h('button', { class: 'sec', onclick: act(p.id, 'cancelar') }, 'Cancelar')] : '')))))))
  return raiz
}

async function provasView() {
  const r = await api('/provas'); if (!r.ok) return h('p', { class: 'erro' }, 'Falha ao carregar.')
  const raiz = h('div')
  const vedar = (id) => async () => { await mudar(`/provas/${id}/vedar`, 'POST'); raiz.replaceChildren(await provasView()) }
  if (!r.j.provas.length) return h('p', { class: 'vazio' }, 'Nenhuma prova guardada ainda.')
  raiz.append(h('div', { class: 'rolagem' }, h('table', { class: 'tabela' },
    h('thead', {}, h('tr', {}, ['quando', 'produto', 'arquivo', 'estado', 'carimbo', 'downloads', ''].map((t) => h('th', {}, t)))),
    h('tbody', {}, r.j.provas.map((p) => h('tr', {}, h('td', {}, p.gravado_em.slice(0, 16).replace('T', ' ')), h('td', {}, p.produto), h('td', {}, `${p.nome_arquivo} (${p.origem === 'navegador' ? 'captura' : 'enviado'})`),
      h('td', {}, p.vedado ? 'vedada' : (p.motivo || p.estado || '-')), h('td', {}, p.ancora + (p.ots_altura ? ' · bloco ' + p.ots_altura : '')), h('td', { class: 'num' }, p.downloads),
      h('td', {}, p.vedado ? '' : h('button', { class: 'sec', onclick: vedar(p.id) }, 'Vedar'))))))),
    h('p', { class: 'ajuda' }, 'Vedar bloqueia o download e fica registrado no log imutável. A equipe só lê arquivos com registro de acesso.'))
  return raiz
}

rotear()
