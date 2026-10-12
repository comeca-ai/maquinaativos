// Vitrine de marca: landing de conversão, entrada por link mágico e "Minhas provas".
// Genérica: todo texto de marca vem do produto (captura.marca). O framework só desenha e chama a API.
// Desenho v2 ("manchete, papel, carimbo"): conta sem senha, link enviado com atalho para o e-mail, Minhas provas.
import { h, get, post, sha256Hex, ROTULO_RECUSA, ROTULO_ESTADO, baixarPacote, abrirRelatorio, enviarComProgresso, origemDaVisita, cabecalhoOrigem } from './base.js'

const app = document.getElementById('app')

/* ---------- utilidades ---------- */
const BR = { timeZone: 'America/Sao_Paulo' }
const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { ...BR, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (Brasília)'
const dataCurta = (iso) => new Date(iso).toLocaleString('pt-BR', { ...BR, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
const dataCarimbo = (d) => d.toLocaleDateString('pt-BR', { ...BR, day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase()
const hashCurto = (s) => `${s.slice(0, 16)}…${s.slice(-8)}`
const baixarTexto = (nomeArq, texto) => { const u = URL.createObjectURL(new Blob([texto], { type: 'text/plain' })); const a = h('a', { href: u, download: nomeArq }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000) }
const linkInterno = (href, ...filhos) => h('a', { href, 'data-link': true }, ...filhos)
const linkBotao = (href, texto, classe = 'v-botao') => h('a', { href, 'data-link': true, class: classe }, texto)
const rotaMinhas = (nome) => `/minhas-provas${nome ? `?p=${encodeURIComponent(nome)}` : ''}`
const rotaEntrar = (nome) => `/entrar${nome ? `?p=${encodeURIComponent(nome)}` : ''}`
const semNulos = (xs) => xs.flat().filter((x) => x != null && x !== false)
const anexar = (el, ...xs) => el.append(...semNulos(xs))
const trocar = (el, ...xs) => el.replaceChildren(...semNulos(xs))
const mascarar = (email) => { const [u, d] = email.trim().split('@'); return u && d ? `${u[0]}••••••@${d}` : email }

/** Atalho para a caixa de entrada dos provedores mais comuns (só abre a caixa; não lê nada). */
const PROVEDORES = [
  [/^(gmail|googlemail)\.com$/, 'Gmail', 'https://mail.google.com/mail/u/0/#inbox'],
  [/^(outlook|hotmail|live|msn)\.(com|com\.br)$/, 'Outlook', 'https://outlook.live.com/mail/0/'],
  [/^(yahoo|ymail)\.(com|com\.br)$/, 'Yahoo Mail', 'https://mail.yahoo.com/'],
  [/^(icloud|me|mac)\.com$/, 'iCloud Mail', 'https://www.icloud.com/mail'],
]

const TIPOS = [['image/', 'print ou foto'], ['video/', 'vídeo'], ['application/pdf', 'PDF'], ['text/plain', 'texto']]
const tiposLegiveis = (mimes) => {
  const nomes = TIPOS.filter(([t]) => mimes.some((m) => m === t || m.startsWith(t))).map(([, n]) => n)
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} ou ${nomes.at(-1)}` : nomes[0] || 'arquivo'
}

const ERRO_LINK = {
  email_invalido: 'Esse e-mail não parece certo.',
  muitas_tentativas: 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.',
  login_indisponivel: 'O acesso por e-mail ainda não está disponível. Guarde o código.',
  email_falhou: 'Não conseguimos enviar agora. Tente de novo em instantes.',
  prova_nao_encontrada: 'Não achamos essa prova para guardar na conta.',
  verificacao_falhou: 'Não conseguimos confirmar que você é uma pessoa. Recarregue a página.',
}

/** Contador anônimo do funil (agregado por dia no servidor; sem cookie, sem IP). */
function evento(nome, etapa, umaVezPorSessao = false) {
  const chave = `funil:${nome}:${etapa}`
  try { if (umaVezPorSessao && sessionStorage.getItem(chave)) return; if (umaVezPorSessao) sessionStorage.setItem(chave, '1') } catch { /* sem storage: conta mesmo assim */ }
  const url = `/pub/${encodeURIComponent(nome)}/evento`, corpo = JSON.stringify({ etapa, origem: origemDaVisita() })
  try { if (navigator.sendBeacon?.(url, new Blob([corpo], { type: 'application/json' }))) return } catch { /* cai no fetch */ }
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true }).catch(() => {})
}

async function estadoConta() {
  const r = await get('/pub/conta/eu')
  return r.ok ? r.j : { logado: false, loginDisponivel: false }
}

/** Nome da marca com a parte destacada no vermelho do carimbo (ex.: Tinha <Print>). */
const nomeDaMarca = (m) => (m.destaque && m.nome.endsWith(m.destaque) && m.nome !== m.destaque
  ? [m.nome.slice(0, m.nome.length - m.destaque.length), h('span', { class: 'v-destaque' }, m.destaque)]
  : [m.nome])

/** Topo e rodapé da marca (substitui os da máquina). O topo muda com a conta: Entrar, ou Minhas provas e Sair. */
function vestir(nome, cfg, casa, conta) {
  document.body.classList.add('vitrine')
  if (!cfg) return
  const m = cfg.marca
  document.title = `${m.nome} — ${m.promessa}`
  const sair = async () => { await post('/pub/conta/sair', {}); location.assign(casa) }
  const nav = h('nav', { class: 'v-nav', 'aria-label': 'Conta' },
    linkInterno(rotaMinhas(nome), 'Minhas provas'),
    conta?.logado ? h('button', { type: 'button', class: 'v-link', onclick: sair }, 'Sair')
      : conta?.loginDisponivel ? linkBotao(rotaEntrar(nome), 'Entrar', 'v-topo-entrar') : null)
  const logo = h('a', { href: casa, 'data-link': true, class: 'v-logo' }, ...nomeDaMarca(m))
  document.querySelector('.topo').replaceChildren(logo, nav)
  document.querySelector('.rodape').replaceChildren(h('p', {}, h('span', {}, `${m.nome} preserva arquivos e carimba a data.`), h('span', {}, 'Não é aconselhamento jurídico.'), linkInterno(rotaMinhas(nome), 'Minhas provas'), h('a', { href: `${casa}#base-legal` }, 'Base legal'), h('a', { href: `${casa}#limites` }, 'O que o carimbo não faz')))
}

function recibo({ id, nome, bytes, sha256, recebidoEm, carimbo, exemplo, bater }) {
  const quando = new Date(recebidoEm)
  return h('figure', { class: 'v-recibo' + (exemplo ? ' exemplo' : '') },
    h('div', { class: 'v-recibo-topo' }, h('span', {}, 'Recibo de preservação'), h('span', {}, id ? `Nº ${id.slice(0, 8)}` : 'Nº —')),
    h('dl', {},
      h('dt', {}, 'Arquivo'), h('dd', {}, `${nome} · ${tamanho(bytes)}`),
      h('dt', {}, 'SHA-256'), h('dd', { title: sha256 }, hashCurto(sha256)),
      h('dt', {}, 'Recebido'), h('dd', {}, dataHora(quando.toISOString())),
      h('dt', {}, 'Carimbo'), h('dd', {}, carimbo)),
    h('div', { class: 'v-recibo-pe' },
      exemplo ? h('figcaption', {}, 'Exemplo. O seu recibo sai assim, com os dados do seu arquivo.') : h('span'),
      h('div', { class: 'v-carimbo' + (bater ? ' bate' : ''), 'aria-hidden': 'true' }, h('b', {}, 'Guardado'), h('span', {}, dataCarimbo(quando)))))
}

/* ---------- link mágico ---------- */

/** Depois de pedir o link: confira o e-mail, atalho para a caixa de entrada, reenviar com espera e trocar de e-mail. */
function painelEnviado({ email, conta, reenviar, outro }) {
  const agora = new Date()
  const quando = `${agora.toLocaleDateString('pt-BR', { ...BR, day: '2-digit', month: 'short' }).replace('.', '')} · ${agora.toLocaleTimeString('pt-BR', { ...BR, hour: '2-digit', minute: '2-digit' })}`
  const provedor = PROVEDORES.find(([re]) => re.test(email.split('@')[1]?.toLowerCase() || ''))
  const msg = h('p', { class: 'v-status', role: 'status' })
  const botaoReenviar = h('button', { type: 'button', class: 'v-link' })
  let restam = 60, relogio = null
  const contar = () => {
    clearTimeout(relogio)
    if (!botaoReenviar.isConnected && restam < 60) return
    if (restam > 0) { botaoReenviar.disabled = true; botaoReenviar.textContent = `Reenviar em ${Math.floor(restam / 60)}:${String(restam % 60).padStart(2, '0')}`; restam -= 1; relogio = setTimeout(contar, 1000) }
    else { botaoReenviar.disabled = false; botaoReenviar.textContent = 'Reenviar o link' }
  }
  botaoReenviar.onclick = async () => {
    botaoReenviar.disabled = true; msg.className = 'v-status'; msg.textContent = 'Reenviando…'
    const r = await reenviar()
    if (r.ok) msg.textContent = 'Mandamos outro link. Use o mais recente.'
    else { msg.className = 'v-status erro'; msg.textContent = ERRO_LINK[r.j.erro] || 'Não foi possível reenviar agora.' }
    restam = 60; contar()
  }
  const titulo = h('h2', { tabindex: '-1' }, 'Confira seu e-mail.')
  const fato = (rotulo, valor) => h('div', {}, h('dt', {}, rotulo), h('dd', {}, valor))
  const painel = h('div', { class: 'v-enviado' },
    h('div', { class: 'v-carimbo bate', 'aria-hidden': 'true' }, h('b', {}, 'Enviado'), h('span', {}, quando.toUpperCase())),
    titulo,
    h('p', { class: 'v-lead' }, 'Mandamos o link para ', h('strong', { class: 'mono' }, mascarar(email)), '. Abra e toque em ', h('strong', {}, 'Abrir meu acesso'), '.'),
    h('dl', { class: 'v-tres' }, fato('Vale', `${conta?.linkMinutos || 15} minutos`), fato('Funciona', 'uma vez só'), fato('Abre em', 'qualquer aparelho')),
    provedor ? h('a', { class: 'v-botao tinta', href: provedor[2], target: '_blank', rel: 'noopener noreferrer' }, `Abrir o ${provedor[1]}`) : null,
    h('div', { class: 'v-naochegou' },
      h('p', {}, h('strong', {}, 'Não chegou?')),
      h('p', {}, `Olhe o spam e a aba Promoções.${conta?.remetente ? ` O remetente é ${conta.remetente}.` : ''}`),
      h('div', { class: 'v-acoes' }, botaoReenviar, outro ? h('button', { type: 'button', class: 'v-link', onclick: () => { clearTimeout(relogio); outro() } }, 'Usar outro e-mail') : null),
      msg))
  contar()
  queueMicrotask(() => titulo.focus({ preventScroll: false }))
  return painel
}

/**
 * Formulário do link mágico. `vincular` = { id, chave } de uma prova recém-guardada.
 * variante 'grande' (página Entrar): rótulo visível e botão largo; 'compacta' (depois de guardar): campo e botão na mesma linha.
 */
function formLink(nome, { titulo, texto, vincular, rotulo = 'Mandar meu link', turnstile, conta, variante = 'grande', alvo } = {}) {
  const idCampo = `email-${Math.random().toString(36).slice(2, 8)}`
  const email = h('input', { type: 'email', id: idCampo, name: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'voce@exemplo.com' })
  const msg = h('p', { class: 'v-status', role: 'status' })
  const botao = h('button', { type: 'submit', class: variante === 'grande' ? 'v-botao' : 'v-botao tinta' }, rotulo)
  const pedir = (endereco) => post('/pub/conta/link', { email: endereco, produto: nome, vincular, turnstile: turnstile?.() }, cabecalhoOrigem())
  const form = h('form', { class: `v-conta ${variante}`, onsubmit: async (e) => {
    e.preventDefault(); botao.disabled = true; msg.className = 'v-status'; msg.textContent = 'Enviando…'
    const endereco = email.value.trim()
    const r = await pedir(endereco)
    botao.disabled = false
    if (r.ok) {
      // Sem `alvo`, o formulário vira o painel; com `alvo` (página Entrar), a tela inteira vira o painel.
      const onde = alvo || form
      const original = [...onde.childNodes]
      onde.replaceChildren(painelEnviado({ email: endereco, conta, reenviar: () => pedir(endereco), outro: () => { onde.replaceChildren(...original); msg.textContent = ''; email.focus() } }))
      return
    }
    msg.className = 'v-status erro'
    msg.textContent = ERRO_LINK[r.j.erro] || 'Não foi possível enviar agora.'
  } },
  titulo ? h('h3', {}, titulo) : null,
  variante === 'grande'
    ? [texto ? h('p', {}, texto) : null, h('label', { for: idCampo }, 'Seu e-mail'), email, botao]
    : [h('label', { for: idCampo, class: 'v-conta-texto' }, texto || 'Seu e-mail'), h('div', { class: 'v-campo' }, email, botao)],
  msg)
  return form
}

/* ---------- código de recuperação ---------- */
function formCodigo(nome, { aoAchar } = {}) {
  const id = h('input', { type: 'text', id: 'rid', autocomplete: 'off', spellcheck: 'false', maxlength: 64 })
  const ch = h('input', { type: 'password', id: 'rch', autocomplete: 'off', maxlength: 128 })
  const msg = h('p', { class: 'v-status', role: 'status' }); const saida = h('div')
  return h('form', { class: 'v-form', onsubmit: async (e) => {
    e.preventDefault(); saida.replaceChildren(); msg.className = 'v-status'; msg.textContent = ''
    const r = await post(`/pub/${encodeURIComponent(nome)}/provas/${encodeURIComponent(id.value.trim())}/estado`, { chave: ch.value.trim() })
    if (!r.ok) { msg.className = 'v-status erro'; msg.textContent = 'Identificador ou código não confere.'; return }
    const x = r.j
    saida.replaceChildren(h('ul', { class: 'v-lista v-provas' }, itemProva(nome, { ...x, estado: x.caso?.estado }, ch.value.trim())))
    aoAchar?.()
  } }, h('label', { for: 'rid' }, 'Identificador'), id, h('label', { for: 'rch' }, 'Código de recuperação'), ch, h('div', {}, h('button', { type: 'submit', class: 'v-botao tinta' }, 'Ver minha prova')), msg, saida)
}

/** Logado: traz para a conta uma prova guardada antes, provando a posse com o código. */
function formTrazer(nome, depois) {
  const id = h('input', { type: 'text', id: 'tid', autocomplete: 'off', spellcheck: 'false', maxlength: 64 })
  const ch = h('input', { type: 'password', id: 'tch', autocomplete: 'off', maxlength: 128 })
  const msg = h('p', { class: 'v-status', role: 'status' })
  const botao = h('button', { type: 'submit', class: 'v-botao tinta' }, 'Trazer para minha conta')
  return h('form', { class: 'v-form', onsubmit: async (e) => {
    e.preventDefault(); botao.disabled = true; msg.className = 'v-status'; msg.textContent = 'Conferindo…'
    const r = await post('/pub/conta/vincular', { produto: nome, id: id.value.trim(), chave: ch.value.trim() })
    botao.disabled = false
    if (r.ok) return depois({ vinculada: true })
    msg.className = 'v-status erro'
    msg.textContent = r.status === 409 ? 'Esta prova já está em outra conta.' : r.status === 401 ? 'Sua sessão terminou. Entre de novo.' : 'Identificador ou código não confere.'
  } }, h('label', { for: 'tid' }, 'Identificador'), id, h('label', { for: 'tch' }, 'Código de recuperação'), ch, h('div', {}, botao), msg)
}

/** Bloco recolhido no pé das telas de conta: "tem o código?" abre o formulário. */
function blocoRecolhido(pergunta, acao, montar) {
  const caixa = h('div', { class: 'v-rodape-tela' })
  const abrir = () => { caixa.replaceChildren(h('h2', { class: 'v-sub-titulo' }, acao), montar()); caixa.querySelector('input')?.focus() }
  caixa.append(h('p', {}, pergunta), h('button', { type: 'button', class: 'v-link forte', onclick: abrir }, acao))
  return caixa
}

/* ---------- item de prova (Minhas provas e busca pelo código) ---------- */
function etiqueta(p) {
  if (p.vedado) return h('span', { class: 'v-etiqueta neutra' }, 'Indisponível')
  if (p.otsAltura || p.ancora === 'confirmada') return h('span', { class: 'v-etiqueta' }, 'Preservada')
  return h('span', { class: 'v-etiqueta espera' }, p.ancora === 'enviada' ? 'Aguardando' : 'Na fila')
}
function situacao(p) {
  if (p.vedado) return 'Indisponível para download.'
  if (p.otsAltura) return `Ancorada no Bitcoin, bloco nº ${Number(p.otsAltura).toLocaleString('pt-BR')}`
  if (['falhou', 'recusada', 'preservada_sem_ancora'].includes(p.estado)) return ROTULO_ESTADO[p.estado]
  if (p.ancora === 'enviada') return 'Carimbo enviado; o Bitcoin confirma em algumas horas'
  return 'Guardada; o carimbo sai na próxima tentativa (até 1 hora)'
}
function itemProva(nome, p, chave) {
  const msg = h('p', { class: 'v-status', role: 'status' })
  const produto = p.produto || nome
  return h('li', {},
    h('div', { class: 'v-item-topo' }, h('strong', { title: p.nome }, p.nome), etiqueta(p)),
    h('span', { class: 'v-meta mono' }, `${tamanho(p.bytes)} · ${dataCurta(p.recebidoEm)}`),
    h('span', { class: 'v-meta' }, situacao(p)),
    p.vedado ? null : h('div', { class: 'v-acoes' },
      h('button', { type: 'button', class: 'v-link forte', onclick: () => abrirRelatorio(produto, p.id, chave) }, 'Ver relatório'),
      h('button', { type: 'button', class: 'v-link', onclick: () => baixarPacote(produto, p.id, chave, msg) }, 'Baixar pacote (.zip)')),
    msg)
}

/* ---------- landing ---------- */
export async function paginaVitrine(nome, cfg, { raiz = false } = {}) {
  const m = cfg.marca
  const casa = raiz ? '/' : `/${encodeURIComponent(nome)}`
  const conta = await estadoConta()
  vestir(nome, cfg, casa, conta)
  const maxMB = Math.floor(cfg.maxBytes / 1048576)
  let tokenTurnstile = null
  const podeTela = Boolean(navigator.mediaDevices?.getDisplayMedia) && !matchMedia('(pointer: coarse)').matches
  const planoUnico = m.planos?.length === 1 ? m.planos[0] : null

  /* ferramenta */
  const aceite = h('input', { type: 'checkbox', id: 'aceite' })
  const consentimento = h('label', { class: 'v-consent', for: 'aceite' }, aceite,
    h('span', {}, 'Este conteúdo é meu ou tenho o direito de guardar. Só a impressão digital dele, não o arquivo, vai para um registro público. ', h('a', { href: m.baseLegal ? '#base-legal' : '#limites' }, 'O que o carimbo prova e o que não prova')))
  const arquivo = h('input', { type: 'file', id: 'arquivo', hidden: true, accept: cfg.tiposMime.map((t) => (t.endsWith('/') ? t + '*' : t)).join(',') })
  const principal = h('button', { type: 'button', class: 'v-botao', onclick: () => { if (consentido()) arquivo.click() } }, m.chamada || 'Escolher arquivo')
  const barra = h('i'); const progresso = h('div', { class: 'v-progresso', hidden: true, 'aria-hidden': 'true' }, barra)
  const msg = h('p', { class: 'v-status', role: 'status', 'aria-live': 'polite' })
  const alt = podeTela
    ? h('div', { class: 'v-alt' },
      h('button', { type: 'button', class: 'v-link', onclick: () => printDaTela() }, 'Tirar print da tela'),
      h('button', { type: 'button', class: 'v-link', onclick: (e) => gravarTela(e.target) }, 'Gravar a tela'),
      h('span', {}, 'ou arraste o arquivo aqui'))
    : h('p', { class: 'v-alt' }, 'No celular: escolha o print, a foto, o vídeo ou o PDF que já está no aparelho.')
  const selo = planoUnico ? h('div', { class: 'v-selo', 'aria-hidden': 'true' }, h('b', {}, planoUnico.preco), h('span', {}, planoUnico.unidade)) : null
  const ferramenta = h('div', { class: 'v-ferramenta' + (selo ? ' com-selo' : ''), id: 'guardar' },
    selo,
    h('p', { class: 'v-passo' }, '1 · Autorize'), consentimento,
    h('p', { class: 'v-passo' }, '2 · Envie'), principal, alt, progresso, msg,
    h('p', { class: 'v-ferramenta-pe' }, `Até ${maxMB} MB · ${tiposLegiveis(cfg.tiposMime)} · sem cadastro`),
    h('p', { class: 'v-aviso' }, cfg.aviso), arquivo)
  const jaGuardou = conta.logado
    ? h('p', { class: 'v-ja' }, 'Você está conectado. O que guardar aqui vai direto para ', linkInterno(rotaMinhas(nome), 'Minhas provas'), '.')
    : conta.loginDisponivel ? h('p', { class: 'v-ja' }, 'Já guardou antes? ', linkInterno(rotaEntrar(nome), 'Entre e veja suas provas')) : null

  function consentido() {
    if (aceite.checked) { consentimento.classList.remove('pedir'); return true }
    consentimento.classList.add('pedir'); msg.className = 'v-status erro'; msg.textContent = 'Marque a autorização para continuar.'
    ferramenta.scrollIntoView({ behavior: 'smooth', block: 'center' }); aceite.focus({ preventScroll: true })
    return false
  }
  let consentiuContado = false
  aceite.addEventListener('change', () => { if (aceite.checked) { consentimento.classList.remove('pedir'); msg.textContent = ''; if (!consentiuContado) { consentiuContado = true; evento(nome, 'consentiu') } } })

  const ocupado = (sim) => { ferramenta.querySelectorAll('button').forEach((b) => { b.disabled = sim }) }
  async function preservar(blob, nomeArquivo, origem) {
    if (blob.size > cfg.maxBytes) { msg.className = 'v-status erro'; msg.textContent = `Arquivo maior que ${maxMB} MB.`; return }
    evento(nome, 'escolheu')
    ocupado(true); msg.className = 'v-status'; msg.textContent = 'Calculando a impressão digital no seu aparelho…'
    try {
      const sha = await sha256Hex(blob)
      progresso.hidden = false; barra.style.width = '0%'
      msg.textContent = 'Enviando para o cofre…'
      const q = new URLSearchParams({ sha256: sha, origem, consentimento: '1' })
      const r = await enviarComProgresso(`/pub/${encodeURIComponent(nome)}/captura?${q}`, blob, {
        'content-type': blob.type || 'application/octet-stream', 'x-nome-arquivo': encodeURIComponent(nomeArquivo), ...cabecalhoOrigem(), ...(tokenTurnstile ? { 'x-turnstile': tokenTurnstile } : {}),
      }, (f) => { barra.style.width = `${Math.round(f * 100)}%`; msg.textContent = f < 1 ? `Enviando para o cofre… ${Math.round(f * 100)}%` : 'Registrando o carimbo…' })
      progresso.hidden = true
      if (!r.ok) {
        msg.className = 'v-status erro'
        msg.textContent = r.j.recusada ? (ROTULO_RECUSA[r.j.motivo] || 'Recusada.') : r.status === 413 ? `Arquivo maior que ${maxMB} MB.` : r.status === 415 ? 'Esse tipo de arquivo não é aceito.' : r.status === 429 ? 'Muitas tentativas. Tente mais tarde.' : r.j.erro === 'hash_divergente' ? 'O arquivo mudou durante o envio. Nada foi guardado. Tente de novo.' : r.status === 0 ? 'Falha de conexão. Nada foi guardado.' : 'Não foi possível guardar agora.'
        return
      }
      mostrarResultado({ ...r.j, nome: nomeArquivo })
    } catch { msg.className = 'v-status erro'; msg.textContent = 'Falha ao ler o arquivo. Nada foi guardado.' }
    finally { ocupado(false); progresso.hidden = true }
  }

  arquivo.addEventListener('change', () => { const f = arquivo.files[0]; arquivo.value = ''; if (f) preservar(f, f.name, 'arquivo_enviado') })
  ferramenta.addEventListener('dragover', (e) => { e.preventDefault(); ferramenta.classList.add('arrastando') })
  ferramenta.addEventListener('dragleave', () => ferramenta.classList.remove('arrastando'))
  ferramenta.addEventListener('drop', (e) => { e.preventDefault(); ferramenta.classList.remove('arrastando'); const f = e.dataTransfer?.files?.[0]; if (f && consentido()) preservar(f, f.name, 'arquivo_enviado') })

  async function printDaTela() {
    if (!consentido()) return
    let stream
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }) } catch { msg.className = 'v-status erro'; msg.textContent = 'Captura de tela cancelada ou não permitida.'; return }
    const v = h('video', { muted: true, playsinline: true }); v.srcObject = stream
    await v.play(); await new Promise((r) => setTimeout(r, 350))
    const c = h('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0)
    stream.getTracks().forEach((t) => t.stop())
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    if (blob) preservar(blob, `print-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, 'navegador')
  }

  async function gravarTela(gatilho) {
    if (!consentido()) return
    let stream
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) } catch { msg.className = 'v-status erro'; msg.textContent = 'Gravação cancelada ou não permitida.'; return }
    const tipo = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: tipo }); const partes = []; let total = 0
    const parar = h('button', { type: 'button', class: 'v-botao tinta' }, 'Parar e guardar')
    const finalizar = () => { if (rec.state !== 'inactive') rec.stop() }
    rec.ondataavailable = (ev) => { if (ev.data.size) { partes.push(ev.data); total += ev.data.size; if (total > cfg.maxBytes * 0.95) { msg.textContent = `Limite de ${maxMB} MB atingido; encerrando.`; finalizar() } } }
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); parar.remove(); principal.hidden = false; gatilho.disabled = false; preservar(new Blob(partes, { type: 'video/webm' }), `gravacao-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, 'navegador') }
    stream.getVideoTracks()[0].addEventListener('ended', finalizar)
    parar.onclick = finalizar; principal.hidden = true; principal.after(parar); gatilho.disabled = true
    msg.className = 'v-status'; msg.textContent = 'Gravando… toque em "Parar e guardar" quando terminar.'
    rec.start(1000)
  }

  function mostrarResultado(r) {
    const status = h('p', { class: 'v-status', role: 'status' })
    const codigo = r.codigoDeRecuperacao
    const chaveAcesso = r.naConta ? null : codigo
    const textoCodigo = `Identificador: ${r.id}\nCódigo de recuperação: ${codigo}\nSHA-256: ${r.sha256}\nRecebido em: ${r.recebidoEm}\n`
    const acoes = h('div', { class: 'v-acoes' },
      h('button', { type: 'button', class: 'v-botao', onclick: () => abrirRelatorio(nome, r.id, chaveAcesso) }, 'Ver relatório'),
      h('button', { type: 'button', class: 'v-link', onclick: () => baixarPacote(nome, r.id, chaveAcesso, status) }, 'Baixar pacote (.zip)'),
      h('button', { type: 'button', class: 'v-link', onclick: () => { ferramenta.replaceChildren(...original); aceite.checked = true; msg.textContent = '' } }, 'Guardar outro arquivo'))
    const titulo = h('h2', { tabindex: '-1' }, 'Guardado.')
    const corpo = r.naConta
      ? [h('p', { class: 'v-lead' }, 'Já está em ', linkInterno(rotaMinhas(nome), 'Minhas provas'), '. Sem código para guardar: é só entrar pelo e-mail quando precisar.'),
        acoes, status,
        h('p', { class: 'v-aviso' }, 'O carimbo chega ao Bitcoin em algumas horas. Quando confirmar, o pacote e o relatório já trazem o número do bloco.')]
      : [h('div', { class: 'v-codigo' },
        h('p', {}, h('strong', {}, 'Seu código de recuperação. '), 'Ele aparece só agora e não temos como recuperá-lo.'),
        h('output', {}, codigo),
        h('div', { class: 'v-acoes' },
          h('button', { type: 'button', class: 'v-link', onclick: async (e) => { try { await navigator.clipboard.writeText(textoCodigo); e.target.textContent = 'Copiado' } catch { e.target.textContent = 'Não deu para copiar; salve o .txt' } } }, 'Copiar'),
          h('button', { type: 'button', class: 'v-link', onclick: () => baixarTexto(`codigo-${r.id}.txt`, textoCodigo) }, 'Salvar como .txt'))),
        acoes, status,
        conta.loginDisponivel ? formLink(nome, { variante: 'compacta', titulo: 'Não quer depender do código?', texto: 'Guarde esta prova na sua conta. Você entra pelo e-mail, sem senha.', vincular: { id: r.id, chave: codigo }, rotulo: 'Guardar', turnstile: () => tokenTurnstile, conta }) : null]
    const bloco = h('div', { class: 'v-resultado' }, titulo,
      recibo({ id: r.id, nome: r.nome, bytes: r.bytes, sha256: r.sha256, recebidoEm: r.recebidoEm, carimbo: r.ancora === 'enviada' ? 'enviado ao OpenTimestamps; a confirmação no Bitcoin costuma levar algumas horas' : 'na fila; tentamos de novo em até 1 hora', bater: true }),
      ...corpo)
    const original = [...ferramenta.childNodes]
    ferramenta.replaceChildren(bloco)
    ferramenta.scrollIntoView({ behavior: 'smooth', block: 'start' })
    titulo.focus({ preventScroll: true })
  }

  /* recibo de exemplo (dados reais de um arquivo de exemplo, calculados aqui) */
  const exemplo = m.exemplo || { arquivo: 'conversa.png', bytes: 284312 }
  const shaExemplo = await sha256Hex(new Blob([`exemplo ${exemplo.arquivo}`]))
  const reciboExemplo = recibo({ nome: exemplo.arquivo, bytes: exemplo.bytes, sha256: shaExemplo, recebidoEm: new Date().toISOString(), carimbo: 'OpenTimestamps → Bitcoin', exemplo: true, bater: true })

  /* seções */
  // Desenho v2: manchete à esquerda, a ferramenta à direita (acima da dobra no computador; logo abaixo no celular).
  const heroi = h('section', { class: 'v-heroi' },
    h('div', { class: 'v-heroi-texto' },
      h('p', { class: 'v-sobre' }, cfg.titulo), h('h1', { class: 'v-manchete' }, m.promessa), h('p', { class: 'v-sub' }, cfg.subtitulo),
      h('p', { class: 'v-provas-linha' }, h('span', {}, 'Carimbo no Bitcoin'), h('span', { 'aria-hidden': 'true' }, '/'), h('span', {}, 'Relatório para anexar'), h('span', { 'aria-hidden': 'true' }, '/'), h('span', {}, 'Pacote que qualquer pessoa confere'))),
    h('div', { class: 'v-heroi-acao' }, ferramenta, jaGuardou))

  const cenas = m.cenas?.length ? h('section', { class: 'v-secao v-cenas' }, h('h2', {}, 'Quando você vai precisar'),
    h('ol', {}, m.cenas.map((c, i) => h('li', {}, h('span', { class: 'v-num' }, String(i + 1).padStart(2, '0')), h('div', {}, h('h3', {}, c.titulo), h('p', {}, c.texto)))))) : null

  const pacote = h('section', { class: 'v-pacote' },
    h('h2', {}, 'O que você leva para casa'),
    h('p', {}, 'Um pacote .zip que qualquer pessoa confere sem depender da gente, nem de que a gente continue existindo.'),
    h('div', { class: 'v-pacote-recibo' }, reciboExemplo),
    h('dl', {},
      h('div', {}, h('dt', {}, 'seu arquivo'), h('dd', {}, 'Byte a byte, do jeito que chegou.')),
      h('div', {}, h('dt', {}, 'manifesto.json'), h('dd', {}, 'A impressão digital (SHA-256), o tamanho, o tipo e a hora em que o nosso servidor recebeu.')),
      h('div', {}, h('dt', {}, 'prova.ots'), h('dd', {}, 'O carimbo OpenTimestamps, que amarra o manifesto a um bloco do Bitcoin. Ninguém consegue reescrever essa data depois.')),
      h('div', {}, h('dt', {}, 'RELATORIO.html'), h('dd', {}, 'Tudo o que o cofre registrou, para ler, imprimir ou anexar. Também abre direto pelo botão "Ver relatório".')),
      h('div', {}, h('dt', {}, 'LEIA-ME.txt'), h('dd', {}, 'O passo a passo para conferir tudo com ferramentas abertas.'))))

  const como = h('section', { class: 'v-secao' }, h('h2', {}, 'Como funciona'),
    h('div', { class: 'v-narrativa' }, m.passos.map((p) => h('p', {}, h('b', {}, `${p.titulo}. `), p.texto))))

  const perguntas = m.perguntas.length ? h('section', { class: 'v-secao' }, h('h2', {}, 'Antes de você perguntar'),
    h('div', { class: 'v-perguntas' }, m.perguntas.map((q) => h('div', {}, h('h3', {}, q.pergunta), h('p', {}, q.resposta))))) : null

  const limites = m.baseLegal
    ? h('section', { class: 'v-secao v-base', id: 'base-legal' }, h('h2', {}, 'Base legal'),
        h('p', { class: 'v-base-intro' }, m.baseLegal.intro),
        h('ol', { class: 'v-normas' }, m.baseLegal.itens.map((i) => h('li', {},
          h('h3', {}, h('a', { href: i.link, target: '_blank', rel: 'noopener' }, i.norma)),
          h('blockquote', {}, `“${i.trecho}”`),
          h('p', {}, i.leitura)))),
        h('div', { class: 'v-limites', id: 'limites' }, h('h3', {}, 'O que o carimbo não faz'), h('ul', {}, m.limites.map((x) => h('li', {}, x)))),
        h('p', { class: 'v-ressalva' }, m.baseLegal.ressalva))
    : h('section', { class: 'v-secao v-limites', id: 'limites' }, h('h2', {}, 'O que a gente não faz'), h('ul', {}, m.limites.map((x) => h('li', {}, x))))

  // Um plano só (lançamento): preço em tipografia grande e a lista do que inclui; vários planos: a grade.
  const planos = planoUnico
    ? h('section', { class: 'v-secao v-preco-unico', id: 'planos' },
      h('div', { class: 'v-preco-cab' }, h('p', { class: 'v-sobre' }, 'Quanto custa'), h('p', { class: 'v-preco-grande' }, planoUnico.preco), h('p', { class: 'v-preco-unidade' }, planoUnico.unidade)),
      h('div', { class: 'v-preco-corpo' }, h('ul', {}, planoUnico.inclui.map((x) => h('li', {}, x))), m.planosNota ? h('p', { class: 'v-planos-nota' }, m.planosNota) : null))
    : m.planos?.length ? h('section', { class: 'v-secao v-planos', id: 'planos' }, h('h2', {}, 'Planos'),
      h('div', { class: 'v-planos-grade' }, m.planos.map((p) => h('div', { class: 'v-plano' + (p.destaque ? ' destaque' : '') },
        h('h3', {}, p.nome), h('p', { class: 'v-preco' }, h('strong', {}, p.preco), h('span', {}, ` ${p.unidade}`)),
        h('ul', {}, p.inclui.map((x) => h('li', {}, x)))))),
      m.planosNota ? h('p', { class: 'v-planos-nota' }, m.planosNota) : null) : null

  // Benefícios da conta: só com o login ligado (a página não promete o que não funciona) e para quem ainda não entrou.
  const contaSecao = m.conta && conta.loginDisponivel && !conta.logado
    ? h('section', { class: 'v-conta-faixa', id: 'conta' },
      h('div', { class: 'v-conta-cab' }, h('h2', {}, m.conta.titulo), h('p', {}, m.conta.texto), linkBotao(rotaEntrar(nome), m.conta.chamada || 'Entrar com meu e-mail')),
      h('ol', { class: 'v-beneficios' }, m.conta.beneficios.map((b, i) => h('li', {}, h('span', { class: 'v-num' }, String(i + 1).padStart(2, '0')), h('strong', {}, b.titulo), h('span', {}, b.texto)))))
    : null

  const irParaFerramenta = () => { ferramenta.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (ferramenta.contains(aceite)) aceite.focus({ preventScroll: true }) }
  const fechamento = h('section', { class: 'v-fechamento' }, h('p', {}, m.fechamento || m.promessa), h('button', { type: 'button', class: 'v-botao', onclick: irParaFerramenta }, m.chamada || 'Guardar agora'))

  const fixa = h('div', { class: 'v-fixa', hidden: true }, h('button', { type: 'button', class: 'v-botao', onclick: irParaFerramenta }, m.chamada || 'Guardar agora'))

  trocar(app, heroi, contaSecao, planos, cenas, pacote, como, perguntas, limites, fechamento, fixa)
  evento(nome, 'visita', true)

  if ('IntersectionObserver' in window) {
    const visiveis = new Set()
    const io = new IntersectionObserver((es) => {
      for (const e of es) e.isIntersecting ? visiveis.add(e.target) : visiveis.delete(e.target)
      const mostrar = visiveis.size === 0 && window.scrollY > 200
      fixa.hidden = !mostrar; document.body.classList.toggle('com-fixa', mostrar)
    })
    io.observe(ferramenta); io.observe(fechamento)
  }

  if (cfg.turnstileSitekey) {
    const alvo = h('div'); ferramenta.insertBefore(alvo, principal)
    const sc = h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true })
    sc.onload = () => window.turnstile.render(alvo, { sitekey: cfg.turnstileSitekey, callback: (tk) => { tokenTurnstile = tk } })
    document.head.append(sc)
  }
}

