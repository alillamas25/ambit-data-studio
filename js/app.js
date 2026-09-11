import { renderModuleCatalog } from "./modules/module-catalog.js";

const moduleList = document.querySelector("#module-list");

if (moduleList) {
  renderModuleCatalog(moduleList);
}
