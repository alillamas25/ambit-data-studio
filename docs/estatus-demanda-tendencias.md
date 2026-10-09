# Estatus, Demanda y Tendencias

## Estado

Primera versión funcional con análisis web y exportación ejecutiva Excel.

## Universo

El módulo analiza órdenes de todos los estatus cuyo valor de `Repartido por` sea `UBER_DAAS`, `RAPPI_CARGO` o `DIDI_DELIVERY`. Los demás proveedores se excluyen del universo y se reportan en el resumen de carga.

- Entregadas: `COMPLETE`.
- No entregadas: `CANCELLED`, `REJECTED` y `RETURNED`.
- Otros estatus permanecen en el total y se muestran de forma independiente, pero no se clasifican automáticamente como no entregados.
- Todos los porcentajes se recalculan sobre el resultado de los filtros activos.

## Columnas

Obligatorias:

- `Restaurant`: sucursal completa y fuente para identificar la marca.
- `Estatus de orden`: clasificación operativa.
- `Repartido por`: universo y análisis por proveedor.
- `Creada en`: fecha, día de semana y hora.

Opcionales:

- `Ciudad`.
- `Zona`.
- `Razon de rechazo`.
- `orderId`, `Order ID` o `ID de orden`, conservado para trazabilidad cuando existe.

## Marcas

La identificación utiliza 1,931 relaciones `Sucursal → Marca` derivadas de la tabla efectiva de `Catalogo_Maestro_Marcas_AMBIT.xlsx`. La fuente contiene 538 etiquetas originales y, después de aplicar las cuatro equivalencias canónicas aprobadas, el módulo presenta 534 marcas canónicas. Las 113 relaciones originalmente agrupadas como `Teikit - Lucky` se separan por el nombre completo de la sucursal en 53 relaciones `TEIKIT` y 60 relaciones `LUCKY`; no existen casos ambiguos. La sucursal completa debe existir en el catálogo y `559 KFC PATIO QUERÉTARO → KFC` está registrada explícitamente.

La canonicalización ocurre después de identificar la sucursal y modifica únicamente la etiqueta final de marca: `Chamorros del puerto → Chamorros del Puerto`, `Lecaroz → LECAROZ`, `Delicias del Contry → Delicias Del Contry` y `Esquitemanía → Esquitemania`.

No se aplican coincidencias parciales, fuzzy matching ni deducciones por prefijo. La comparación tolera diferencias de mayúsculas, acentos, espacios, apóstrofes, caracteres invisibles y mojibake cuando representan el mismo nombre completo. Los valores que no tienen una relación autorizada se conservan como `Sin marca identificada`; nunca se inventan marcas ni se fusionan sucursales. Las demás marcas parecidas permanecen separadas salvo aprobación explícita.

## Análisis

La herramienta incluye indicadores generales, todos los estatus encontrados, demanda por fecha, día y las 24 horas, tendencia de volumen frente a porcentaje de no entrega, desgloses por sucursal, marca, ciudad, zona y proveedor, y tablas separadas de incidencias para `CANCELLED`, `REJECTED` y `RETURNED`.

Las incidencias se agrupan por `Restaurant + Razon de rechazo`, se ordenan por cantidad descendente y calculan su porcentaje sobre el total del estatus correspondiente dentro de los filtros actuales. Los motivos vacíos se muestran como `Sin motivo registrado`.

## Privacidad

Excel y CSV se procesan localmente en el navegador. El archivo original no se modifica, almacena ni envía a servicios externos.

## Exportación

La descarga genera un libro con hojas independientes para resumen, tendencia, día, hora, sucursales, marcas, ciudades, zonas, proveedores y cada estatus de incidencia. El exportador recibe el mismo resultado calculado que utiliza la interfaz y respeta todos los filtros activos; no contiene una segunda implementación de las reglas de negocio.