/* ---------- entrar (link mágico) ---------- */
async function carregarMarca(nome) {
  if (!nome) return null
  const r = await get(`/pub/${encodeURIComponent(nome)}/captura`)
  return r.ok && r.j.marca ? r.j : null
}

/** "Entre sem senha" (ou, com o login desligado, só o código de recuperação). */
function telaEntrar(nome, pagina, conta) {
  pagina.classList.add('v-tela')
  if (conta.loginDisponivel) {
    anexar(pagina,
      h('p', { class: 'v-sobre' }, 'Minhas provas'),
      h('h1', {}, 'Entre sem senha.'),
      h('p', { class: 'v-lead' }, `Digite seu e-mail. Mandamos um link que vale ${conta.linkMinutos || 15} minutos e funciona uma vez só.`),
      formLink(nome, { variante: 'grande', rotulo: 'Mandar meu link', conta, alvo: pagina }),
      h('p', { class: 'v-nota' }, 'Seu e-mail não fica guardado em texto. Guardamos só uma marca cifrada dele, para reconhecer você na próxima vez.'),
      nome ? blocoRecolhido('Guardou sem entrar e tem o código?', 'Abrir com o código de recuperação', () => formCodigo(nome)) : null)
    return
  }
  anexar(pagina, h('h1', {}, 'Minhas provas'), h('p', { class: 'v-lead' }, 'O acesso por e-mail ainda não está disponível. Abra sua prova com o identificador e o código de recuperação.'), nome ? formCodigo(nome) : null)
}

