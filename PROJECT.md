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

Análisis de tiempos `<45`, `45–60` y `>60` minutos, con desglose por las diferentes
dimensiones disponibles en la base.

### 2. Estatus de órdenes

Análisis de órdenes `Complete`, `Cancelled`, `Returned`, `Returning` y otros estatus
disponibles, incluyendo tasas de entrega y no entrega.

### 3. Demanda de órdenes

Análisis de volumen y comportamiento de órdenes por día, hora, semana, mes,
sucursal, restaurante, proveedor u otras dimensiones disponibles.

### 4. Costos de envío

Análisis de costos de envío, promedios, totales y distribución según las
dimensiones disponibles en la información.

### 5. KPIs principales

Análisis ejecutivo que combine principalmente tiempos de entrega y estatus de
órdenes, pudiendo incorporar otros indicadores relevantes conforme se defina el
módulo.

### 6. Limpieza de datos

Procesamiento de archivos para aplicar reglas de limpieza y transformación y
generar una base lista para utilizar en dashboards u otros análisis.

### 7. Restaurant Billing

Estado: Por definir.

Los archivos de entrada, cruces, cálculos, indicadores y resultados se definirán
posteriormente. No existe lógica aprobada para este módulo.

### 8. Conciliación Cash Uber

Herramienta para realizar procesos de conciliación relacionados con órdenes Cash
de Uber. La lógica específica será definida antes de su desarrollo.

### 9. Cruce de información entre archivos

Herramienta para cruzar dos o más archivos utilizando una llave definida,
encontrar coincidencias y diferencias, incorporar información entre archivos y
generar un archivo resultado.

### 10. Comparador de periodos

Herramienta para comparar dos periodos de operación —por ejemplo, semana contra
semana, mes contra mes o periodos personalizados— e identificar variaciones en
indicadores, volumen, tiempos, estatus, costos u otras métricas disponibles.

### 11. Desempeño de proveedores

Análisis integral del desempeño de proveedores logísticos combinando indicadores
como tiempos, estatus, volumen y costos cuando la información esté disponible.

### 12. Desempeño de sucursales

Análisis integral y comparativo de sucursales utilizando los indicadores
operativos disponibles.

### 13. Reporte TEIKIT & LUCKY

Herramienta destinada a generar el reporte operativo periódico de TEIKIT y LUCKY a partir de las bases correspondientes.

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

La lógica específica, estructura de los archivos de entrada, cálculos, formato y archivo de salida serán definidos antes de iniciar su desarrollo.

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
