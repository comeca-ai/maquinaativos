// Vitrine de marca: landing de conversão, entrada por link mágico e "Minhas provas".
// Genérica: todo texto de marca vem do produto (captura.marca). O framework só desenha e chama a API.
import { h, get, post, sha256Hex, ROTULO_RECUSA, ROTULO_ESTADO, baixarPacote, abrirRelatorio, enviarComProgresso } from './base.js'

const app = document.getElementById('app')

/* ---------- utilidades ---------- */
const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (Brasília)'
const dataCarimbo = (d) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase()
const hashCurto = (s) => `${s.slice(0, 16)}…${s.slice(-8)}`
const baixarTexto = (nomeArq, texto) => { const u = URL.createObjectURL(new Blob([texto], { type: 'text/plain' })); const a = h('a', { href: u, download: nomeArq }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000) }
const linkInterno = (href, ...filhos) => h('a', { href, 'data-link': true }, ...filhos)

/** Contador anônimo do funil (agregado por dia no servidor; sem cookie, sem IP). */
function evento(nome, etapa, umaVezPorSessao = false) {
  const chave = `funil:${nome}:${etapa}`
  try { if (umaVezPorSessao && sessionStorage.getItem(chave)) return; if (umaVezPorSessao) sessionStorage.setItem(chave, '1') } catch { /* sem storage: conta mesmo assim */ }
  const url = `/pub/${encodeURIComponent(nome)}/evento`, corpo = JSON.stringify({ etapa })
  try { if (navigator.sendBeacon?.(url, new Blob([corpo], { type: 'application/json' }))) return } catch { /* cai no fetch */ }
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true }).catch(() => {})
}

async function estadoConta() {
  const r = await get('/pub/conta/eu')
  return r.ok ? r.j : { logado: false, loginDisponivel: false }
}

