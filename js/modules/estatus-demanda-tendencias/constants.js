export const COLUMN_DEFINITIONS = Object.freeze({
  orderId: ["orderId", "Order ID", "ID de orden"],
  restaurant: ["Restaurant", "Restaurante"],
  status: ["Estatus de orden"],
  provider: ["Repartido por"],
  createdAt: ["Creada en"],
  city: ["Ciudad"],
  zone: ["Zona"],
  rejectionReason: ["Razon de rechazo", "Razón de rechazo"],
});

export const REQUIRED_COLUMNS = ["restaurant", "status", "provider", "createdAt"];
export const OPTIONAL_COLUMNS = ["orderId", "city", "zone", "rejectionReason"];
export const ELIGIBLE_PROVIDERS = new Set(["UBER_DAAS", "RAPPI_CARGO", "DIDI_DELIVERY"]);
export const NON_DELIVERED_STATUSES = new Set(["CANCELLED", "REJECTED", "RETURNED"]);
export const INCIDENT_STATUSES = ["CANCELLED", "REJECTED", "RETURNED"];

export const UNKNOWN_BRAND = "Sin marca identificada";
export const DAYS = Object.freeze(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]);
