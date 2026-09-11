const modules = [
  {
    name: "Restaurant Billing",
    description: "Espacio reservado para el futuro análisis de facturación de restaurantes.",
    status: "En definición",
  },
  {
    name: "Analizador Inteligente de Órdenes",
    description: "Espacio reservado para incorporar posteriormente el análisis de órdenes.",
    status: "En definición",
  },
];

function createModuleRow(module) {
  const article = document.createElement("article");
  article.className = "module-row";

  const details = document.createElement("div");
  details.className = "module-row__details";

  const status = document.createElement("span");
  status.className = "status-pill";
  status.textContent = module.status;

  const title = document.createElement("h3");
  title.textContent = module.name;

  const description = document.createElement("p");
  description.textContent = module.description;

  const button = document.createElement("button");
  button.className = "module-row__action";
  button.type = "button";
  button.disabled = true;
  button.textContent = "Abrir";

  details.append(title, description);
  article.append(details, status, button);
  return article;
}

export function renderModuleCatalog(container) {
  const fragment = document.createDocumentFragment();
  modules.forEach((module) => fragment.append(createModuleRow(module)));
  container.replaceChildren(fragment);
}
