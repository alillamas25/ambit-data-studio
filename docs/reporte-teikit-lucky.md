# Reporte TEIKIT & LUCKY

## Estado

Primera versión funcional con validación en pantalla y exportación ejecutiva Excel.

## Objetivo y procesamiento

El módulo genera indicadores operativos independientes para TEIKIT y LUCKY a partir de archivos Excel o CSV. Todo el procesamiento ocurre localmente en el navegador. El archivo cargado no se modifica, envía ni almacena.

Los archivos `.xlsx` se leen de forma incremental dentro de un Web Worker. El módulo conserva solamente las columnas y acumulados necesarios para el reporte, muestra el avance de lectura y permite cancelar el proceso o sustituir el archivo sin dejar tareas activas. Los formatos `.xls` y `.csv` conservan el lector local compatible existente.

## Columnas utilizadas

- `Restaurant` o `Restaurante`: clasificación de marca y nombre completo de sucursal.
- `Estatus de orden`: universos de órdenes, entregas, no entregas, SLA e incidencias.
- `Orden planeada`: identifica las órdenes programadas cuando su valor es `1`.
- `Tiempo total de envio sin cooking time`: tiempo SLA de órdenes programadas.
- `Creada en`, `Completada en` y `Cooking Time`: cálculo del tiempo SLA de órdenes no programadas.
- `Metodo de pago`: análisis de CASH y CREDIT_CARD.
- `Repartido por`: participación de proveedores.
- `Distancia manejada`: promedio de valores numéricos válidos.
- `Razon de rechazo`: agrupación de incidencias.

Solo `Restaurant`/`Restaurante` y `Estatus de orden` son obligatorias para cargar el archivo. Las demás columnas son opcionales: si falta alguna, sus indicadores quedan sin datos y la validación lo informa.

## Marca y sucursal

La marca se identifica a partir del nombre del restaurante, sin crear ni modificar columnas en el archivo original. Un valor que contiene `TEIKIT` se clasifica como TEIKIT y uno que contiene `LUCKY` se clasifica como LUCKY. El valor completo de restaurante es la sucursal. Los demás valores se mantienen como `Sin clasificar` y se reportan en la validación.

## Universos y denominadores

- Órdenes totales: todas las órdenes clasificadas dentro de la marca, sin filtrar estatus.
- Entregadas: estatus `COMPLETE`. El porcentaje usa las órdenes totales de la marca.
- No entregadas: estatus `CANCELLED`, `REJECTED` o `RETURNED`. El porcentaje usa las órdenes totales de la marca. Otros estatus permanecen en el total, pero no se consideran automáticamente no entregados.
- SLA: solo órdenes `COMPLETE` con un tiempo calculable, numérico, finito y no negativo. Este universo es el denominador de los porcentajes `<45`, `45–60` y `>60`.
- Pagos: CASH y CREDIT_CARD se muestran por separado. Sus porcentajes usan las órdenes totales de la marca, por lo que otros métodos o vacíos permanecen visibles en la validación y los dos porcentajes no tienen que sumar 100%.
- Proveedores: la participación usa todas las órdenes de la marca. Los proveedores principales son UBER_DAAS, RAPPI_CARGO y DIDI_DELIVERY, pero otros valores y vacíos no se reclasifican ni ocultan.

## Tiempo de entrega y rangos SLA

Para órdenes `COMPLETE`, el tiempo SLA depende de `Orden planeada`:

- Si `Orden planeada = 1`, se utiliza `Tiempo total de envio sin cooking time`.
- Si la orden no es programada, se calcula `Completada en - Creada en - Cooking Time`.

`Tiempo total de envio sin cooking time` y `Cooking Time` se tratan como duraciones en minutos. Los números menores a 1 permanecen en minutos y no se convierten en fracciones de día. Las fechas de Excel se interpretan como fechas y horas.

Un tiempo vacío, no numérico, infinito o negativo es inválido y se excluye del SLA. Los valores positivos altos se conservan. Los límites son: menor a 45; desde 45 hasta 60, inclusive; y mayor a 60.

## Distancia

El promedio se calcula como la suma de los valores numéricos válidos de `Distancia manejada` dividida entre la cantidad de órdenes con distancia válida. Los vacíos y valores no numéricos no participan. No se aplican conversiones ni se muestra una unidad.

## Incidencias

Los estatus `CANCELLED`, `REJECTED` y `RETURNED` se analizan en tablas independientes. Las filas se agrupan por sucursal (`Restaurant`) y motivo (`Razon de rechazo`), se ordenan de mayor a menor cantidad y cada porcentaje utiliza como base el total del estatus correspondiente dentro de la marca. Un motivo vacío se presenta como `Sin motivo registrado` sin modificar el archivo original.

## Exportación ejecutiva

La descarga genera un libro Excel con exactamente dos hojas: `TEIKIT` y `LUCKY`. Cada hoja contiene resumen general, SLA, pagos, proveedores logísticos, detalle por sucursal e incidencias.

El exportador consume los resultados ya calculados y validados por el módulo; no implementa una segunda versión de la regla SLA. Por lo tanto, las órdenes programadas y no programadas conservan exactamente la lógica documentada en esta página, al igual que los denominadores de los porcentajes.

La tabla por sucursal incluye participación de UBER_DAAS, RAPPI_CARGO, DIDI_DELIVERY, otros proveedores y órdenes sin proveedor. Para distancia se exporta únicamente el promedio, sin conversiones ni unidad. El archivo original no se incorpora al libro y el procesamiento continúa siendo local.
