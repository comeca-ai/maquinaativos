import { z } from 'zod'
import { defineProduto, MAX_BYTES_CAPTURA } from '@maquina/core'
import { regra, prazoDe, PRAZO_CAPTURA_DIAS, PRAZO_GUARDADA_DIAS, PRAZO_ANCORA_DIAS, type EntradaProva, type EstadoProva, type MotivoProva } from './rule'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 em hexadecimal minúsculo (64 caracteres)')

export const provaDigital = defineProduto<EstadoProva, MotivoProva, EntradaProva>({
  nome: 'prova-digital',
  versao: 'v1',
  entrada: z
    .object({
      solicitadoEm: data,
      consentimento: z.boolean(),
      conteudoVedado: z.boolean(),
      capturasUltimas24h: z.number().int().min(0),
      arquivoSha256: sha256.nullable(),
      hashConferido: z.boolean(),
      gravadoNoCofre: z.boolean(),
      manifestoGravado: z.boolean(),
      gravadoEm: data.nullable(),
      ancora: z.enum(['nao_enviada', 'enviada', 'confirmada']),
      ancoraEnviadaEm: data.nullable(),
    })
    .superRefine((v, ctx) => {
      const erro = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.arquivoSha256 === null && (v.gravadoNoCofre || v.manifestoGravado)) erro('arquivoSha256', 'sem arquivo recebido não pode haver gravação no cofre')
      if (v.gravadoNoCofre !== (v.gravadoEm !== null)) erro('gravadoEm', 'gravadoEm deve existir se, e somente se, gravadoNoCofre = true')
      if (v.gravadoEm !== null && v.gravadoEm < v.solicitadoEm) erro('gravadoEm', 'gravadoEm não pode ser anterior a solicitadoEm')
      if (v.ancora === 'nao_enviada' && v.ancoraEnviadaEm !== null) erro('ancoraEnviadaEm', 'sem âncora enviada não há data de envio')
      if (v.ancora !== 'nao_enviada') {
        if (v.ancoraEnviadaEm === null) erro('ancoraEnviadaEm', 'ancoraEnviadaEm é obrigatório quando a âncora foi enviada')
        if (!v.gravadoNoCofre || !v.manifestoGravado) erro('ancora', 'não se ancora o que ainda não está gravado no cofre com manifesto')
        if (v.ancoraEnviadaEm !== null && v.gravadoEm !== null && v.ancoraEnviadaEm < v.gravadoEm) erro('ancoraEnviadaEm', 'âncora não pode ser enviada antes da gravação')
      }
    }),
  estados: {
    aguardando_captura: { final: false, prazoDias: PRAZO_CAPTURA_DIAS },
    guardada: { final: false, prazoDias: PRAZO_GUARDADA_DIAS },
    ancorando: { final: false, prazoDias: PRAZO_ANCORA_DIAS },
    preservada: { final: true },
    preservada_sem_ancora: { final: true },
    falhou: { final: true },
    recusada: { final: true },
  },
  estadoInicial: 'aguardando_captura',
  motivos: {
    sem_arquivo: 'aguardando_captura',
    gravacao_pendente: 'aguardando_captura',
    guardada_sem_ancora: 'guardada',
    ancora_enviada: 'ancorando',
    ancora_confirmada: 'preservada',
    ancora_nao_enviada_no_prazo: 'preservada_sem_ancora',
    ancora_nao_confirmada_no_prazo: 'preservada_sem_ancora',
    captura_vencida: 'falhou',
    hash_divergente: 'falhou',
    gravacao_incompleta_vencida: 'falhou',
    sem_consentimento: 'recusada',
    conteudo_vedado: 'recusada',
    abuso_por_volume: 'recusada',
  },
  regra,
  prazoAte: prazoDe,
  captura: {
    titulo: 'Preserve uma prova digital',
    subtitulo: 'Tire o print, grave a tela ou envie o arquivo. Trancamos num cofre privado e carimbamos a data no Bitcoin.',
    marca: {
      nome: 'Tinha Print',
      destaque: 'Print',
      promessa: 'Guarde a prova antes que apaguem.',
      chamada: 'Enviar meu print',
      fechamento: 'Apagaram? Você tinha print.',
      exemplo: { arquivo: 'conversa.png', bytes: 284312 },
      cenas: [
        { titulo: 'A conversa que o outro apagou', texto: 'Mensagem, áudio ou ameaça que sumiu do aplicativo depois que você mostrou que ia usar.' },
        { titulo: 'O anúncio que saiu do ar', texto: 'A oferta, o preço ou a promessa que estava na página e depois mudou ou desapareceu.' },
        { titulo: 'O post que foi editado', texto: 'A publicação ou o comentário que ganhou outra redação quando o problema apareceu.' },
        { titulo: 'O perfil que mudou de nome', texto: 'A conta que trocou de nome, foto ou sumiu logo depois do ocorrido.' },
      ],
      passos: [
        { titulo: 'Capture', texto: 'Marque o consentimento e escolha: print da tela, gravação da tela ou um arquivo que você já tem.' },
        { titulo: 'Cofre', texto: 'Calculamos a impressão digital (SHA-256) no seu navegador e o servidor confere. O arquivo vai para um cofre privado, sem link público.' },
        { titulo: 'Carimbo e pacote', texto: 'A impressão digital é registrada em calendários OpenTimestamps, que ancoram no Bitcoin (costuma levar algumas horas). Você recebe um código (mostrado uma única vez), um relatório para imprimir ou anexar e um pacote .zip que qualquer pessoa confere sem depender da gente.' },
      ],
      perguntas: [
        { pergunta: 'Isso vale como prova na Justiça?', resposta: 'Não prometemos isso. O carimbo mostra que o arquivo existia nesta data e não mudou depois. Quem decide se serve como prova é o juiz, caso a caso. Para um fato importante, considere também uma ata notarial. A base legal, com o texto da lei, está mais abaixo.' },
        { pergunta: 'Quem vê o meu arquivo?', resposta: 'Ninguém por link. Só quem tem o identificador e o código de recuperação baixa o pacote. A operação pode abrir um arquivo para tratar uma denúncia, e cada abertura fica registrada num log que não pode ser apagado.' },
        { pergunta: 'Vocês guardam o meu IP?', resposta: 'Não. Guardamos só uma marca irreversível dele, para limitar abuso.' },
        { pergunta: 'E se eu perder o código?', resposta: 'Não conseguimos recuperar. Guardamos apenas o hash dele. Salve o código assim que aparecer.' },
        { pergunta: 'Funciona no celular?', resposta: 'Print e gravação da tela direto do navegador dependem do computador. No celular, envie o arquivo (o print que você já tirou). O carimbo é o mesmo, mas não conseguimos atestar como o arquivo foi gerado.' },
      ],
      // Lançamento para testar mercado (decisão do dono, 10/10/2026): só o nível Lite, grátis. Caso e Escritório
      // voltam quando houver login por e-mail ligado e pagamento. Preços planejados: OFERTA.md.
      planos: [
        { nome: 'Lite', preco: 'Grátis', unidade: 'no lançamento', destaque: true, inclui: ['Print, gravação da tela ou arquivo até 95 MB', 'Cofre privado e carimbo da data no Bitcoin', 'Relatório para imprimir ou anexar', 'Pacote .zip que qualquer pessoa confere', 'Cópia no cofre por 5 anos', 'Sem certificação ICP-Brasil'] },
      ],
      planosNota: 'Estamos em lançamento: guardar é grátis, até 50 provas por dia. Se um dia passarmos a cobrar, quem guardou antes não perde o que guardou.',
      baseLegal: {
        intro: 'O que a lei diz, com o texto e o link oficial, e o que o carimbo prova. Sem exagero.',
        itens: [
          { norma: 'Código de Processo Civil, art. 369', link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm#art369', trecho: 'As partes têm o direito de empregar todos os meios legais, bem como os moralmente legítimos, ainda que não especificados neste Código, para provar a verdade dos fatos em que se funda o pedido ou a defesa e influir eficazmente na convicção do juiz.', leitura: 'A lei não lista todos os meios de prova. Um print guardado com data e integridade pode ser usado; quem avalia o peso dele é o juiz.' },
          { norma: 'Código de Processo Civil, art. 422, § 1º', link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm#art422', trecho: 'As fotografias digitais e as extraídas da rede mundial de computadores fazem prova das imagens que reproduzem, devendo, se impugnadas, ser apresentada a respectiva autenticação eletrônica ou, não sendo possível, realizada perícia.', leitura: 'Se a outra parte contestar o print, será preciso mostrar a autenticação eletrônica ou fazer perícia. O pacote (impressão digital, hora do nosso servidor e carimbo no Bitcoin) é o material que esse exame confere.' },
          { norma: 'Código de Processo Civil, art. 384, parágrafo único', link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm#art384', trecho: 'Dados representados por imagem ou som gravados em arquivos eletrônicos poderão constar da ata notarial.', leitura: 'Quando o caso pedir fé pública, o caminho é a ata notarial em cartório. Leve o pacote junto.' },
          { norma: 'Medida Provisória 2.200-2/2001, art. 10, § 2º', link: 'https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm', trecho: 'O disposto nesta Medida Provisória não obsta a utilização de outro meio de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil, desde que admitido pelas partes como válido ou aceito pela pessoa a quem for oposto o documento.', leitura: 'Nosso carimbo não é ICP-Brasil e não tem a presunção legal dos certificados ICP. Ele vale como outro meio de comprovar integridade e data, e depende de ser aceito no caso.' },
        ],
        ressalva: 'Não encontramos lei nem decisão em fonte oficial que trate especificamente de carimbo em blockchain como prova. Por isso não dizemos que ele é aceito. Isto não é aconselhamento jurídico: num caso concreto, fale com um advogado. Textos conferidos no site do Planalto em 10/10/2026.',
      },
      limites: [
        'Não provamos que o conteúdo é verdadeiro, só que este arquivo existia e não mudou.',
        'Não substituímos ata notarial nem garantimos aceitação judicial.',
        'Não acessamos páginas por você: você mostra a tela ou envia o arquivo.',
        'Sem certificação ICP-Brasil: o relatório não tem assinatura digital nem carimbo de tempo ICP-Brasil.',
        'Não aceitamos conteúdo íntimo, de menores ou que você não tem direito de guardar.',
      ],
    },
    aviso:
      'O carimbo (OpenTimestamps, ancorado no Bitcoin) mostra que este arquivo existia nesta data e não foi alterado desde então. Não prova que o conteúdo é verdadeiro, não garante que será aceito como prova (quem decide é o juiz) e não substitui ata notarial. Não capture conteúdo íntimo, de menores, nem o que você não tem direito de guardar.',
    tiposMime: ['image/', 'video/', 'application/pdf', 'text/plain'],
    maxBytes: MAX_BYTES_CAPTURA,
    montarEntrada: (f) => f,
  },
  criterioDeMorte: { prazoDias: 14, metrica: 'conversas_reais', minimo: 10 },
  naoFaremos: [
    'Não afirma validade jurídica: a admissibilidade é decisão do juiz. Entrega integridade e data, não sentença.',
    'Não substitui ata notarial.',
    'Não prova que o conteúdo é verdadeiro: prova que ESTE arquivo existia nesta data, sem alteração desde então.',
    'Nenhuma IA toca no arquivo capturado nem decide o estado.',
    'Não captura sem consentimento, nem conteúdo íntimo ou de menores.',
    'Não guarda IP nem user-agent sem consentimento explícito.',
    'Não apaga nem sobrescreve provas: o Worker de escrita não tem caminho de delete; leitura de arquivo vai para log append-only.',
    'Não captura URL no servidor na v1 (Browser Rendering).',
  ],
})

export default provaDigital
