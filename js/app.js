import { renderModuleCatalog } from "./modules/module-catalog.js?v=20261008-limpieza-datos";

const moduleList = document.querySelector("#module-list");

if (moduleList) {
  renderModuleCatalog(moduleList);
}
