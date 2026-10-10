import { describe, it, expect } from 'vitest'
import { relatorioHtml, dataHoraBR, tamanhoLegivel, CABECALHOS_RELATORIO, type DadosRelatorio } from '../apps/runtime/src/relatorio'

const base = (extra: Partial<DadosRelatorio> = {}): DadosRelatorio => ({
  marca: 'Tinha Print',
  site: 'https://tinhaprint.com.br',
  geradoEm: new Date('2026-10-10T22:30:00Z'),
  prova: {
    id: '7d3c2b1a-0000-4000-8000-000000000001', produto: 'prova-digital', origem: 'arquivo_enviado',
    nome_arquivo: 'conversa.png', mime: 'image/png', bytes: 284312,
    sha256: 'a'.repeat(64), manifesto_sha256: 'b'.repeat(64), gravado_em: '2026-10-10T22:13:05.123Z', origem_hash: 'o1',
    ancora: 'enviada', ancora_enviada_em: '2026-10-10', ancora_calendarios: 3, ots_altura: null, conta_id: null,
  },
  manifesto: '{"arquivo":{"bytes":284312}}',
  caso: { estado: 'ancorando', motivo: 'ancora_enviada', final: 0 },
  acessos: [
    { tipo: 'captura', origem_hash: 'o1', em: '2026-10-10T22:13:05.200Z' },
    { tipo: 'ancora', origem_hash: 'cron', em: '2026-10-10T23:17:00Z' },
    { tipo: 'pacote', origem_hash: 'o2', em: '2026-10-11T10:00:00Z' },
    { tipo: 'arquivo_equipe', origem_hash: 'equipe', em: '2026-10-11T11:00:00Z' },
  ],
  totalAcessos: 4,
  ...extra,
})

describe('relatório da prova', () => {
  it('traz os fatos centrais: arquivo, hashes, hora de Brasília, âncora e situação', () => {
    const h = relatorioHtml(base())
    expect(h).toContain('conversa.png')
    expect(h).toContain('a'.repeat(64))
    expect(h).toContain('b'.repeat(64))
    expect(h).toContain('10/10/2026 às 19:13:05 (horário de Brasília)')
    expect(h).toContain('2026-10-10T22:13:05.123Z')
    expect(h).toContain('3 calendários públicos do OpenTimestamps')
    expect(h).toContain('Guardada; âncora enviada, aguardando o Bitcoin')
  })

  it('diz com todas as letras que não há ICP-Brasil e o que NÃO prova', () => {
    const h = relatorioHtml(base())
    expect(h).toMatch(/não tem assinatura digital ICP-Brasil nem carimbo de tempo ICP-Brasil/)
    expect(h).toMatch(/Não prova<\/strong> que o conteúdo é verdadeiro/)
  })

  it('cadeia de custódia: distingue a origem do envio, outra origem, sistema e equipe, sem mostrar o código', () => {
    const h = relatorioHtml(base())
    expect(h).toContain('mesma origem do envio')
    expect(h).toContain('outra origem')
    expect(h).toContain('sistema (automático)')
    expect(h).toContain('Arquivo aberto pela equipe')
    expect(h).not.toContain('>o1<')
  })

  it('âncora confirmada mostra o bloco', () => {
    const h = relatorioHtml(base({ prova: { ...base().prova, ancora: 'confirmada', ots_altura: 918273 } }))
    expect(h).toContain('Confirmada no Bitcoin, bloco nº 918273.')
  })

  it('escapa tudo o que vem do usuário (nome do arquivo) e não tem nenhum script', () => {
    const h = relatorioHtml(base({ prova: { ...base().prova, nome_arquivo: '<img src=x onerror=alert(1)>.png' } }))
    expect(h).not.toContain('<img src=x')
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;.png')
    expect(h).not.toMatch(/<script/i)
    expect(CABECALHOS_RELATORIO['content-security-policy']).toMatch(/default-src 'none'/)
  })

  it('base legal da marca entra com trecho, link e ressalva', () => {
    const h = relatorioHtml(base({ baseLegal: { intro: 'Intro.', itens: [{ norma: 'CPC, art. 369', trecho: 'As partes têm o direito…', link: 'https://www.planalto.gov.br/x', leitura: 'Leitura.' }], ressalva: 'Ressalva.' } }))
    expect(h).toContain('CPC, art. 369')
    expect(h).toContain('https://www.planalto.gov.br/x')
    expect(h).toContain('Ressalva.')
  })

  it('avisa quando a lista de acessos foi cortada', () => {
    const h = relatorioHtml(base({ totalAcessos: 250 }))
    expect(h).toContain('Mostrando os 4 acessos mais recentes de 250.')
  })

  it('formatos auxiliares', () => {
    expect(dataHoraBR('2026-01-01T03:00:00Z')).toBe('01/01/2026 às 00:00:00 (horário de Brasília)')
    expect(tamanhoLegivel(512)).toBe('512 bytes')
    expect(tamanhoLegivel(284312)).toBe('284.312 bytes (277,6 KB)')
    expect(tamanhoLegivel(95 * 1024 * 1024)).toBe('99.614.720 bytes (95 MB)')
  })
})
