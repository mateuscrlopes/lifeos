import { config } from '../config.js';
import { autenticarDispositivo } from './autenticacao.js';
import { interpretarComando } from './interpretador.js';
import { executarAcao } from './acoes.js';

const VERSION = '0.1.0';
const janelas = new Map();

function permitirRequisicao(dispositivoId) {
  const agora = Date.now();
  const janela = janelas.get(dispositivoId) || [];
  const recentes = janela.filter((instante) => agora - instante < 60_000);
  if (recentes.length >= 20) return false;
  recentes.push(agora);
  janelas.set(dispositivoId, recentes);
  return true;
}

async function registrarLog(supa, dados) {
  try {
    await supa.from('gumate_comandos').insert(dados);
  } catch (erro) {
    console.error('[Gumate] Falha ao registrar log:', erro.message);
  }
}

export function registrarRotasGumate(app) {
  app.get('/gumate/saude', (req, res) => {
    res.status(config.gumateEnabled ? 200 : 503).json({
      ok: config.gumateEnabled,
      servico: 'gumate',
      versao: VERSION,
      ia_configurada: Boolean(config.geminiApiKey),
      modelo_ia: config.geminiApiKey ? config.geminiModel : null,
      horario: new Date().toISOString(),
    });
  });

  app.post('/gumate/comando', async (req, res) => {
    if (!config.gumateEnabled) {
      return res.status(503).json({ ok: false, codigo: 'desabilitado', resposta: 'O Gumate esta desabilitado.' });
    }

    const texto = String(req.body?.texto || '').trim();
    if (!texto || texto.length > 300) {
      return res.status(400).json({
        ok: false,
        codigo: 'comando_invalido',
        resposta: 'O comando precisa ter entre 1 e 300 caracteres.',
      });
    }

    const autenticacao = await autenticarDispositivo(req);
    if (!autenticacao.ok) {
      return res.status(autenticacao.status).json({
        ok: false,
        codigo: 'nao_autorizado',
        resposta: autenticacao.motivo,
      });
    }

    const { dispositivo, supa } = autenticacao;
    if (!permitirRequisicao(dispositivo.id)) {
      return res.status(429).json({
        ok: false,
        codigo: 'muitos_comandos',
        resposta: 'Muitos pedidos em pouco tempo. Aguarde um instante.',
      });
    }

    const iniciadoEm = Date.now();
    let interpretacao;
    let resultado;

    try {
      interpretacao = await interpretarComando(texto);
      resultado = await executarAcao({ supa, dispositivo, interpretacao });
    } catch (erro) {
      console.error('[Gumate] Erro inesperado:', erro);
      resultado = {
        ok: false,
        codigo: 'erro_interno',
        resposta: 'Tive um problema para processar esse pedido.',
      };
    }

    void registrarLog(supa, {
      dispositivo_id: dispositivo.id,
      usuario_id: dispositivo.usuario_id,
      casa_id: dispositivo.casa_id,
      comando_texto: texto,
      acao: interpretacao?.acao || null,
      interpretacao: interpretacao || null,
      sucesso: Boolean(resultado.ok),
      codigo_resultado: resultado.codigo,
      resposta: resultado.resposta,
      duracao_ms: Date.now() - iniciadoEm,
    });

    return res.status(resultado.ok ? 200 : 422).json({
      ...resultado,
      acao: interpretacao?.acao || null,
      interpretado_por: interpretacao?.origem_interpretacao || null,
      duracao_ms: Date.now() - iniciadoEm,
    });
  });
}
