# Ambit Data Studio

## Alcance del proyecto

Ambit Data Studio es un portal web interno enfocado exclusivamente en herramientas
para el procesamiento, la transformación y el análisis de bases de datos y archivos
operativos, principalmente en formatos Excel y CSV.

El proyecto debe facilitar procesos operativos claramente definidos mediante
herramientas sencillas, independientes y fáciles de mantener.

## Principios del catálogo de herramientas

- Cada herramienta debe resolver un proceso claramente definido.
- Evitar crear módulos diferentes cuando una funcionalidad pueda formar parte
  naturalmente de una herramienta existente.
- Los módulos deben poder funcionar de manera independiente.
- El usuario debe poder cargar su archivo, realizar el análisis o proceso
  correspondiente y obtener el resultado sin necesitar utilizar previamente otro
  módulo.
- Los archivos operativos deben continuar procesándose localmente siempre que
  técnicamente sea posible.
- No almacenar automáticamente las bases procesadas.
- El catálogo puede crecer progresivamente conforme se identifiquen nuevas
  necesidades.

## Catálogo de herramientas planeadas

### 1. Tiempos de entrega

Estado: Primera versión funcional en desarrollo.

Análisis de tiempos `<45`, `45–60` y `>60` minutos, con desglose por las diferentes
dimensiones disponibles en la base.

Documentación: `docs/tiempos-entrega.md`.

### 2. Estatus, Demanda y Tendencias

Estado: Primera versión funcional en desarrollo.

Análisis integrado de volumen, estatus, incidencias y tendencias operativas por
fecha, día, hora, sucursal, marca, ciudad, zona y proveedor. Considera todos los
estatus disponibles dentro del universo de proveedores logísticos permitido.

Documentación: `docs/estatus-demanda-tendencias.md`.

### 3. Costos de envío

Análisis de costos de envío, promedios, totales y distribución según las
dimensiones disponibles en la información.

### 4. KPIs principales

Análisis ejecutivo que combine principalmente tiempos de entrega y estatus de
órdenes, pudiendo incorporar otros indicadores relevantes conforme se defina el
módulo.

### 5. Limpieza de datos

Estado: Primera versión funcional en desarrollo.

Procesamiento de archivos para aplicar reglas de limpieza y transformación y
generar una base lista para utilizar en dashboards u otros análisis.

Documentación: `docs/limpieza-datos.md`.

### 6. Restaurant Billing

Estado: Por definir.

Los archivos de entrada, cruces, cálculos, indicadores y resultados se definirán
posteriormente. No existe lógica aprobada para este módulo.

### 7. Conciliación Cash Uber

Herramienta para realizar procesos de conciliación relacionados con órdenes Cash
de Uber. La lógica específica será definida antes de su desarrollo.

### 8. Cruce de información entre archivos

Herramienta para cruzar dos o más archivos utilizando una llave definida,
encontrar coincidencias y diferencias, incorporar información entre archivos y
generar un archivo resultado.

### 9. Comparador de periodos

Herramienta para comparar dos periodos de operación —por ejemplo, semana contra
semana, mes contra mes o periodos personalizados— e identificar variaciones en
indicadores, volumen, tiempos, estatus, costos u otras métricas disponibles.

### 10. Desempeño de proveedores

Análisis integral del desempeño de proveedores logísticos combinando indicadores
como tiempos, estatus, volumen y costos cuando la información esté disponible.

### 11. Desempeño de sucursales

Análisis integral y comparativo de sucursales utilizando los indicadores
operativos disponibles.

### 12. Reporte TEIKIT & LUCKY

Herramienta destinada a generar el reporte operativo periódico de TEIKIT y LUCKY a partir de las bases correspondientes.

Estado: Primera versión funcional con exportación ejecutiva Excel.

Documentación: `docs/reporte-teikit-lucky.md`.

El reporte se genera de forma semanal y mensual y contempla:

- Tiempos de entrega.
- Órdenes totales.
- Órdenes entregadas y no entregadas.
- Porcentaje de entrega y no entrega.
- Razones de rechazo.
- Razones de cancelación.
- Razones de devolución.
- Share de proveedor logístico por sucursal.
- Distancia promedio por sucursal.
- Desglose de información por marca, sucursal y periodo.

El objetivo del módulo es automatizar la preparación del reporte recurrente y generar un resultado final listo para compartir.

La lógica aprobada, las columnas de entrada, los cálculos y la exportación se documentan en `docs/reporte-teikit-lucky.md`.

## Estructura base del portal

**Estado: Primera versión completada.**

La página inicial establece la estructura base de Ambit Data Studio utilizando HTML, CSS y JavaScript sin frameworks. Presenta directamente un catálogo compacto de herramientas, sin lógica de procesamiento o análisis ni conexiones externas.

La identidad visual utiliza el logo de Ambit proporcionado como recurso local y los colores de la interfaz están centralizados mediante variables CSS.

### Organización actual

- `index.html`: estructura de la página inicial.
- `css/`: estilos base, de composición y de componentes.
- `js/app.js`: punto de entrada de JavaScript.
- `js/modules/`: componentes independientes del catálogo del portal.
- `assets/`: recursos visuales locales.

Las herramientas del catálogo se encuentran actualmente planeadas o en definición. Todavía no se ha desarrollado la funcionalidad de ninguno de los módulos.
