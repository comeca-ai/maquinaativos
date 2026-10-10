import type { MarcaCaptura } from '@maquina/core'
import type { LinhaProva } from './captura'

/**
 * Relatório da prova: uma leitura humana de TUDO o que o cofre tem sobre ela, para imprimir ou anexar.
 * - Função pura (sem rede, sem relógio: `geradoEm` vem de fora) e HTML sem nenhum script (o CSP também proíbe).
 * - Não é a prova: o que vale é o arquivo, o manifesto.json e o prova.ots. O relatório diz isso.
 * - Não afirma o que não temos: sem assinatura ICP-Brasil e sem carimbo de tempo ICP-Brasil (nível "Lite").
 */
export type ProvaRelatorio = Pick<LinhaProva,
  'id' | 'produto' | 'origem' | 'nome_arquivo' | 'mime' | 'bytes' | 'sha256' | 'manifesto_sha256' | 'gravado_em' | 'origem_hash' |
  'ancora' | 'ancora_enviada_em' | 'ancora_calendarios' | 'ots_altura'> & { conta_id?: string | null }

export interface AcessoRelatorio { tipo: string; origem_hash: string | null; em: string }

export interface DadosRelatorio {
  marca: string
  baseLegal?: MarcaCaptura['baseLegal']
  /** Origem pública do site, ex.: https://tinhaprint.com.br */
  site: string
  geradoEm: Date
  prova: ProvaRelatorio
  /** Texto EXATO do manifesto.json (o hash é dele). */
  manifesto: string
  caso: { estado: string; motivo: string; final: number } | null
  /** Acessos em ordem cronológica (no máximo os últimos MAX_ACESSOS). */
  acessos: AcessoRelatorio[]
  totalAcessos: number
}

export const MAX_ACESSOS_RELATORIO = 200

/** Cabeçalhos da resposta HTML do relatório: nenhum script, nada externo, sem cache e sem indexação. */
export const CABECALHOS_RELATORIO: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'no-store',
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

const fmtBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const dataHoraBR = (iso: string | Date) => `${fmtBR.format(typeof iso === 'string' ? new Date(iso) : iso).replace(',', ' às')} (horário de Brasília)`
const diaBR = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d)

export function tamanhoLegivel(bytes: number): string {
  const n = new Intl.NumberFormat('pt-BR')
  if (bytes < 1024) return `${n.format(bytes)} bytes`
  const kb = bytes / 1024, mb = kb / 1024
  const curto = mb >= 1 ? `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${kb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${n.format(bytes)} bytes (${curto})`
}

const ROTULO_ESTADO: Record<string, string> = {
  aguardando_captura: 'Aguardando o arquivo',
  guardada: 'Guardada no cofre',
  ancorando: 'Guardada; âncora enviada, aguardando o Bitcoin',
  preservada: 'Preservada e ancorada no Bitcoin',
  preservada_sem_ancora: 'Preservada; âncora não confirmada no prazo',
  falhou: 'Falhou',
  recusada: 'Recusada',
}

const ROTULO_ACESSO: Record<string, string> = {
  captura: 'Arquivo recebido e guardado no cofre',
  pacote: 'Pacote baixado',
  relatorio: 'Relatório gerado',
  arquivo_equipe: 'Arquivo aberto pela equipe',
  ancora: 'Hash do manifesto enviado ao OpenTimestamps',
  confirmacao: 'Âncora confirmada num bloco do Bitcoin',
  vedado: 'Prova bloqueada pela equipe',
  carimbo_tempo: 'Carimbo de tempo recebido',
}

function quem(a: AcessoRelatorio, origemDoEnvio: string): string {
  if (a.origem_hash === 'cron') return 'sistema (automático)'
  if (a.origem_hash === 'equipe') return 'equipe'
  if (a.origem_hash && a.origem_hash === origemDoEnvio) return 'mesma origem do envio'
  return 'outra origem'
}

function textoAncora(p: ProvaRelatorio): string {
  if (p.ancora === 'confirmada' && p.ots_altura) return `Confirmada no Bitcoin, bloco nº ${p.ots_altura}.`
  if (p.ancora === 'confirmada') return 'Confirmada no Bitcoin.'
  if (p.ancora === 'enviada') {
    const quando = p.ancora_enviada_em ? ` em ${diaBR(p.ancora_enviada_em)}` : ''
    const onde = p.ancora_calendarios ? ` a ${p.ancora_calendarios} calendário${p.ancora_calendarios > 1 ? 's' : ''} públicos` : ''
    return `Enviada${quando}${onde} do OpenTimestamps. Falta a confirmação num bloco do Bitcoin, que costuma levar algumas horas. Depois dela, baixe o pacote de novo para receber o prova.ots confirmado.`
  }
  return 'Ainda não enviada. O sistema tenta de novo a cada hora.'
}

