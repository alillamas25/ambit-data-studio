export const COLUMN_DEFINITIONS = {
  orderId: ["orderId"],
  createdAt: ["Creada en"],
  completedAt: ["Completada en"],
  status: ["Estatus de orden"],
  provider: ["Repartido por"],
  cookingTime: ["Cooking Time"],
  totalDelivery: ["Tiempo total de envio"],
  officialTime: ["Tiempo total de envio sin cooking time"],
  indicator45: ["Tiempo total sin cooking time <45"],
  indicator60: ["Tiempo total sin cooking time <60"],
  indicatorOver60: ["Tiempo total sin cooking time >60"],
  withoutRestaurantWait: ["Tiempo total de envio sin espera de restaurante"],
  acceptance: ["Tiempo de aceptacion de repartidor"],
  toStore: ["Tiempo para llegar a tienda"],
  pickup: ["Tiempo para recoger"],
  delivery: ["Tiempo para entregar"],
  completion: ["Tiempo para completar"],
  restaurant: ["Restaurant"],
  zone: ["Zona"],
  city: ["Ciudad"],
  brand: ["Marca"],
};

export const REQUIRED_COLUMNS = ["orderId", "createdAt", "status", "provider", "officialTime"];
export const ELIGIBLE_PROVIDERS = new Set(["UBER_DAAS", "RAPPI_CARGO", "DIDI_DELIVERY"]);
export const DIFFERENCE_THRESHOLDS = Object.freeze({ coincide: 1, minor: 5, review: 10 });

export const STAGES = [
  ["acceptance", "Aceptación"],
  ["toStore", "Llegar a tienda"],
  ["pickup", "Recoger"],
  ["delivery", "Entregar"],
  ["completion", "Completar"],
];

export const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
