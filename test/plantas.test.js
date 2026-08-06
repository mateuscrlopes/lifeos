import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarCuidado, urgenciaPlanta } from '../public/plantas.js';
import { excluirContaPorId } from '../public/contas.js';

function criarSupa({ erro = null, rotinaPertence = true } = {}) {
  const chamadas = [];
  const banco = {
    rotina: { id: 'rotina-1', planta_id: 'planta-1', ultima_realizacao: null, proxima_realizacao: '2026-08-01' },
    eventos: [],
  };
  return {
    chamadas,
    banco,
    async rpc(nome, parametros) {
      chamadas.push({ nome, parametros });
      if (erro) return { data: null, error: erro };
      if (!rotinaPertence || parametros.p_planta_id !== banco.rotina.planta_id || parametros.p_rotina_id !== banco.rotina.id) {
        return { data: null, error: { message: 'A rotina não pertence à planta informada.' } };
      }
      banco.rotina.ultima_realizacao = parametros.p_realizado_em.slice(0, 10);
      banco.rotina.proxima_realizacao = parametros.p_proxima_realizacao;
      banco.eventos.push({
        planta_id: parametros.p_planta_id,
        tipo: parametros.p_tipo_evento,
        notas: parametros.p_notas,
        usuario_id: parametros.p_usuario_id,
      });
      return { data: parametros.p_proxima_realizacao, error: null };
    },
  };
}

test('registrarCuidado atualiza rotina e cria evento pela RPC atômica', async () => {
  const supa = criarSupa();
  const resultado = await registrarCuidado(
    supa,
    { id: 'usuario-1' },
    { id: 'planta-1' },
    { id: 'rotina-1', tipo: 'Verificar e regar', intervalo_dias: 3 },
  );

  assert.equal(resultado.ok, true);
  assert.equal(supa.chamadas[0].nome, 'registrar_cuidado_planta');
  assert.equal(supa.chamadas[0].parametros.p_planta_id, 'planta-1');
  assert.equal(supa.banco.rotina.ultima_realizacao, new Date().toISOString().slice(0, 10));
  assert.equal(supa.banco.eventos.length, 1);
  assert.equal(supa.banco.eventos[0].planta_id, 'planta-1');
});

test('registrarCuidado falha sem deixar atualização parcial', async () => {
  const supa = criarSupa({ erro: { message: 'falha no banco' } });
  const resultado = await registrarCuidado(
    supa,
    { id: 'usuario-1' },
    { id: 'planta-1' },
    { id: 'rotina-1', tipo: 'Verificar e regar', intervalo_dias: 3 },
  );

  assert.deepEqual(resultado, { ok: false, motivo: 'falha no banco' });
  assert.equal(supa.chamadas.length, 1);
  assert.equal(supa.banco.rotina.ultima_realizacao, null);
  assert.equal(supa.banco.rotina.proxima_realizacao, '2026-08-01');
  assert.deepEqual(supa.banco.eventos, []);
});

test('registrarCuidado rejeita rotina que não pertence à planta', async () => {
  const supa = criarSupa({ rotinaPertence: false });
  const resultado = await registrarCuidado(
    supa,
    { id: 'usuario-1' },
    { id: 'planta-1' },
    { id: 'rotina-1', tipo: 'Verificar e regar', intervalo_dias: 3 },
  );

  assert.deepEqual(resultado, { ok: false, motivo: 'A rotina não pertence à planta informada.' });
  assert.equal(supa.banco.rotina.ultima_realizacao, null);
  assert.deepEqual(supa.banco.eventos, []);
});

test('urgenciaPlanta prioriza rotina vencida', () => {
  const resultado = urgenciaPlanta({
    planta_rotinas: [
      { ativa: true, proxima_realizacao: '2999-01-01' },
      { ativa: true, proxima_realizacao: '2000-01-01' },
    ],
  });

  assert.equal(resultado, 'vencida');
});

test('excluirContaPorId remove somente a conta selecionada entre nomes iguais', async () => {
  const contas = [
    { id: 'conta-1', nome: 'Energia' },
    { id: 'conta-2', nome: 'Energia' },
  ];
  const supa = {
    from(tabela) {
      assert.equal(tabela, 'contas');
      return {
        delete() {
          return {
            async eq(campo, valor) {
              assert.equal(campo, 'id');
              const indice = contas.findIndex(conta => conta.id === valor);
              if (indice < 0) return { error: { message: 'Conta não encontrada' } };
              contas.splice(indice, 1);
              return { error: null };
            },
          };
        },
      };
    },
  };

  const { error } = await excluirContaPorId(supa, 'conta-2');

  assert.equal(error, null);
  assert.deepEqual(contas, [{ id: 'conta-1', nome: 'Energia' }]);
});
