// LifeOS — salvamento robusto das medidas corporais do Ritmo.
// Centraliza a persistência deste modal e impede falhas silenciosas.
(() => {
  'use strict';

  let medidaEditandoId = null;
  let salvando = false;

  const $ = id => document.getElementById(id);

  function contexto() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario?.id) return null;
    return { client: ctx.supa, usuario: ctx.usuario };
  }

  function numeroOuNull(input) {
    if (!input) return null;
    const valor = String(input.value ?? '').trim().replace(',', '.');
    if (!valor) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }

  function statusNode(button) {
    const actions = button?.closest('.ritmo-actions');
    if (!actions) return null;
    let status = actions.parentElement?.querySelector(':scope > .ritmo-measure-save-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'ritmo-note ritmo-measure-save-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      actions.insertAdjacentElement('afterend', status);
    }
    return status;
  }

  function mostrarStatus(button, mensagem, erro = false) {
    const node = statusNode(button);
    if (!node) return;
    node.textContent = mensagem;
    node.style.color = erro ? 'var(--danger, #b23c3c)' : '';
  }

  function payloadAtual(usuarioId) {
    const data = $('ritmoMedData')?.value;
    if (!data) throw new Error('Informe a data da medição.');

    const campos = [
      ['peso_kg', 'ritmoMedPeso'],
      ['cintura_cm', 'ritmoMedCintura'],
      ['abdomen_cm', 'ritmoMedAbdomen'],
      ['quadril_alto_cm', 'ritmoMedQuadrilAlto'],
      ['quadril_max_cm', 'ritmoMedQuadril'],
      ['peito_cm', 'ritmoMedPeito'],
      ['coxa_d_cm', 'ritmoMedCoxa'],
      ['braco_d_cm', 'ritmoMedBraco'],
      ['panturrilha_d_cm', 'ritmoMedPanturrilha'],
    ];

    const payload = { usuario_id: usuarioId, data };
    for (const [coluna, id] of campos) payload[coluna] = numeroOuNull($(id));

    if (!campos.some(([coluna]) => payload[coluna] != null)) {
      throw new Error('Preencha pelo menos uma medida antes de salvar.');
    }
    return payload;
  }

  async function resolverIdEdicao(ctx) {
    if (medidaEditandoId) return medidaEditandoId;
    if (!$('ritmoExcluirMedida')) return null;

    const data = $('ritmoMedData')?.value;
    if (!data) return null;
    const { data: row, error } = await ctx.client
      .from('ritmo_medidas')
      .select('id')
      .eq('usuario_id', ctx.usuario.id)
      .eq('data', data)
      .maybeSingle();
    if (error) throw error;
    return row?.id || null;
  }

  function fecharModal() {
    const modal = $('ritmoModal');
    const conteudo = $('ritmoModalConteudo');
    if (modal) modal.hidden = true;
    if (conteudo) conteudo.innerHTML = '';
  }

  async function salvar(button) {
    if (salvando) return;
    const ctx = contexto();
    if (!ctx) {
      mostrarStatus(button, 'Não foi possível identificar seu perfil. Feche e abra o LifeOS novamente.', true);
      return;
    }

    salvando = true;
    const textoOriginal = button.textContent;
    button.disabled = true;
    button.textContent = 'Salvando…';
    mostrarStatus(button, 'Salvando medidas…');

    try {
      const payload = payloadAtual(ctx.usuario.id);
      const id = await resolverIdEdicao(ctx);
      const consulta = id
        ? ctx.client.from('ritmo_medidas').update(payload).eq('id', id).eq('usuario_id', ctx.usuario.id).select('*').single()
        : ctx.client.from('ritmo_medidas').upsert(payload, { onConflict: 'usuario_id,data' }).select('*').single();

      const { data, error } = await consulta;
      if (error) throw error;
      if (!data?.id) throw new Error('O banco não confirmou o registro das medidas.');

      medidaEditandoId = data.id;
      mostrarStatus(button, 'Medidas salvas.');
      window.dispatchEvent(new CustomEvent('lifeos:ritmo-medidas-salvas', { detail: data }));
      window.setTimeout(fecharModal, 350);
    } catch (erro) {
      console.error('[Ritmo] Falha ao salvar medidas:', erro);
      mostrarStatus(button, erro?.message || 'Não foi possível salvar as medidas. Tente novamente.', true);
      button.disabled = false;
      button.textContent = textoOriginal;
    } finally {
      salvando = false;
    }
  }

  function tratarClique(event) {
    const editar = event.target.closest('[data-editar-medida]');
    if (editar) {
      medidaEditandoId = editar.dataset.editarMedida || null;
      return;
    }
    if (event.target.closest('#ritmoNovaMedida')) {
      medidaEditandoId = null;
      return;
    }

    const button = event.target.closest('#ritmoSalvarMedida');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    button.type = 'button';
    void salvar(button);
  }

  function preparar() {
    const button = $('ritmoSalvarMedida');
    if (button) button.type = 'button';
  }

  function iniciar() {
    document.addEventListener('click', tratarClique, true);
    const observer = new MutationObserver(preparar);
    observer.observe(document.body, { childList: true, subtree: true });
    preparar();
    window.addEventListener('pageshow', preparar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
