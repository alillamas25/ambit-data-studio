# Tiempos de entrega

## Objetivo

Analizar el desempeño de tiempos de órdenes completadas y validar la consistencia
de los tiempos reportados en archivos operativos Excel o CSV. Todo el procesamiento
se realiza localmente en el navegador y los datos permanecen únicamente en memoria
durante la sesión.

## Columnas utilizadas

### Columnas obligatorias

- `orderId`
- `Creada en`
- `Estatus de orden`
- `Repartido por`
- `Tiempo total de envio sin cooking time`

### Columnas opcionales

- `Completada en`
- `Cooking Time`
- `Tiempo total de envio`
- `Tiempo total sin cooking time <45`
- `Tiempo total sin cooking time <60`
- `Tiempo total sin cooking time >60`
- `Tiempo total de envio sin espera de restaurante`
- `Tiempo de aceptacion de repartidor`
- `Tiempo para llegar a tienda`
- `Tiempo para recoger`
- `Tiempo para entregar`
- `Tiempo para completar`
- `Restaurant`
- `Zona`
- `Ciudad`
- `Marca`, únicamente cuando existe en el archivo

Los encabezados se reconocen ignorando mayúsculas, minúsculas, acentos y espacios
accidentales. Esta normalización no modifica el archivo original ni sus datos.

## Universos de análisis

El módulo mantiene dos universos independientes que tienen objetivos distintos y
nunca se mezclan.

### Universo KPI

Los indicadores SLA, sus desgloses, las validaciones, el análisis del tiempo sin
espera de restaurante y la base analizada incluyen únicamente registros con:

- `Estatus de orden = COMPLETE`.
- `Repartido por = UBER_DAAS`, `RAPPI_CARGO` o `DIDI_DELIVERY`.

Las comparaciones ignoran mayúsculas, minúsculas y espacios accidentales. Antes
del análisis se muestran las órdenes cargadas, completas, elegibles y excluidas
por estatus o proveedor.

### Universo etapas

El análisis de tiempos por etapa incluye todos los estatus, pero únicamente
órdenes con `Repartido por = UBER_DAAS`, `RAPPI_CARGO` o `DIDI_DELIVERY`.
Este universo sirve para diagnóstico y no incorpora órdenes de otros estatus a
los indicadores SLA.

## KPI oficial

La medida oficial es `Tiempo total de envio sin cooking time`. No se sustituye
por ningún cálculo alternativo. Se muestran órdenes analizadas, promedio, mediana,
cantidades y porcentajes para `<45`, `45–60`, `>60`, además del acumulado `<60`.

Los rangos son mutuamente excluyentes:

- `<45`: menos de 45 minutos.
- `45–60`: desde 45 hasta 60 minutos, ambos incluidos.
- `>60`: más de 60 minutos.

El KPI acumulado `<60` considera únicamente valores menores a 60 minutos.

## Cálculos

`Creada en` es la fecha oficial de la orden. A partir de ella se generan en memoria
fecha, día de la semana, hora, semana y mes. También se calcula, cuando existen
los datos necesarios:

`Completada en - Creada en - Cooking Time`

Este resultado se denomina **Tiempo calculado Creación → Completado sin Cooking**
y se compara con el tiempo oficial. La diferencia con signo corresponde a tiempo
calculado menos tiempo oficial; también se calcula la diferencia absoluta.

## Validaciones

Si existen los indicadores originales `<45`, `<60` y `>60`, se comparan con la
clasificación calculada directamente desde el KPI oficial. Se informan coincidencias,
diferencias y porcentaje de registros inconsistentes sin corregir el archivo.

Los límites técnicos de diferencia están centralizados en `constants.js`:

- Hasta 1 minuto: Coincide.
- Más de 1 y hasta 5 minutos: Diferencia menor.
- Más de 5 y hasta 10 minutos: Revisar.
- Más de 10 minutos: Diferencia importante.

Una diferencia indica una validación pendiente y no confirma que el dato oficial
sea incorrecto.

## Tiempos por etapa

Cuando están disponibles se analizan aceptación, llegada a tienda, recolección,
entrega y finalización. Para cada etapa se presentan el total del universo,
órdenes con dato, órdenes con dato válido, registros inválidos, cobertura válida,
promedio y mediana. La cobertura se calcula como registros válidos entre el total
del universo de etapas. Los valores vacíos nunca se convierten en cero. Los
valores no numéricos, no finitos o negativos se contabilizan como inválidos y no
participan en el promedio ni la mediana. Los tiempos positivos altos permanecen
en el cálculo mientras no exista una regla de negocio aprobada que establezca un
máximo.

También se muestra un desglose por estatus. Cada promedio de ese desglose utiliza
únicamente los valores válidos disponibles para la etapa correspondiente.

La suma `Aceptación + Llegar a tienda + Recoger + Entregar` se compara con
`Tiempo total de envio` cuando todas las columnas tienen datos. `Tiempo para
completar` no forma parte de esta suma. También se compara el tiempo total con el
tiempo sin espera de restaurante y se usa `Tiempo para recoger` únicamente como
contexto cuando existe.

## Filtros

El dashboard permite filtrar por periodo, día, hora, Restaurant, Zona, Ciudad,
proveedor y Marca. Los mismos filtros se aplican por separado a ambos universos:
el KPI conserva únicamente órdenes COMPLETE y la sección de etapas conserva todos
los estatus. Marca se deshabilita y se informa como no disponible cuando la
columna no existe; no se infiere desde Restaurant.

## Exportación de resultados

El botón **Descargar análisis** genera localmente un archivo `.xlsx` con los
universos que muestran los filtros activos. El resumen, los desgloses principales,
las validaciones y la base analizada usan el universo KPI. La hoja `Tiempos por
etapa` usa de forma independiente el universo de etapas. El libro documenta la
fecha de generación, el archivo analizado, el periodo, los filtros utilizados,
los conteos de carga, los KPIs y el resumen ejecutivo.

Se generan las hojas `Resumen`, `Por fecha`, `Por hora`, `Por Restaurant`,
`Por Zona`, `Por Ciudad`, `Proveedores`, `Tiempos por etapa`, `Validación` y
`Base analizada`. Los desgloses reutilizan los mismos cálculos del dashboard y
la base incluye los valores originales necesarios junto con columnas auxiliares
claramente identificadas.

Las celdas vacías se conservan vacías y nunca se convierten en cero. Cuando una
columna opcional no existe, la hoja correspondiente informa que la información
no está disponible sin impedir la exportación de las demás hojas. SheetJS realiza
la lectura y ExcelJS genera el libro con formato visual; ambas copias son locales,
el proceso ocurre en memoria y no se envían datos a servicios externos.

El libro utiliza la identidad visual de Ambit, encabezados, formatos numéricos,
filtros, paneles inmovilizados, filas alternadas y escalas relativas de color para
facilitar la lectura. No incluye gráficos porque el generador local aprobado no
permite crearlos de forma fiable.

## Limitaciones conocidas

- Se analiza la primera hoja de los archivos Excel.
- Las columnas opcionales ausentes limitan solo su sección relacionada.
- Las fechas o duraciones con formatos no interpretables se omiten de los cálculos
  correspondientes y se notifican al usuario.
- Los archivos CSV admiten separadores por coma, punto y coma o tabulación.
- La base no se conserva al recargar la página y no se usa almacenamiento del
  navegador.
- No se infiere Marca ni se corrige automáticamente ningún dato de origen.
- Los umbrales de validación son técnicos y requieren aprobación antes de tratarse
  como reglas definitivas de negocio.
