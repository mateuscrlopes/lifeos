export function normalizarTexto(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,;.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparNomeItem(valor = '') {
  return String(valor)
    .trim()
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

export function separarItens(texto = '') {
  const limpo = String(texto)
    .replace(/\bpor favor\b/gi, '')
    .replace(/\b(?:na|para a) lista(?: de compras)?\b/gi, '')
    .replace(/\b(?:aqui|la|lá)\b/gi, '')
    .trim();

  return limpo
    .split(/\s*(?:,|;|\be\b|\btambem\b|\btambém\b)\s*/i)
    .map(limparNomeItem)
    .filter((item) => item.length >= 2)
    .slice(0, 12);
}

export function respostaErro(codigo, mensagem) {
  return { ok: false, codigo, resposta: mensagem };
}