const ORIGEM: Record<string, string> = {
  navegador: 'Capturado nesta página, no aparelho de quem enviou (print ou gravação da tela feita pelo próprio navegador). O arquivo foi gerado no aparelho do usuário, não pelo nosso servidor.',
  arquivo_enviado: 'Arquivo escolhido no aparelho de quem enviou e enviado por esta página. Não sabemos como nem quando ele foi criado antes do envio.',
}

const linha = (rotulo: string, valor: string, classe = '') => `<tr><th scope="row">${esc(rotulo)}</th><td${classe ? ` class="${classe}"` : ''}>${valor}</td></tr>`

export function relatorioHtml(d: DadosRelatorio): string {
  const p = d.prova
  const recebido = dataHoraBR(p.gravado_em)
  const estado = d.caso ? `${esc(ROTULO_ESTADO[d.caso.estado] ?? d.caso.estado)} <span class="cod">(${esc(d.caso.estado)} · ${esc(d.caso.motivo)})</span>` : 'Sem registro de caso.'
  const omitidos = d.totalAcessos - d.acessos.length

  const acessos = d.acessos.map((a) =>
    `<tr><td>${esc(dataHoraBR(a.em).replace(' (horário de Brasília)', ''))}</td><td>${esc(ROTULO_ACESSO[a.tipo] ?? a.tipo)}</td><td>${esc(quem(a, p.origem_hash))}</td></tr>`).join('')

  const base = d.baseLegal ? `
<section class="quebra">
  <h2><span class="n">9</span> Base legal citada pelo serviço</h2>
  <p>${esc(d.baseLegal.intro)}</p>
  ${d.baseLegal.itens.map((i) => `
  <div class="norma">
    <h3>${esc(i.norma)}</h3>
    <blockquote>${esc(i.trecho)}</blockquote>
    <p>${esc(i.leitura)}</p>
    <p class="fonte">Fonte oficial: <a href="${esc(i.link)}">${esc(i.link)}</a></p>
  </div>`).join('')}
  <p class="ressalva">${esc(d.baseLegal.ressalva)}</p>
</section>` : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<meta name="robots" content="noindex, nofollow">
<title>Relatório de preservação ${esc(p.id)} · ${esc(d.marca)}</title>
<style>
  :root { --tinta: #161513; --papel: #fbfaf6; --linha: #d9d5ca; --suave: #5d5a53; --carimbo: #b3261e; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--papel); color: var(--tinta); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { max-width: 820px; margin: 0 auto; padding: 28px 18px 48px; }
  .dica { margin: 0 0 22px; padding: 10px 14px; border: 1px dashed var(--linha); color: var(--suave); font-size: 14px; }
  header { border-bottom: 3px solid var(--tinta); padding-bottom: 14px; margin-bottom: 22px; }
  .marca { margin: 0; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; font-size: 13px; color: var(--carimbo); }
  h1 { margin: 4px 0 6px; font-size: 28px; line-height: 1.15; }
  .sub { margin: 0; color: var(--suave); }
  h2 { font-size: 18px; margin: 30px 0 10px; padding-top: 10px; border-top: 1px solid var(--linha); }
  h2 .n { display: inline-block; min-width: 1.6em; color: var(--carimbo); }
  h3 { font-size: 15px; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid var(--linha); }
  th[scope="row"] { width: 34%; font-weight: 600; color: var(--suave); }
  thead th { font-size: 13px; color: var(--suave); border-bottom: 2px solid var(--tinta); }
  tr { break-inside: avoid; }
  .resumo { border: 2px solid var(--tinta); padding: 4px 14px 10px; }
  .resumo th[scope="row"] { width: 30%; }
  .hash, pre, .cod { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
  .hash { word-break: break-all; font-size: 13.5px; }
  .cod { color: var(--suave); font-size: 12.5px; }
  pre { white-space: pre-wrap; word-break: break-all; background: #f1efe8; border: 1px solid var(--linha); padding: 12px; font-size: 12.5px; }
  .aviso { border-left: 4px solid var(--carimbo); padding: 8px 14px; background: #f6efe9; }
  ul, ol { padding-left: 22px; }
  li { margin: 4px 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; background: #f1efe8; padding: 1px 4px; word-break: break-all; }
  blockquote { margin: 6px 0; padding: 6px 14px; border-left: 3px solid var(--linha); font-style: italic; }
  .norma { break-inside: avoid; }
  .fonte, .ressalva, footer { color: var(--suave); font-size: 13.5px; }
  .fonte a { word-break: break-all; color: inherit; }
  footer { margin-top: 34px; padding-top: 12px; border-top: 3px solid var(--tinta); }
  @media (max-width: 560px) {
    main { padding-top: 18px; }
    h1 { font-size: 25px; }
    table.ficha tr { display: block; padding: 8px 0; border-bottom: 1px solid var(--linha); }
    table.ficha th[scope="row"], table.ficha td { display: block; width: auto; padding: 0; border: 0; }
    table.ficha th[scope="row"] { font-size: 13px; margin-bottom: 2px; }
    .resumo { padding: 0 12px; }
    .resumo table.ficha tr:last-child { border-bottom: 0; }
  }
  @page { size: A4; margin: 16mm 14mm; }
  @media print {
    body { background: #fff; font-size: 11pt; }
    main { max-width: none; padding: 0; }
    .dica { display: none; }
    .quebra { break-before: page; }
    h2 { break-after: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<main>
<p class="dica">Para salvar em PDF: use Imprimir no navegador e escolha "Salvar como PDF".</p>

<header>
  <p class="marca">${esc(d.marca)}</p>
  <h1>Relatório de preservação</h1>
  <p class="sub">Registro técnico do recebimento, da guarda e da âncora pública de um arquivo.</p>
</header>

<div class="resumo">
<table class="ficha">
${linha('Arquivo', esc(p.nome_arquivo))}
${linha('Tamanho', esc(tamanhoLegivel(p.bytes)))}
${linha('Recebido em', esc(recebido))}
${linha('SHA-256 do arquivo', esc(p.sha256), 'hash')}
${linha('Âncora no Bitcoin', esc(textoAncora(p)))}
${linha('Situação', estado)}
${linha('Identificador', esc(p.id), 'hash')}
</table>
</div>

<section>
  <h2><span class="n">1</span> O arquivo</h2>
  <table class="ficha">
  ${linha('Nome, como veio do aparelho', esc(p.nome_arquivo))}
  ${linha('Tipo', esc(p.mime))}
  ${linha('Tamanho', esc(tamanhoLegivel(p.bytes)))}
  ${linha('SHA-256', esc(p.sha256), 'hash')}
  ${linha('Como chegou', esc(ORIGEM[p.origem] ?? p.origem))}
  </table>
  <p>O SHA-256 é a "impressão digital" do arquivo: se um único byte mudar, o número muda por completo. O arquivo fica guardado byte a byte num cofre privado, e o sistema não tem nenhuma função que sobrescreva ou apague o arquivo.</p>
</section>

<section>
  <h2><span class="n">2</span> Recebimento</h2>
  <table class="ficha">
  ${linha('Data e hora', esc(recebido))}
  ${linha('Data e hora (UTC)', esc(p.gravado_em), 'hash')}
  ${linha('Relógio', 'Do nosso servidor (Cloudflare), não do aparelho de quem enviou.')}
  ${linha('Consentimento', 'Sim. O envio só é aceito com a declaração de consentimento marcada; sem ela, nada é guardado.')}
  ${linha('Conta', p.conta_id ? 'Vinculada a uma conta por e-mail. O e-mail não é guardado em texto, só um código cifrado dele.' : 'Não vinculada a conta. O acesso é pelo código de recuperação, entregue só a quem enviou.')}
  ${linha('Produto', `${esc(d.marca)} <span class="cod">(${esc(p.produto)})</span>`)}
  </table>
</section>

<section>
  <h2><span class="n">3</span> Manifesto</h2>
  <p>No recebimento, o sistema escreve o manifesto: um registro com o hash do arquivo, o tamanho, o tipo e a data e hora do servidor. É o manifesto que vai para a âncora no Bitcoin. Como ele contém o hash do arquivo, ancorar o manifesto ancora o arquivo.</p>
  <table class="ficha">${linha('SHA-256 do manifesto.json', esc(p.manifesto_sha256), 'hash')}</table>
  <pre>${esc(d.manifesto)}</pre>
  <p class="fonte">O hash é do texto exato do arquivo manifesto.json do pacote, não desta exibição.</p>
</section>

<section>
  <h2><span class="n">4</span> Âncora pública no Bitcoin (OpenTimestamps)</h2>
  <p class="aviso">${esc(textoAncora(p))}</p>
  <p>O hash do manifesto é enviado aos calendários públicos do OpenTimestamps, que o gravam num bloco do Bitcoin. Depois disso, ninguém consegue alterar esse registro, nem nós. A âncora mostra que o manifesto, e portanto o arquivo, já existia na data do bloco. Qualquer pessoa confere isso sem depender da nossa empresa.</p>
</section>

<section>
  <h2><span class="n">5</span> Cadeia de custódia</h2>
  <p>Todo acesso a esta prova fica registrado. O registro só aceita inclusões: o banco de dados recusa alterar ou apagar linhas.</p>
  <table>
  <thead><tr><th>Data e hora (Brasília)</th><th>Evento</th><th>Quem</th></tr></thead>
  <tbody>${acessos || '<tr><td colspan="3">Nenhum acesso registrado.</td></tr>'}</tbody>
  </table>
  ${omitidos > 0 ? `<p class="fonte">Mostrando os ${d.acessos.length} acessos mais recentes de ${d.totalAcessos}.</p>` : ''}
  <p class="fonte">"Origem" é um código calculado a partir do endereço de rede de quem acessou. O endereço IP em si não é guardado.</p>
</section>

<section>
  <h2><span class="n">6</span> O que guardamos sobre quem enviou</h2>
  <ul>
    <li>O nome do arquivo, como veio do aparelho.</li>
    <li>O código de origem (calculado a partir do endereço de rede, sem guardar o IP), usado para limitar abuso e montar a cadeia de custódia.</li>
    ${p.conta_id ? '<li>O vínculo com uma conta por e-mail, guardado só como código cifrado do e-mail.</li>' : ''}
  </ul>
  <p>No cofre e no banco de dados <strong>não guardamos</strong> IP, nome, CPF, telefone, e-mail em texto, localização nem dados do aparelho.</p>
</section>

<section>
  <h2><span class="n">7</span> Como conferir sem depender de nós</h2>
  <p>Os arquivos citados estão no pacote (.zip) desta prova.</p>
  <ol>
    <li>Calcule o SHA-256 do arquivo. No Windows: <code>certutil -hashfile "ARQUIVO" SHA256</code>. No Mac: <code>shasum -a 256 "ARQUIVO"</code>. No Linux: <code>sha256sum "ARQUIVO"</code>. O resultado deve ser <code>${esc(p.sha256)}</code>.</li>
    <li>Faça o mesmo com o <code>manifesto.json</code>. O resultado deve ser <code>${esc(p.manifesto_sha256)}</code>.</li>
    <li>Confira a âncora: em <a href="https://opentimestamps.org">opentimestamps.org</a>, solte o <code>prova.ots</code> e o <code>manifesto.json</code>. Ou use o cliente oficial: <code>ots verify prova.ots</code>.</li>
  </ol>
</section>

<section>
  <h2><span class="n">8</span> O que este relatório prova e o que não prova</h2>
  <p><strong>Prova</strong> que este arquivo, com este SHA-256, foi recebido e guardado na data e hora acima e não foi alterado desde então. Com a âncora confirmada, prova também que ele já existia na data do bloco do Bitcoin.</p>
  <p><strong>Não prova</strong> que o conteúdo é verdadeiro, que retrata fielmente o original nem quem é o autor. Também não garante que será aceito no processo: isso é decisão do juiz.</p>
  <p class="aviso"><strong>Sem certificação ICP-Brasil.</strong> Este relatório não tem assinatura digital ICP-Brasil nem carimbo de tempo ICP-Brasil. A data vem do relógio do nosso servidor e da âncora pública no Bitcoin, que qualquer pessoa confere. Quando o caso exigir fé pública, procure um cartório de notas (ata notarial) e leve o pacote junto.</p>
</section>
${base}
<footer>
  <p>Relatório gerado em ${esc(dataHoraBR(d.geradoEm))} por ${esc(d.marca)} (${esc(d.site)}).</p>
  <p>Este relatório é uma leitura dos registros do cofre no momento em que foi gerado. Os dados que valem são os do arquivo, do manifesto.json e do prova.ots.</p>
</footer>
</main>
</body>
</html>
`
}
