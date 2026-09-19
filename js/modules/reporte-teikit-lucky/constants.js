export const COLUMN_DEFINITIONS = {
  orderId: ["orderId", "Order ID", "ID de orden"],
  restaurant: ["Restaurant", "Restaurante"],
  status: ["Estatus de orden"],
  createdAt: ["Creada en"],
  completedAt: ["Completada en"],
  cookingTime: ["Cooking Time"],
  plannedOrder: ["Orden planeada"],
  officialTime: ["Tiempo total de envio sin cooking time"],
  paymentMethod: ["Metodo de pago", "Método de pago"],
  provider: ["Repartido por"],
  distance: ["Distancia manejada"],
  rejectionReason: ["Razon de rechazo", "Razón de rechazo"],
};

export const REQUIRED_COLUMNS = ["restaurant", "status"];
export const OPTIONAL_COLUMNS = ["createdAt", "completedAt", "cookingTime", "plannedOrder", "officialTime", "paymentMethod", "provider", "distance", "rejectionReason"];
export const BRANDS = ["TEIKIT", "LUCKY"];
export const NON_DELIVERED_STATUSES = new Set(["CANCELLED", "REJECTED", "RETURNED"]);
export const INCIDENT_STATUSES = ["CANCELLED", "REJECTED", "RETURNED"];
export const PRIMARY_PROVIDERS = new Set(["UBER_DAAS", "RAPPI_CARGO", "DIDI_DELIVERY"]);
export const KNOWN_PAYMENT_METHODS = new Set(["CASH", "CREDIT_CARD"]);
