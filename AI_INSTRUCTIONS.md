# AMBIT DATA STUDIO — INSTRUCCIONES PARA IA

## 1. Propósito del proyecto

Ambit Data Studio es un portal web interno para realizar análisis operativos a partir de archivos Excel y CSV.

El proyecto está diseñado para ser desarrollado y mantenido principalmente con ayuda de inteligencia artificial.

Por este motivo, cualquier IA que modifique este proyecto debe priorizar:

- simplicidad;
- estabilidad;
- código organizado;
- facilidad de mantenimiento;
- compatibilidad con futuras mejoras;
- protección de los datos procesados.

---

## 2. Privacidad de los datos

PRINCIPIO FUNDAMENTAL:

Los archivos operativos cargados por los usuarios deben procesarse LOCALMENTE en el navegador siempre que el módulo lo permita.

Los archivos cargados NO deben enviarse, almacenarse o copiarse automáticamente a:

- GitHub;
- servidores externos;
- APIs externas;
- servicios de almacenamiento;
- herramientas de analítica;
- bases de datos externas.

Nunca incluir información real de clientes, pedidos, restaurantes, empleados u operación dentro del código fuente.

Nunca guardar:

- contraseñas;
- tokens;
- API keys;
- credenciales;
- datos personales;
- bases operativas;

dentro del repositorio.

Si una funcionalidad futura requiere enviar o almacenar información fuera del dispositivo, debe indicarse claramente antes de implementarla.

---

## 3. Arquitectura

No construir toda la aplicación dentro de un único archivo HTML.

Mantener separados:

- estructura HTML;
- estilos CSS;
- lógica JavaScript;
- módulos de análisis;
- utilidades compartidas;
- recursos visuales.

Cada análisis debe construirse como un módulo independiente.

Ejemplos:

- Restaurant Billing
- Logística
- Cancelaciones
- Soporte
- Análisis de órdenes

Un cambio realizado en un módulo no debe alterar innecesariamente otros módulos.

---

## 4. Reglas antes de modificar código

Antes de realizar cualquier modificación:

1. Leer este archivo completo.
2. Leer PROJECT.md.
3. Identificar qué módulo será modificado.
4. Identificar qué archivos están relacionados.
5. Evitar cambios innecesarios fuera de ese módulo.
6. Conservar las funcionalidades existentes.
7. No cambiar nombres de columnas, reglas de negocio o cálculos sin autorización explícita.

---

## 5. Reglas después de modificar código

Después de cada modificación verificar:

- que el portal cargue correctamente;
- que no existan errores de JavaScript;
- que los módulos existentes continúen funcionando;
- que la carga de archivos funcione;
- que los cálculos produzcan los resultados esperados;
- que las descargas funcionen cuando correspondan;
- que no se hayan agregado conexiones externas innecesarias.

Actualizar PROJECT.md cuando se agregue o cambie una funcionalidad importante.

---

## 6. Experiencia del usuario

La persona administradora del proyecto no necesita conocimientos de programación.

Por lo tanto:

- evitar configuraciones técnicas innecesariamente complejas;
- mostrar errores en lenguaje comprensible;
- indicar claramente qué archivo debe cargarse;
- mostrar progreso durante procesos largos;
- evitar que un error borre el trabajo realizado;
- pedir confirmación cuando una acción pueda eliminar información;
- priorizar interfaces sencillas y profesionales.

---

## 7. Crecimiento del proyecto

El proyecto debe poder crecer gradualmente.

No agregar infraestructura, frameworks, bases de datos o servicios externos simplemente porque podrían ser útiles en el futuro.

Agregar nuevas tecnologías solamente cuando exista una necesidad concreta.

Priorizar inicialmente:

HTML + CSS + JavaScript

El proyecto debe mantenerse portable para que pueda migrarse a otro hosting o ser continuado por otra IA o desarrollador.

---

## 8. Control de cambios

Realizar cambios pequeños y claramente identificables.

No reemplazar grandes partes del proyecto cuando solamente se necesita modificar una función.

Cada cambio importante debe quedar documentado mediante commits claros en GitHub.

Si existe riesgo de romper una funcionalidad estable, conservar primero una versión funcional mediante Git.

---

## 9. Regla principal

Ambit Data Studio debe permanecer:

SEGURO + SIMPLE + MODULAR + PORTABLE + FÁCIL DE MEJORAR.