export async function paginaEntrar(nome) {
  const [cfg, conta] = await Promise.all([carregarMarca(nome), estadoConta()])
  vestir(nome, cfg, `/${encodeURIComponent(nome || '')}`, conta)
  // O token vem no fragmento; tiramos da barra de endereço na hora (não fica no histórico nem em print de tela).
  const token = new URLSearchParams(location.hash.slice(1)).get('t')
  if (token) history.replaceState(null, '', location.pathname + location.search)
  const pagina = h('section', { class: 'v-pagina v-tela' })
  app.replaceChildren(pagina)

  if (!token) {
    if (!conta.logado) return telaEntrar(nome, pagina, conta)
    history.replaceState(null, '', rotaMinhas(nome))
    return paginaMinhasProvas(nome)
  }

  const msg = h('p', { class: 'v-status', role: 'status' })
  const vencido = () => {
    trocar(pagina,
      h('div', { class: 'v-carimbo neutro', 'aria-hidden': 'true' }, h('b', {}, 'Vencido')),
      h('h1', {}, 'Esse link já foi usado ou venceu.'),
      h('p', { class: 'v-lead' }, `Cada link vale ${conta.linkMinutos || 15} minutos e funciona uma vez só. Peça outro: chega em instantes.`),
      conta.loginDisponivel ? formLink(nome, { variante: 'grande', rotulo: 'Pedir outro link', conta, alvo: pagina }) : null,
      h('div', { class: 'v-rodape-tela' }, h('p', {}, 'O que você guardou continua no cofre. Nada se perde quando um link vence.')))
    pagina.querySelector('input')?.focus()
  }
  const botao = h('button', { type: 'button', class: 'v-botao', onclick: async () => {
    botao.disabled = true; msg.className = 'v-status'; msg.textContent = 'Entrando…'
    const r = await post('/pub/conta/entrar', { token }, cabecalhoOrigem())
    if (r.ok) { history.replaceState(null, '', rotaMinhas(nome)); return paginaMinhasProvas(nome, { vinculada: r.j.vinculada }) }
    if (r.status === 410) return vencido()
    botao.disabled = false; msg.className = 'v-status erro'; msg.textContent = 'Não foi possível entrar agora. Tente de novo.'
  } }, 'Entrar')
  anexar(pagina,
    h('p', { class: 'v-sobre' }, 'Seu acesso'),
    h('h1', {}, 'Quase lá.'),
    h('p', { class: 'v-lead' }, 'Toque em Entrar para abrir suas provas neste aparelho.'),
    botao,
    h('p', { class: 'v-nota mono' }, `Você fica conectado por ${conta.sessaoDias || 30} dias neste aparelho.`),
    msg,
    h('div', { class: 'v-rodape-tela' },
      h('p', {}, h('strong', {}, 'Por que um toque a mais?')),
      h('p', {}, 'Alguns serviços de e-mail abrem os links sozinhos para procurar vírus. Com o toque, quem entra é você, não o robô.')))
  botao.focus()
}

