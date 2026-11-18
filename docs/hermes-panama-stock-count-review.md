# Revisión del conteo de Panamá

Base: versión publicada `ffb1c24a125add2120f2e6b9fe17e84459486f3a`.

En **Inventario → Revisar conteo**, Almacén con recepción habilitada y Gerencia
pueden descargar la plantilla CSV, seleccionar el conteo y descargar observaciones.
El archivo se analiza en el navegador; no se sube, no se guarda como borrador en
Hermes y no ejecuta altas, ajustes, reservas, compras ni aprobaciones.
Conservar el archivo original y el informe descargado. Salir de la página,
cambiar de cuenta o cambiar el alcance retira el archivo de esa revisión.

## Qué valida

Hasta 500 filas / 1 MB, CSV UTF-8 con coma, punto y coma o tabulador, campos
entre comillas y descripciones multilínea. Identifica fila de origen, columnas
faltantes, cantidades negativas/ambiguas, exceso de precisión, duplicados por
SKU/almacén, definiciones contradictorias del mismo SKU, fechas inválidas o
futuras, país/proyecto distintos y falta de revisión independiente.

Las cantidades usan punto decimal, sin separador de miles y hasta tres decimales.
La comparación usa aritmética decimal exacta. Un conteo cero declarado es válido;
una existencia desconocida sigue como «Sin base». Los saldos no se suman entre
unidades de medida distintas y no se convierten monedas automáticamente.

La comparación usa exclusivamente `inventory-stock` con la sesión actual.
No amplía la consulta a equipos o proyectos fuera de su alcance. Una cuenta con
alcance parcial recibe la advertencia correspondiente. Un SKU ausente en esa
consulta no se acredita como único ni como existencia cero en todo el catálogo.

Un fallo o actualización retira la comparación anterior mientras se consulta de
nuevo. El archivo sigue disponible para reintentar dentro de la misma página.
El informe identifica el nombre/hash SHA-256 del archivo y el momento de la
consulta, no una fecha de sincronización o una certificación de existencias.
Conciliar los movimientos posteriores al conteo antes de una carga autorizada.

Las referencias, nombres y costos escritos en el archivo son declaraciones por
verificar. No acreditan firmas ni facultades. Almacén y Finanzas conservan la
validación del conteo, su valuación y el ajuste autorizado. No hay botón de
«Aplicar saldos» ni nuevos privilegios en esta entrega.

El aviso de privacidad conserva su contenido y las opciones de aceptación y
cierre temporal; ahora sus controles tienen 44 px y el panel tiene altura
limitada y desplazamiento interno para texto ampliado o teclado.

## Verificación

`src/lib/panama-stock-count.test.ts` verifica cantidades exactas, duplicados,
CSV, alcance, fuentes ausentes, reservas, monedas, documentos faltantes y
neutralización de fórmulas en la exportación.

```sh
HERMES_QA_CHROMIUM_EXECUTABLE=/ruta/chromium HERMES_QA_EVIDENCE=/ruta/evidencia node scripts/qa-rollout/verify-panama-stock-review.mjs
```

El ensayo aislado usa cuentas ficticias de Gerencia y del rol real `almacen`,
anchos 320/360/390/412, texto al 200 %, altura reducida para simular teclado,
fallo/reintento de la consulta, tres descargas y comprobación de cero escrituras
de negocio. No sustituye prueba de personal con datos reales ni un conteo físico.

No hay migraciones ni modificaciones de personas, cantidades o permisos reales.
Reversión: despliegue `dpl_H91W2uezEh8aWtUeEnmUdCee4NT4`, commit `ffb1c24`,
únicamente en el proyecto `hermes-panama`. La configuración de acceso individual
y protección de vistas de prueba se conserva.
