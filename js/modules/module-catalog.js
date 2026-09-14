const modules = [
  {
    name: "Tiempos de entrega",
    description: "Analiza tiempos de órdenes completadas y valida la consistencia de los tiempos reportados.",
    status: "Disponible",
    href: "modules/tiempos-entrega.html",
  },
  {
    name: "Restaurant Billing",
    description: "Espacio reservado para el futuro análisis de facturación de restaurantes.",
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

  const action = document.createElement(module.href ? "a" : "button");
  action.className = `module-row__action${module.href ? " module-row__action--enabled" : ""}`;
  action.textContent = "Abrir";
  if (module.href) {
    action.href = module.href;
    action.setAttribute("aria-label", `Abrir ${module.name}`);
  } else {
    action.type = "button";
    action.disabled = true;
  }

  details.append(title, description);
  article.append(details, status, action);
  return article;
}

export function renderModuleCatalog(container) {
  const fragment = document.createDocumentFragment();
  modules.forEach((module) => fragment.append(createModuleRow(module)));
  container.replaceChildren(fragment);
}
