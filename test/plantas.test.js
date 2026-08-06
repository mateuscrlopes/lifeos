import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarCuidado, urgenciaPlanta } from '../public/plantas.js';

function criarSupa({ erroRotina = null } = {}) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      return {
        update(dados) {
          chamadas.push({ tabela, operacao: 'update', dados });
          return { eq: async () => ({ error: erroRotina }) };
        },
        insert(dados) {
          chamadas.push({ tabela, operacao: 'insert', dados });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

test('registrarCuidado atualiza a rotina e registra o evento', async () => {
  const supa = criarSupa();
  const resultado = await registrarCuidado(
    supa,
    { id: 'usuario-1' },
    { id: 'planta-1' },
    { id: 'rotina-1', tipo: 'Verificar e regar', intervalo_dias: 3 },
  );

  assert.equal(resultado.ok, true);
  assert.equal(supa.chamadas[0].tabela, 'planta_rotinas');
  assert.equal(supa.chamadas[0].dados.ultima_realizacao, new Date().toISOString().slice(0, 10));
  assert.equal(supa.chamadas[1].tabela, 'planta_eventos');
  assert.equal(supa.chamadas[1].dados.planta_id, 'planta-1');
});

test('registrarCuidado não cria evento quando a rotina falha', async () => {
  const supa = criarSupa({ erroRotina: { message: 'sem acesso' } });
  const resultado = await registrarCuidado(
    supa,
    { id: 'usuario-1' },
    { id: 'planta-1' },
    { id: 'rotina-1', tipo: 'Verificar e regar', intervalo_dias: 3 },
  );

  assert.deepEqual(resultado, { ok: false, motivo: 'sem acesso' });
  assert.equal(supa.chamadas.length, 1);
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
