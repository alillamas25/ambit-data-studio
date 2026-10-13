# Uber Cash

Módulo local para conciliar la primera hoja de un archivo Excel (fuente Uber) con
la segunda hoja (fuente interna).

La clave técnica convierte `workflow_uuid` a texto, elimina guiones y normaliza
mayúsculas. Los valores originales se conservan y no existe fuzzy matching.

Los UUID duplicados se reportan en Calidad y no se agregan ni se resuelven de
forma automática. El cash es comparable únicamente cuando ambos valores son
numéricos y finitos. Una diferencia absoluta de hasta `$0.01` se considera
coincidente para evitar ruido de precisión decimal.

La capa financiera calcula `cash interno numérico - cash Uber numérico`. Un resultado
positivo indica que la información interna registra más cash que el archivo Uber.
Los registros sin importe comparable se muestran por separado y nunca se convierten
en cero.

Dashboard y Excel consumen el mismo objeto analítico. La exportación incluye solo
`Detalle_Diferencia` y `Conciliadas`. La primera hoja abre con un encabezado financiero
compacto, continúa con las órdenes que forman la diferencia neta y separa después los
registros Uber cuyo importe no puede cuantificarse. La descarga se bloquea si el total,
el detalle, la composición o el resumen interno por sucursal no reconcilian.
