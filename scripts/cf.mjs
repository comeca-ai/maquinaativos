// CLI do kit Cloudflare. Requer CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no ambiente.
// Uso: pnpm cf verificar | d1:listar | r2:listar | r2:criar <nome> | kv:listar | workers:listar | d1:sql <nome-do-banco> "<SQL>" | ai <modelo> "<texto>"
import { cloudflare, configDoAmbiente } from '../packages/kits/src/cloudflare.ts'

const [cmd, a, b] = process.argv.slice(2)
const cf = cloudflare(configDoAmbiente(process.env))
const mostra = (x) => console.log(JSON.stringify(x, null, 2))

try {
  if (cmd === 'verificar') mostra(await cf.verificarToken())
  else if (cmd === 'd1:listar') mostra((await cf.d1.listar()).map((d) => ({ nome: d.name, id: d.uuid })))
  else if (cmd === 'r2:listar') mostra(await cf.r2.listarBuckets())
  else if (cmd === 'r2:criar') mostra(await cf.r2.criarBucket(a))
  else if (cmd === 'kv:listar') mostra(await cf.kv.listarNamespaces())
  else if (cmd === 'workers:listar') mostra((await cf.workers.listar()).map((w) => w.id))
  else if (cmd === 'd1:sql') {
    const db = (await cf.d1.listar()).find((d) => d.name === a)
    if (!db) throw new Error(`banco não encontrado: ${a}`)
    mostra(await cf.d1.consultar(db.uuid, b))
  } else if (cmd === 'ai') mostra(await cf.ai.rodar(a, { prompt: b }))
  else console.log('comandos: verificar | d1:listar | r2:listar | r2:criar <nome> | kv:listar | workers:listar | d1:sql <banco> "<SQL>" | ai <modelo> "<texto>"')
} catch (e) {
  console.error(String(e.message ?? e))
  process.exit(1)
}