/* ---------- minhas provas ---------- */
export async function paginaMinhasProvas(nome, { vinculada = false } = {}) {
  const [cfg, conta] = await Promise.all([carregarMarca(nome), estadoConta()])
  const casa = `/${encodeURIComponent(nome || '')}`
  vestir(nome, cfg, casa, conta)
  const pagina = h('section', { class: 'v-pagina v-tela' })
  app.replaceChildren(pagina)
  if (!conta.logado) return telaEntrar(nome, pagina, conta)

  const r = await get('/pub/conta/provas')
  const provas = r.ok ? r.j.provas : []
  const n = provas.length
  const trazer = nome ? blocoRecolhido('Guardou antes, sem entrar?', 'Trazer para cá com o código de recuperação', () => formTrazer(nome, (o) => paginaMinhasProvas(nome, o))) : null
  anexar(pagina,
    h('h1', {}, 'Minhas provas'),
    h('p', { class: 'v-nota mono' }, n ? `${n} ${n > 1 ? 'provas' : 'prova'} · conectado neste aparelho` : 'conectado neste aparelho'),
    vinculada ? h('p', { class: 'v-ok', role: 'status' }, 'Pronto. A prova agora está na sua conta.') : null)
  if (n) {
    anexar(pagina,
      linkBotao(casa, 'Guardar nova prova'),
      h('ul', { class: 'v-lista v-provas' }, provas.map((p) => itemProva(nome, p, null))),
      h('p', { class: 'v-nota' }, 'O pacote de cada prova se confere sem depender de nós.'),
      trazer)
  } else {
    anexar(pagina,
      h('div', { class: 'v-vazio' }, h('p', { class: 'v-vazio-titulo' }, 'Nada guardado ainda.'), h('p', {}, 'Guarde o print agora. Ele aparece aqui, com o carimbo, assim que chegar ao cofre.')),
      linkBotao(casa, 'Guardar a primeira prova'),
      trazer)
  }
}
