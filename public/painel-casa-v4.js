// LifeOS — Painel da Casa v4
// Cuidados das plantas disponíveis assim que o contexto do tablet fica pronto.
(() => {
  'use strict';

  const ICONE_SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>';
  const ICONE_FECHAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const ICONE_PLANTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21v-9"/><path d="M12 13c-4 0-7-2-7-6 4 0 7 2 7 6Z"/><path d="M12 10c4 0 7-2 7-6-4 0-7 2-7 6Z"/></svg>';
  const ICONE_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 4 4L19 6"/></svg>';

  let plantasPendentes = [];
  let sincronizacaoAtual = null;
  let assinaturaAtual = '';
  let funcaoBaseIntegrada = false;

  function carregarCss() {
    if (document.getElementById('painel-casa-v3-css')) return;
    const link = document.createElement('link');
    link.id = 'painel-casa-v3-css';
    link.rel = 'stylesheet';
    link.href = '/painel-casa-v3.css?v=1';
    document.head.appendChild(link);
  }

  function contextoPronto() {
    return typeof supa !== 'undefined'
      && Boolean(supa)
      && typeof usuario !== 'undefined'
      && Boolean(usuario?.id && usuario?.casa_id);
  }

  function escapar(valor = '') {
    const elemento = document.createElement('div');
    elemento.textContent = String(valor);
    return elemento.innerHTML;
  }

  function hojeIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nomePlanta(planta) {
    return planta.especies?.nome_popular || planta.codigo || 'Planta';
  }

  function diasAtras(data) {
    if (!data) return null;
    const hoje = new Date(`${hojeIso()}T12:00:00`);
    const alvo = new Date(`${String(data).slice(0, 10)}T12:00:00`);
    return Math.round((alvo - hoje) / 86400000);
  }

  function rotuloPrazo(data) {
    const dias = diasAtras(data);
    if (dias === null) return 'Pendente';
    if (dias < 0) return `${Math.abs(dias)}d atrás`;
    if (dias === 0) return 'Hoje';
    return `em ${dias}d`;
  }

  function assinatura(plantas) {
    return plantas
      .map(planta => `${planta.id}:${planta.rotinasPendentes
        .map(rotina => `${rotina.id}-${rotina.proxima_realizacao || ''}`)
        .join(',')}`)
      .join('|');
  }

  async function buscarPendencias() {
    const { data, error } = await supa
      .from('plantas')
      .select('id,codigo,perfil_hidrico,especies(nome_popular),planta_rotinas(id,tipo,proxima_realizacao,ativa,intervalo_dias)')
      .eq('casa_id', usuario.casa_id)
      .eq('status', 'ativa');

    if (error) throw error;

    const hoje = hojeIso();

    return (data || [])
      .map(planta => ({
        ...planta,
        rotinasPendentes: (planta.planta_rotinas || [])
          .filter(rotina => rotina.ativa && (
            !rotina.proxima_realizacao || rotina.proxima_realizacao <= hoje
          ))
          .sort((a, b) => String(a.proxima_realizacao || '')
            .localeCompare(String(b.proxima_realizacao || ''))),
      }))
      .filter(planta => planta.rotinasPendentes.length)
      .sort((a, b) => {
        const aData = a.rotinasPendentes[0]?.proxima_realizacao || '';
        const bData = b.rotinasPendentes[0]?.proxima_realizacao || '';
        return aData.localeCompare(bData)
          || nomePlanta(a).localeCompare(nomePlanta(b), 'pt-BR');
      });
  }

  function renderizarPlantas() {
    const area = document.getElementById('painelPlantas');
    const box = document.getElementById('painelPlantasBox');
    if (!area || !box) return;

    if (!plantasPendentes.length) {
      area.innerHTML = '<div class="vazio">Todas as plantas em dia</div>';
      box.style.display = 'none';
      renderizarDestaque();
      return;
    }

    box.style.display = 'block';
    const cores = { alto: '#5b98ce', medio: '#78b38e', baixo: '#d0a34a' };

    area.innerHTML = plantasPendentes.slice(0, 5).map(planta => {
      const rotina = planta.rotinasPendentes[0];
      const restante = planta.rotinasPendentes.length - 1;
      const meta = `${rotina.tipo || 'Cuidado pendente'}${
        restante ? ` · +${restante} cuidado${restante > 1 ? 's' : ''}` : ''
      }`;

      return `
        <button type="button" class="planta-row pc-planta-action" data-pc-planta-id="${escapar(planta.id)}">
          <span class="planta-dot" style="background:${cores[planta.perfil_hidrico] || '#87958c'}"></span>
          <span style="flex:1;min-width:0">
            <span class="planta-nome" style="display:block">${escapar(nomePlanta(planta))}</span>
            <span class="planta-meta" style="display:block">${escapar(meta)}</span>
          </span>
          <span class="planta-tag" style="background:var(--alert-soft);color:var(--alert)">${escapar(rotuloPrazo(rotina.proxima_realizacao))}</span>
          <span class="pc-planta-chevron" aria-hidden="true">${ICONE_SETA}</span>
        </button>`;
    }).join('');

    renderizarDestaque();
  }

  function renderizarDestaque() {
    const area = document.getElementById('painelDestaques');
    if (!area) return;

    if (!plantasPendentes.length) {
      area.innerHTML = '<div class="vazio">Sem destaques no momento</div>';
      return;
    }

    const quantidade = plantasPendentes.length;
    area.innerHTML = `
      <button type="button" class="destaque pc-cuidados-highlight">
        <span class="destaque-icon" style="background:var(--sage-soft);color:var(--sage)">${ICONE_PLANTA}</span>
        <span>
          <span class="destaque-titulo" style="display:block">${quantidade} ${quantidade === 1 ? 'planta precisa' : 'plantas precisam'} de cuidado</span>
          <span class="destaque-sub" style="display:block">Toque para registrar os cuidados de hoje</span>
        </span>
      </button>`;
  }

  async function sincronizar(force = false) {
    if (!contextoPronto()) return plantasPendentes;
    if (sincronizacaoAtual && !force) return sincronizacaoAtual;

    sincronizacaoAtual = (async () => {
      try {
        const novas = await buscarPendencias();
        const novaAssinatura = assinatura(novas);
        plantasPendentes = novas;

        if (
          force
          || novaAssinatura !== assinaturaAtual
          || !document.querySelector('.pc-planta-action')
        ) {
          assinaturaAtual = novaAssinatura;
          renderizarPlantas();
        }

        return plantasPendentes;
      } catch (erro) {
        console.error('[Painel da Casa] Não foi possível carregar cuidados:', erro);
        return plantasPendentes;
      }
    })();

    try {
      return await sincronizacaoAtual;
    } finally {
      sincronizacaoAtual = null;
    }
  }

  function integrarCarregamentoBase() {
    if (funcaoBaseIntegrada || typeof window.carregarPlantasHome !== 'function') {
      return false;
    }

    const carregarPlantasOriginal = window.carregarPlantasHome;

    window.carregarPlantasHome = async function carregarPlantasHomeComAcoes(...args) {
      const resultado = await carregarPlantasOriginal.apply(this, args);
      await sincronizar(true);
      return resultado;
    };

    funcaoBaseIntegrada = true;
    return true;
  }

  async function aguardarContexto() {
    const inicio = Date.now();

    while (Date.now() - inicio < 15000) {
      integrarCarregamentoBase();

      if (contextoPronto()) {
        await sincronizar(true);
        return true;
      }

      await new Promise(resolve => window.setTimeout(resolve, 60));
    }

    console.warn('[Painel da Casa] Contexto das plantas não ficou pronto em 15 segundos.');
    return false;
  }

  function plantasDoModal(plantaId) {
    return plantaId
      ? plantasPendentes.filter(planta => String(planta.id) === String(plantaId))
      : plantasPendentes;
  }

  function fecharModal() {
    document.getElementById('pcPlantModal')?.remove();
  }

  async function abrirCuidados(plantaId = null) {
    fecharModal();

    const modal = document.createElement('div');
    modal.id = 'pcPlantModal';
    modal.className = 'pc-plant-modal';
    modal.dataset.plantaId = plantaId || '';
    modal.innerHTML = `
      <section class="pc-plant-dialog" role="dialog" aria-modal="true" aria-label="Cuidados das plantas">
        <div class="pc-care-empty">
          ${ICONE_PLANTA}
          <strong>Carregando cuidados…</strong>
          <span>Só um instante.</span>
        </div>
      </section>`;

    modal.addEventListener('click', evento => {
      if (evento.target === modal || evento.target.closest('[data-pc-close]')) {
        fecharModal();
      }
    });

    document.body.appendChild(modal);
    await sincronizar(true);
    renderizarModal();
  }

  function renderizarModal(mensagem = '', erro = false) {
    const modal = document.getElementById('pcPlantModal');
    const dialogo = modal?.querySelector('.pc-plant-dialog');
    if (!modal || !dialogo) return;

    const plantas = plantasDoModal(modal.dataset.plantaId || null);
    const titulo = plantas.length === 1 ? nomePlanta(plantas[0]) : 'Cuidados de hoje';
    const total = plantas.reduce(
      (soma, planta) => soma + planta.rotinasPendentes.length,
      0
    );

    dialogo.innerHTML = `
      <header class="pc-plant-header">
        <div>
          <div class="pc-plant-kicker">Plantas da Casa</div>
          <h2 class="pc-plant-title">${escapar(titulo)}</h2>
          <div class="pc-plant-subtitle">${
            total
              ? `${total} ${total === 1 ? 'cuidado pendente' : 'cuidados pendentes'}`
              : 'Nenhum cuidado pendente agora'
          }</div>
        </div>
        <button type="button" class="pc-plant-close" data-pc-close aria-label="Fechar">${ICONE_FECHAR}</button>
      </header>

      <div class="pc-plant-content">
        ${total ? plantas.map(planta => `
          <section class="pc-care-plant">
            ${plantas.length > 1
              ? `<div class="pc-care-plant-name">${escapar(nomePlanta(planta))}</div>`
              : ''}
            ${planta.rotinasPendentes.map(rotina => `
              <div class="pc-care-row">
                <div>
                  <div class="pc-care-type">${escapar(rotina.tipo || 'Cuidado')}</div>
                  <div class="pc-care-meta">${escapar(rotuloPrazo(rotina.proxima_realizacao))} · próximo intervalo: ${Number(rotina.intervalo_dias) || 1} dia${(Number(rotina.intervalo_dias) || 1) === 1 ? '' : 's'}</div>
                </div>
                <button
                  type="button"
                  class="pc-care-button"
                  data-pc-care
                  data-planta-id="${escapar(planta.id)}"
                  data-rotina-id="${escapar(rotina.id)}"
                >Registrar cuidado</button>
              </div>`).join('')}
          </section>`).join('') : `
          <div class="pc-care-empty">
            ${ICONE_CHECK}
            <strong>Tudo em dia</strong>
            <span>Os próximos cuidados aparecerão aqui quando chegar a hora.</span>
          </div>`}

        <div class="pc-care-feedback${erro ? ' erro' : ''}" role="status" aria-live="polite">${escapar(mensagem)}</div>
      </div>`;
  }

  function tipoEvento(tipo = '') {
    if (tipo === 'Trocar a água') return 'troca_agua';
    if (tipo === 'Fazer imersão') return 'imersao';
    return 'rega';
  }

  function proximaData(intervalo) {
    const data = new Date();
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + (Number(intervalo) || 1));
    return data.toISOString().slice(0, 10);
  }

  async function registrarCuidado(botao) {
    const planta = plantasPendentes.find(
      item => String(item.id) === String(botao.dataset.plantaId)
    );
    const rotina = planta?.rotinasPendentes.find(
      item => String(item.id) === String(botao.dataset.rotinaId)
    );

    if (!planta || !rotina || !contextoPronto()) return;

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Registrando…';

    try {
      const realizadoEm = new Date().toISOString();
      const proxima = proximaData(rotina.intervalo_dias);

      const { error } = await supa.rpc('registrar_cuidado_planta', {
        p_planta_id: planta.id,
        p_rotina_id: rotina.id,
        p_usuario_id: usuario.id,
        p_realizado_em: realizadoEm,
        p_proxima_realizacao: proxima,
        p_tipo_evento: tipoEvento(rotina.tipo),
        p_notas: `${rotina.tipo} registrada via Painel da Casa`,
      });

      if (error) throw error;

      planta.rotinasPendentes = planta.rotinasPendentes.filter(
        item => String(item.id) !== String(rotina.id)
      );
      plantasPendentes = plantasPendentes.filter(
        item => item.rotinasPendentes.length
      );
      assinaturaAtual = assinatura(plantasPendentes);

      renderizarPlantas();
      renderizarModal('Cuidado registrado.');

      if (typeof window.atualizarDadosTablet === 'function') {
        window.atualizarDadosTablet().catch(erroAtualizacao => {
          console.warn('[Painel da Casa] Atualização geral após cuidado:', erroAtualizacao);
        });
      }

      window.setTimeout(() => sincronizar(true), 250);
    } catch (erro) {
      console.error('[Painel da Casa] Falha ao registrar cuidado:', erro);
      botao.disabled = false;
      botao.textContent = textoOriginal;
      renderizarModal('Não foi possível registrar o cuidado. Tente novamente.', true);
    }
  }

  function tratarClique(evento) {
    const cuidado = evento.target.closest?.('[data-pc-care]');
    if (cuidado) {
      registrarCuidado(cuidado);
      return;
    }

    const planta = evento.target.closest?.('[data-pc-planta-id]');
    if (planta) {
      abrirCuidados(planta.dataset.pcPlantaId);
      return;
    }

    const destaque = evento.target.closest?.('.pc-cuidados-highlight');
    if (destaque) {
      abrirCuidados();
      return;
    }

    const contexto = evento.target.closest?.(
      '#painelContextoCasa [data-pagina="inicio"]'
    );

    if (contexto && /cuidado de planta/i.test(contexto.textContent)) {
      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation?.();
      abrirCuidados();
    }
  }

  function iniciar() {
    carregarCss();
    document.addEventListener('click', tratarClique, true);
    aguardarContexto();
    window.setInterval(() => sincronizar(), 60 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sincronizar(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
