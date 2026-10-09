# Limpieza de datos

## Estado

Primera versión funcional en desarrollo.

## Objetivo

Generar localmente un archivo Excel estructuralmente limpio a partir de una base operativa, sin transformar sus valores de negocio.

## Flujo

1. Cargar un archivo Excel.
2. Validar que existan exactamente por nombre las 22 columnas requeridas.
3. Conservar únicamente filas cuyo valor de `Repartido por` sea `DIDI_DELIVERY`, `RAPPI_CARGO` o `UBER_DAAS`.
4. Eliminar duplicados por `orderId`, conservando la primera aparición y el orden relativo original.
5. Validar la estructura, los proveedores, la unicidad, el orden y la reconciliación de totales.
6. Descargar un libro con una única hoja `CLEAN` y nombre terminado en `_LIMPIO.xlsx`.

La limpieza no recalcula tiempos, no normaliza estatus, restaurantes, marcas, proveedores ni identificadores, y no sustituye vacíos. El archivo original no se modifica y todo el procesamiento ocurre en el navegador.
