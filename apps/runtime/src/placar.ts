import { produtos } from './registro.gerado'
import type { Env } from './env'

/**
 * PLACAR DE CAIXA — um número-vida por máquina, apurado por cron diário.
 *
 * Regras (torito/07-placar):
 * - UM número por máquina: dinheiro ou resposta entregue. Pageview e cadastro são vaidade.
 * - Produto registrado SEM número declarado aparece em `sem_numero_vida` — pendência visível,
 *   nunca silenciosa. Máquina nova no ar sem entrada aqui é dívida declarada na ficha.
 * - 30 dias de zero = observação; 90 dias de zero = o funil decide (motivo sem_pagador_producao).
 */

type Apuracao = { metrica: string; origem: string; sql: string }

/** O número-vida de cada máquina no ar. Funil é produto interno (mede ideias, não clientes): fica fora. */
const NUMERO_VIDA: Record<string, Apuracao> = {
  'prova-digital': {
    metrica: 'provas_guardadas',
    origem: 'provas.gravado_em_dia',
    sql: "SELECT COUNT(*) AS n FROM provas WHERE produto = 'prova-digital' AND gravado_em_dia = ?",
  },
}

/** Dia de hoje em America/Sao_Paulo, AAAA-MM-DD (mesmo padrão das demais tabelas). */
function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function semNumeroVida(): string[] {
  return Object.keys(produtos).filter((nome) => !(nome in NUMERO_VIDA))
}

/** Apura o dia (padrão: hoje) e grava em `metricas`. Idempotente: mesma chave, mesma linha. */
export async function apurarPlacar(env: Env, dia = hojeSP()) {
  const gravadas: { produto: string; metrica: string; valor: number }[] = []
  for (const [produto, a] of Object.entries(NUMERO_VIDA)) {
    const row = await env.DB.prepare(a.sql).bind(dia).first<{ n: number }>()
    const valor = row?.n ?? 0
    await env.DB.prepare(
      `INSERT INTO metricas (produto, dia, metrica, valor, origem) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (produto, dia, metrica) DO UPDATE SET valor = excluded.valor, origem = excluded.origem`,
    )
      .bind(produto, dia, a.metrica, valor, a.origem)
      .run()
    gravadas.push({ produto, metrica: a.metrica, valor })
  }
  return { dia, gravadas, sem_numero_vida: semNumeroVida() }
}

/** Últimos 30 dias por produto + máquinas sem número declarado. Leitura de 10 segundos. */
export async function lerPlacar(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT produto, dia, metrica, valor, origem FROM metricas
     WHERE dia >= date('now', '-30 days') ORDER BY produto, dia DESC`,
  ).all()
  return { janela: '30d', metricas: results, sem_numero_vida: semNumeroVida() }
}