/** Topo e rodapé da marca (substitui os da máquina). */
function vestir(nome, cfg, casa) {
  const m = cfg.marca
  document.body.classList.add('vitrine')
  document.title = `${m.nome} — ${m.promessa}`
  const topo = document.querySelector('.topo')
  topo.replaceChildren(linkInterno(casa, m.nome), linkInterno(`/minhas-provas?p=${encodeURIComponent(nome)}`, 'Minhas provas'))
  topo.firstChild.className = 'v-logo'
  topo.lastChild.className = 'v-nav'
  document.querySelector('.rodape').replaceChildren(h('p', {}, h('span', {}, `${m.nome} preserva arquivos e carimba a data.`), h('span', {}, 'Não é aconselhamento jurídico.'), linkInterno(`/minhas-provas?p=${encodeURIComponent(nome)}`, 'Minhas provas')))
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

/** Formulário de e-mail do link mágico. `vincular` = { id, chave } de uma prova recém-guardada. */
function formLink(nome, { titulo, texto, vincular, rotulo = 'Enviar link de acesso', turnstile } = {}) {
  const email = h('input', { type: 'email', id: 'email-link', name: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'voce@email.com', 'aria-label': 'Seu e-mail' })
  const msg = h('p', { class: 'v-status', role: 'status' })
  const botao = h('button', { type: 'submit', class: 'v-botao tinta' }, rotulo)
  const form = h('form', { class: 'v-conta', onsubmit: async (e) => {
    e.preventDefault(); botao.disabled = true; msg.className = 'v-status'; msg.textContent = 'Enviando…'
    const r = await post('/pub/conta/link', { email: email.value, produto: nome, vincular, turnstile: turnstile?.() })
    botao.disabled = false
    if (r.ok) { form.replaceChildren(h('h3', {}, 'Confira seu e-mail.'), h('p', {}, `Mandamos um link para ${email.value.trim()}. Ele vale ${r.j.minutos || 15} minutos e funciona uma vez só.`)); return }
    msg.className = 'v-status erro'
    msg.textContent = { email_invalido: 'Esse e-mail não parece certo.', muitas_tentativas: 'Muitos pedidos seguidos. Espere alguns minutos.', login_indisponivel: 'O acesso por e-mail ainda não está disponível. Guarde o código.', email_falhou: 'Não conseguimos enviar agora. Tente de novo em instantes.', prova_nao_encontrada: 'Não achamos essa prova para vincular.' }[r.j.erro] || 'Não foi possível enviar agora.'
  } },
  titulo ? h('h3', {}, titulo) : null, texto ? h('p', {}, texto) : null,
  h('div', { class: 'v-campo' }, email, botao), msg)
  return form
}

function formCodigo(nome) {
  const id = h('input', { type: 'text', id: 'rid', autocomplete: 'off', spellcheck: 'false', maxlength: 64 })
  const ch = h('input', { type: 'password', id: 'rch', autocomplete: 'off', maxlength: 128 })
  const msg = h('p', { class: 'v-status', role: 'status' }); const saida = h('div')
  return h('form', { class: 'v-form', onsubmit: async (e) => {
    e.preventDefault(); saida.replaceChildren(); msg.className = 'v-status'; msg.textContent = ''
    const r = await post(`/pub/${encodeURIComponent(nome)}/provas/${encodeURIComponent(id.value.trim())}/estado`, { chave: ch.value.trim() })
    if (!r.ok) { msg.className = 'v-status erro'; msg.textContent = 'Identificador ou código não confere.'; return }
    const x = r.j
    saida.replaceChildren(h('ul', { class: 'v-lista' }, itemProva(nome, { ...x, estado: x.caso?.estado }, ch.value.trim())))
  } }, h('label', { for: 'rid' }, 'Identificador'), id, h('label', { for: 'rch' }, 'Código de recuperação'), ch, h('div', {}, h('button', { type: 'submit', class: 'v-botao tinta' }, 'Ver minha prova')), msg, saida)
}

function itemProva(nome, p, chave) {
  const msg = h('p', { class: 'v-status', role: 'status' })
  const situacao = p.otsAltura ? `Ancorado no Bitcoin, bloco ${p.otsAltura}` : p.ancora === 'nao_enviada' ? 'Guardado; carimbo na fila' : (ROTULO_ESTADO[p.estado] || 'Em andamento')
  return h('li', {},
    h('strong', {}, p.nome),
    h('span', { class: 'v-meta' }, `${dataHora(p.recebidoEm)} · ${tamanho(p.bytes)}`),
    h('span', { class: 'v-meta' }, situacao),
    h('span', { class: 'v-meta mono', title: p.sha256 }, hashCurto(p.sha256)),
    p.vedado ? h('span', { class: 'v-meta erro' }, 'Indisponível para download.') :
      h('div', { class: 'v-acoes' },
        h('button', { type: 'button', class: 'v-botao tinta', onclick: () => baixarPacote(p.produto || nome, p.id, chave, msg) }, 'Baixar pacote (.zip)'),
        h('button', { type: 'button', class: 'v-link', onclick: () => abrirRelatorio(p.produto || nome, p.id, chave) }, 'Ver relatório')),
    msg)
}

/* ---------- landing ---------- */
export async function paginaVitrine(nome, cfg, { raiz = false } = {}) {
  const m = cfg.marca
  const casa = raiz ? '/' : `/${encodeURIComponent(nome)}`
  vestir(nome, cfg, casa)
  const conta = await estadoConta()
  const maxMB = Math.floor(cfg.maxBytes / 1048576)
  let tokenTurnstile = null
  const podeTela = Boolean(navigator.mediaDevices?.getDisplayMedia) && !matchMedia('(pointer: coarse)').matches

  /* ferramenta */
  const aceite = h('input', { type: 'checkbox', id: 'aceite' })
  const consentimento = h('label', { class: 'v-consent', for: 'aceite' }, aceite,
    h('span', {}, 'Autorizo guardar este arquivo num cofre privado. Só a impressão digital dele, não o arquivo, vai para um registro público. ', h('a', { href: m.baseLegal ? '#base-legal' : '#limites' }, 'O que isso prova')))
  const arquivo = h('input', { type: 'file', id: 'arquivo', hidden: true, accept: cfg.tiposMime.map((t) => (t.endsWith('/') ? t + '*' : t)).join(',') })
  const principal = h('button', { type: 'button', class: 'v-botao', onclick: () => { if (consentido()) arquivo.click() } }, m.chamada || 'Escolher arquivo')
  const barra = h('i'); const progresso = h('div', { class: 'v-progresso', hidden: true, 'aria-hidden': 'true' }, barra)
  const msg = h('p', { class: 'v-status', role: 'status', 'aria-live': 'polite' })
  const alt = podeTela ? h('p', { class: 'v-alt' }, 'Ou ', h('button', { type: 'button', class: 'v-link', onclick: () => printDaTela() }, 'tire um print desta tela'), ' · ', h('button', { type: 'button', class: 'v-link', onclick: (e) => gravarTela(e.target) }, 'grave a tela'), ` · arraste o arquivo aqui (até ${maxMB} MB)`) : h('p', { class: 'v-alt' }, `Funciona no celular: foto, print, vídeo, PDF ou texto, até ${maxMB} MB. O pacote fica com você.`)
  const ferramenta = h('div', { class: 'v-ferramenta', id: 'guardar' }, consentimento, principal, alt, progresso, msg, h('p', { class: 'v-aviso' }, cfg.aviso), arquivo)

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
        'content-type': blob.type || 'application/octet-stream', 'x-nome-arquivo': encodeURIComponent(nomeArquivo), ...(tokenTurnstile ? { 'x-turnstile': tokenTurnstile } : {}),
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
    const textoCodigo = `Identificador: ${r.id}\nCódigo de recuperação: ${codigo}\nSHA-256: ${r.sha256}\nRecebido em: ${r.recebidoEm}\n`
    const caixaCodigo = r.naConta ? h('p', {}, 'Esta prova já está na sua conta, em ', linkInterno(`/minhas-provas?p=${encodeURIComponent(nome)}`, 'Minhas provas'), '.')
      : h('div', { class: 'v-codigo' },
        h('p', {}, h('strong', {}, 'Seu código de recuperação. '), 'Ele aparece só agora e não temos como recuperá-lo.'),
        h('output', {}, codigo),
        h('div', { class: 'v-acoes' },
          h('button', { type: 'button', class: 'v-link', onclick: async (e) => { try { await navigator.clipboard.writeText(textoCodigo); e.target.textContent = 'Copiado' } catch { e.target.textContent = 'Não deu para copiar; salve o .txt' } } }, 'Copiar'),
          h('button', { type: 'button', class: 'v-link', onclick: () => baixarTexto(`codigo-${r.id}.txt`, textoCodigo) }, 'Salvar como .txt')))
    const bloco = h('div', { class: 'v-resultado' },
      h('h2', {}, 'Guardado.'),
      recibo({ id: r.id, nome: r.nome, bytes: r.bytes, sha256: r.sha256, recebidoEm: r.recebidoEm, carimbo: r.ancora === 'enviada' ? 'enviado ao OpenTimestamps; a confirmação no Bitcoin costuma levar algumas horas' : 'na fila; tentamos de novo em até 1 hora', bater: true }),
      caixaCodigo,
      h('div', { class: 'v-acoes' },
        h('button', { type: 'button', class: 'v-botao', onclick: () => baixarPacote(nome, r.id, r.naConta ? null : codigo, status) }, 'Baixar pacote (.zip)'),
        h('button', { type: 'button', class: 'v-botao tinta', onclick: () => abrirRelatorio(nome, r.id, r.naConta ? null : codigo) }, 'Ver relatório'),
        h('button', { type: 'button', class: 'v-link', onclick: () => { ferramenta.replaceChildren(...original); aceite.checked = true; msg.textContent = '' } }, 'Guardar outro arquivo')),
      status,
      !r.naConta && conta.loginDisponivel ? formLink(nome, { titulo: 'Não quer depender do código?', texto: 'Receba um acesso no seu e-mail. Esta prova fica guardada na sua conta, e você baixa o pacote quando quiser. Não guardamos o seu e-mail, só uma marca cifrada dele.', vincular: { id: r.id, chave: codigo }, rotulo: 'Guardar na minha conta', turnstile: () => tokenTurnstile }) : null)
    const original = [...ferramenta.childNodes]
    ferramenta.replaceChildren(bloco)
    ferramenta.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* recibo de exemplo (dados reais de um arquivo de exemplo, calculados aqui) */
  const exemplo = m.exemplo || { arquivo: 'conversa.png', bytes: 284312 }
  const shaExemplo = await sha256Hex(new Blob([`exemplo ${exemplo.arquivo}`]))
  const reciboExemplo = recibo({ nome: exemplo.arquivo, bytes: exemplo.bytes, sha256: shaExemplo, recebidoEm: new Date().toISOString(), carimbo: 'OpenTimestamps → Bitcoin', exemplo: true, bater: true })

  /* seções */
  const heroi = h('section', { class: 'v-heroi' },
    h('div', {}, h('p', { class: 'v-sobre' }, cfg.titulo), h('h1', { class: 'v-manchete' }, m.promessa), h('p', { class: 'v-sub' }, cfg.subtitulo), ferramenta),
    h('div', { class: 'v-lado' }, reciboExemplo,
      h('ul', { class: 'v-fatos' },
        h('li', {}, 'Cofre privado na Cloudflare, sem link público'),
        h('li', {}, 'Data carimbada no Bitcoin via OpenTimestamps'),
        h('li', {}, 'Pacote que você confere sem depender da gente'))))

  const cenas = m.cenas?.length ? h('section', { class: 'v-secao v-cenas' }, h('h2', {}, 'Quando você vai precisar'),
    h('ol', {}, m.cenas.map((c, i) => h('li', {}, h('span', { class: 'v-num' }, String(i + 1).padStart(2, '0')), h('div', {}, h('h3', {}, c.titulo), h('p', {}, c.texto)))))) : null

  const pacote = h('section', { class: 'v-pacote' },
    h('h2', {}, 'O que você leva para casa'),
    h('p', {}, 'Um pacote .zip que qualquer pessoa confere sem depender da gente, nem de que a gente continue existindo.'),
    h('dl', {},
      h('div', {}, h('dt', {}, 'seu arquivo'), h('dd', {}, 'Byte a byte, do jeito que chegou.')),
      h('div', {}, h('dt', {}, 'manifesto.json'), h('dd', {}, 'A impressão digital (SHA-256), o tamanho, o tipo e a hora em que o nosso servidor recebeu.')),
      h('div', {}, h('dt', {}, 'prova.ots'), h('dd', {}, 'O carimbo OpenTimestamps, que amarra o manifesto a um bloco do Bitcoin. Ninguém consegue reescrever essa data depois.')),
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

  // Um plano só (ex.: lançamento para testar mercado): título no singular, cartão largo e botão que leva à ferramenta.
  const unico = m.planos?.length === 1
  const planos = m.planos?.length ? h('section', { class: 'v-secao v-planos', id: 'planos' }, h('h2', {}, unico ? 'Quanto custa' : 'Planos'),
    h('div', { class: 'v-planos-grade' + (unico ? ' unico' : '') }, m.planos.map((p) => h('div', { class: 'v-plano' + (p.destaque ? ' destaque' : '') },
      h('h3', {}, p.nome), h('p', { class: 'v-preco' }, h('strong', {}, p.preco), h('span', {}, ` ${p.unidade}`)),
      h('ul', {}, p.inclui.map((x) => h('li', {}, x))),
      unico ? h('button', { type: 'button', class: 'v-botao', onclick: () => irParaFerramenta() }, m.chamada || 'Guardar agora') : null))),
    m.planosNota ? h('p', { class: 'v-planos-nota' }, m.planosNota) : null) : null

  const irParaFerramenta = () => { ferramenta.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (ferramenta.contains(aceite)) aceite.focus({ preventScroll: true }) }
  const fechamento = h('section', { class: 'v-fechamento' }, h('p', {}, m.fechamento || m.promessa), h('button', { type: 'button', class: 'v-botao', onclick: irParaFerramenta }, m.chamada || 'Guardar agora'))

  const fixa = h('div', { class: 'v-fixa', hidden: true }, h('button', { type: 'button', class: 'v-botao', onclick: irParaFerramenta }, m.chamada || 'Guardar agora'))

  app.replaceChildren(heroi, cenas, pacote, planos, como, perguntas, limites, fechamento, fixa)
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

export async function paginaEntrar(nome) {
  const cfg = await carregarMarca(nome)
  if (cfg) vestir(nome, cfg, `/${encodeURIComponent(nome)}`)
  else document.body.classList.add('vitrine')
  // O token vem no fragmento; tiramos da barra de endereço na hora (não fica no histórico nem em print de tela).
  const token = new URLSearchParams(location.hash.slice(1)).get('t')
  if (token) history.replaceState(null, '', location.pathname + location.search)
  const pagina = h('section', { class: 'v-pagina' })
  app.replaceChildren(pagina)

  if (token) {
    const msg = h('p', { class: 'v-status', role: 'status' })
    const botao = h('button', { type: 'button', class: 'v-botao', onclick: async () => {
      botao.disabled = true; msg.className = 'v-status'; msg.textContent = 'Entrando…'
      const r = await post('/pub/conta/entrar', { token })
      if (r.ok) { history.replaceState(null, '', `/minhas-provas${nome ? `?p=${encodeURIComponent(nome)}` : ''}`); return paginaMinhasProvas(nome, { vinculada: r.j.vinculada }) }
      botao.disabled = false
      msg.className = 'v-status erro'; msg.textContent = 'Este link venceu ou já foi usado. Peça outro abaixo.'
      pagina.append(h('hr', { class: 'v-separador' }), formLink(nome, { titulo: 'Receber um link novo' }))
    } }, 'Entrar')
    pagina.append(h('h1', {}, 'Entrar'), h('p', {}, 'Toque no botão para abrir sua conta neste aparelho.'), botao, msg)
    return
  }
  return paginaMinhasProvas(nome)
}

/* ---------- minhas provas ---------- */
export async function paginaMinhasProvas(nome, { vinculada = false } = {}) {
  const cfg = await carregarMarca(nome)
  if (cfg) vestir(nome, cfg, `/${encodeURIComponent(nome)}`)
  else document.body.classList.add('vitrine')
  const conta = await estadoConta()
  const pagina = h('section', { class: 'v-pagina' })
  app.replaceChildren(pagina)

  if (!conta.logado) {
    pagina.append(h('h1', {}, 'Minhas provas'))
    if (conta.loginDisponivel) pagina.append(h('p', {}, 'Entre com o seu e-mail para ver as provas guardadas na sua conta. Mandamos um link; não tem senha.'), formLink(nome))
    else pagina.append(h('p', {}, 'O acesso por e-mail ainda não está disponível. Use o identificador e o código de recuperação da sua prova.'))
    if (nome) pagina.append(h('hr', { class: 'v-separador' }), h('h2', { class: 'v-sub-titulo' }, 'Tenho o código de recuperação'), formCodigo(nome))
    return
  }

  const r = await get('/pub/conta/provas')
  const provas = r.ok ? r.j.provas : []
  const sair = h('button', { type: 'button', class: 'v-link', onclick: async () => { await post('/pub/conta/sair', {}); paginaMinhasProvas(nome) } }, 'Sair desta conta')
  pagina.append(h('h1', {}, 'Minhas provas'),
    vinculada ? h('p', {}, 'Pronto. A prova que você acabou de guardar agora está na sua conta.') : h('p', {}, provas.length ? 'Baixe o pacote de qualquer prova quando precisar.' : 'Nenhuma prova nesta conta ainda.'),
    provas.length ? h('ul', { class: 'v-lista' }, provas.map((p) => itemProva(nome, p, null))) : linkInterno(nome ? `/${encodeURIComponent(nome)}` : '/', 'Guardar a primeira prova'),
    h('p', {}, sair))
}
