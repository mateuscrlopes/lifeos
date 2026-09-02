(() => {
  'use strict';
  const hora = new Date().getHours();
  const refeicaoPrincipal = (hora >= 12 && hora < 15) || hora >= 18;
  if (refeicaoPrincipal) import('./ritmo-food-v2.js?v=1');
})();