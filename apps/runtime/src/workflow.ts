import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { executar } from '@maquina/core'
import { produtos } from './registro.gerado'
import type { Env, ParamsCaso } from './env'

/**
 * O Workflow é genérico: roda QUALQUER produto registrado. Sem IA aqui.
 * Passos: ler estado -> regra pura -> gravar transição (atômico) -> efeitos idempotentes.
 */
export class CasoWorkflow extends WorkflowEntrypoint<Env, ParamsCaso> {
  async run(event: WorkflowEvent<ParamsCaso>, step: WorkflowStep) {
    const { casoId, produto, entrada, hoje } = event.payload
    const p = produtos[produto]
    if (!p) throw new NonRetryableError(`produto desconhecido: ${produto}`)

    const de = await step.do('ler-estado', async () => {
      const r = await this.env.DB.prepare('SELECT estado FROM casos WHERE id = ?').bind(casoId).first<{ estado: string }>()
      if (!r) throw new NonRetryableError(`caso inexistente: ${casoId}`)
      return r.estado
    })

    const t = await step.do('regra-pura', async () => {
      const r = await executar(p, entrada, { hoje }, de)
      if (!r.ok) throw new NonRetryableError(`entrada inválida: ${r.detalhes.join('; ')}`)
      return r.transicao
    })

    await step.do('gravar-transicao', async () => {
      const agora = new Date().toISOString()
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO transicoes (caso_id, produto, versao, de, para, motivo, hash_entrada, hoje, em)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
           WHERE NOT EXISTS (SELECT 1 FROM transicoes WHERE caso_id = ?1 AND para = ?5 AND hash_entrada = ?7 AND hoje = ?8)`,
        ).bind(casoId, t.produto, t.versao, t.de, t.para, t.motivo, t.hashEntrada, t.hoje, agora),
        this.env.DB.prepare(
          'UPDATE casos SET versao = ?2, estado = ?3, motivo = ?4, final = ?5, prazo_ate = ?6, atualizado_em = ?7 WHERE id = ?1',
        ).bind(casoId, t.versao, t.para, t.motivo, t.final ? 1 : 0, t.prazoAte, agora),
      ])
    })

    for (const ef of p.efeitos?.[t.para] ?? []) {
      const chave = `${casoId}:${t.para}:${ef.nome}`
      await step.do(`efeito:${ef.nome}`, { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } }, async () => {
        const ja = await this.env.DB.prepare('SELECT 1 AS x FROM efeitos_feitos WHERE chave = ?').bind(chave).first()
        if (ja) return 'ja_feito'
        await ef.executar({ chave, casoId, produto: t.produto, versao: t.versao, veredito: { estado: t.para, motivo: t.motivo } })
        await this.env.DB.prepare('INSERT OR IGNORE INTO efeitos_feitos (chave, em) VALUES (?, ?)').bind(chave, new Date().toISOString()).run()
        return 'feito'
      })
    }

    return { casoId, estado: t.para, motivo: t.motivo }
  }
}
