// Frontend genérico: não conhece nenhum produto. Renderiza o que a `tela` declarada manda.
const app = document.getElementById('app')

function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const f of filhos.flat()) el.append(f instanceof Node ? f : document.createTextNode(String(f ?? '')))
  return el
}
const limpar = () => { app.replaceChildren() }
const get = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j } }
const post = (url, corpo, headers = {}) => get(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(corpo) })

/* ---------- roteador ---------- */
function ir(caminho) { history.pushState({}, '', caminho); rotear() }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]')
  if (a && a.origin === location.origin) { e.preventDefault(); ir(a.pathname) }
})
addEventListener('popstate', rotear)

async function rotear() {
  limpar()
  app.classList.remove('studio')
  const partes = location.pathname.split('/').filter(Boolean)
  if (partes.length === 0) return paginaInicial()
  if (partes[0] === 'studio') return studio()
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
async function paginaProduto(nome) {
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
  const corpo = h('div'); let aba = 'sinais'
  const nomes = { sinais: 'Sinais do funil', produtos: 'Produtos', vencidos: 'Casos vencidos', interessados: 'Interessados' }
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

rotear()
