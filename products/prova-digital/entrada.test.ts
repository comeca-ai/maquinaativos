import { describe, it, expect } from 'vitest'
import { validarEntrada, executar } from '@maquina/core'
import produto from './index'

const H = 'b'.repeat(64)
const ok = {
  solicitadoEm: '2026-03-02', consentimento: true, conteudoVedado: false, capturasUltimas24h: 0,
  arquivoSha256: H, hashConferido: true, gravadoNoCofre: true, manifestoGravado: true, gravadoEm: '2026-03-02',
  ancora: 'nao_enviada', ancoraEnviadaEm: null,
}
const invalida = (o: object) => expect(validarEntrada(produto, { ...ok, ...o }).ok).toBe(false)

describe('prova-digital: entradas contraditórias são recusadas na porta', () => {
  it('aceita a entrada coerente', () => expect(validarEntrada(produto, ok).ok).toBe(true))
  it('âncora enviada sem gravação', () => invalida({ gravadoNoCofre: false, gravadoEm: null, ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }))
  it('âncora confirmada sem arquivo', () => invalida({ arquivoSha256: null, gravadoNoCofre: false, manifestoGravado: false, gravadoEm: null, ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02' }))
  it('gravado no cofre sem arquivo recebido', () => invalida({ arquivoSha256: null }))
  it('gravadoEm sem gravadoNoCofre', () => invalida({ gravadoNoCofre: false }))
  it('âncora sem manifesto', () => invalida({ manifestoGravado: false, ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }))
  it('âncora enviada antes da gravação', () => invalida({ gravadoEm: '2026-03-03', ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }))
  it('data de envio sem âncora enviada', () => invalida({ ancoraEnviadaEm: '2026-03-02' }))
  it('gravado antes de solicitado', () => invalida({ gravadoEm: '2026-03-01' }))
  it('hash que não é SHA-256 hex', () => invalida({ arquivoSha256: 'abc' }))
})

describe('prova-digital: prazoAte oficial vem das datas de fato', () => {
  const prazo = async (e: object, hoje: string) => { const r = await executar(produto, { ...ok, ...e }, { hoje }); return r.ok ? { estado: r.veredito.estado, prazoAte: r.transicao.prazoAte } : null }
  it('guardada: gravadoEm + 2 dias, não hoje + 2', async () => {
    expect(await prazo({}, '2026-03-04')).toEqual({ estado: 'guardada', prazoAte: '2026-03-04' })
  })
  it('ancorando: ancoraEnviadaEm + 3 dias', async () => {
    expect(await prazo({ ancora: 'enviada', ancoraEnviadaEm: '2026-03-02' }, '2026-03-04')).toEqual({ estado: 'ancorando', prazoAte: '2026-03-05' })
  })
  it('aguardando_captura: solicitadoEm + 3 dias', async () => {
    expect(await prazo({ arquivoSha256: null, gravadoNoCofre: false, manifestoGravado: false, gravadoEm: null }, '2026-03-03')).toEqual({ estado: 'aguardando_captura', prazoAte: '2026-03-05' })
  })
  it('estado final não tem prazo', async () => {
    expect(await prazo({ ancora: 'confirmada', ancoraEnviadaEm: '2026-03-02' }, '2026-03-03')).toEqual({ estado: 'preservada', prazoAte: null })
  })
})
