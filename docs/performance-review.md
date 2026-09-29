# Revisión de rendimiento — at meet y at meet FAHU

Fecha: 29 de septiembre de 2026. Alcance: calendario público, coincidencias, refresco de respuestas y entrada de rutas. Ambas variantes comparten estas optimizaciones. No se modificaron tablas, políticas, autenticación ni el portal VIP.

## Problemas y solución aplicada

| Hallazgo en el código anterior | Cambio | Efecto y límite |
|---|---|---|
| Cada casilla recorría participantes para contar, excluir al propio usuario y construir listas de nombres | `indexVotes` agrega contadores una vez cuando cambian las respuestas; consulta por clave y resta de la respuesta propia | O(preferencias registradas) al recibir datos; O(1) por conteo en el render. Memoria adicional O(bloques), sin duplicar nombres por bloque |
| JSX de nombres de todos los tooltips construido aunque estuvieran cerrados | `SlotPeople` se ejecuta dentro del contenido de Radix cuando se abre | Las listas solo se preparan para el tooltip montado; no se crean miles de elementos de nombres por pulsación |
| Formulario y calendario compartían renders, incluidos todos sus botones | `CalendarSlot` con `memo`, propiedades estables y callbacks estables | Cambiar nombre/comentario no vuelve a ejecutar las casillas; seleccionar afecta las casillas modificadas. El contenedor todavía recorre las posiciones visibles |
| Ranking volvía a formar arrays de duración para cada candidato y persona | Ventana móvil de contadores no/maybe/missing, por día y persona | De O(S·V·D) a O(S·V), más ordenación. Conserva prioridad de ocupado sobre incompleto, pausas, duración y desempates |
| Formateadores de fecha y conjuntos reconstruidos durante renders | Un `Intl.DateTimeFormat` reutilizado y memoización de horarios/conjuntos | Menos objetos temporales y trabajo al escribir |
| Respuestas idénticas de polling invalidaban todas las memorias | Mantener referencias cuando el contenido serializado no cambia | Evita recalcular ranking e índice; la comparación sigue siendo O(tamaño de respuesta) y asigna strings transitorios |
| Polling en pestañas ocultas y peticiones solapadas | Pausa por visibilidad; una consulta de refresco en vuelo; desfase de 0–5 s; cancelación al desmontar/reemplazar | Menos solicitudes ociosas y respuestas obsoletas. Una petición ya iniciada puede terminar al ocultar la pestaña |
| Listeners y carga inicial ligados a una bandera que podía impedir el segundo montaje de efectos | Separación práctica de inicialización y limpieza; reinicio de la bandera al limpiar | Compatible con repetición de efectos en StrictMode y cancelación de fetch |
| Administración y Gestión en el paquete inicial | Importación dinámica de esas rutas, Suspense y recuperación de error | Reducción modesta del paquete público. Home continúa estático para evitar una cadena de descarga adicional |
| WebMCP reconstruía las claves válidas por cada clave solicitada | Un conjunto por operación | O(S+K), en lugar de O(S·K) |

## Resultados reproducibles

`npm run test:scheduling` incluye `scripts/test-performance.mjs`. Usa semilla fija, comprueba igualdad completa con el algoritmo anterior y mide mediana de tres iteraciones tras una de calentamiento. Sin red ni datos personales. No es una prueba de concurrencia ni de latencia de producción.

Escenario de estrés: 61 días, 1.464 bloques, 300 participantes, reuniones de 180 minutos. Los 300 participantes superan deliberadamente el límite actual de 200 respuestas por consulta.

| Medición local | Antes | Después |
|---|---:|---:|
| Ranking, primera ejecución de referencia | 364,84 ms | 43,87 ms |
| Ranking, ejecución posterior con las dos compilaciones en paralelo | 371,97 ms | 48,63 ms |
| Recorrido de conteos de 1.464 casillas, ejecución posterior | 49,91 ms | 0,05 ms |
| Construcción del índice cuando cambian respuestas | — | 42,86 ms |
| JavaScript inicial público, compilación original | 454,29 kB | 442,42 kB |
| JavaScript inicial público gzip | 138,93 kB | 136,99 kB |

La mejora de conteos no es gratuita: hay que sumar la construcción del índice cuando llegan respuestas nuevas. Su principal beneficio es reutilizarlo durante selección, escritura y navegación. La reducción del paquete es pequeña (~2,6% sin comprimir); no se presenta como una mejora drástica de carga.

No se midió heap retenido, INP/LCP de usuarios reales ni capacidad del backend. No se encontró evidencia suficiente para afirmar una fuga sostenida de memoria; sí asignaciones evitables y peticiones pendientes sin cancelación. Estas afirmaciones deben distinguirse.

## Código y uso

- `lib/domain.ts`: ranking por ventana móvil, mismas entradas y salidas.
- `lib/vote-index.ts`: agregación pura sin dependencias de red.
- `components/performance/calendar-slot.tsx`: casilla memoizada y eventos de selección.
- `components/performance/slot-people.tsx`: listas bajo demanda.
- `app/page.tsx`: coordinación, preservación de referencias y ciclo de refresco.
- `portable/main.tsx`: división de rutas y recuperación de errores de carga.

```tsx
const indexed = useMemo(() => indexVotes(votes), [votes]);
const summary = indexed.get(slotKey) ?? EMPTY_COUNTS;
// No mutar summary: pertenece al índice compartido.
// Para excluir a la persona actual, restar su estado guardado de una copia.
```

No usar comparadores personalizados que ignoren callbacks: pueden conservar closures obsoletos. La memoización implementada usa la comparación normal de React y callbacks con dependencias explícitas.

## Escalabilidad pendiente, por prioridad

1. **Medir antes de ampliar capacidad.** Instrumentar latencia p50/p95/p99, INP/LCP, errores, tamaño de respuestas, invocaciones y CPU/DB por consulta. Evitar registrar nombres, correos, tokens o preferencias. Definir presupuestos por escenario y probarlos en staging con datos sintéticos.
2. **Lecturas incrementales.** El GET actual devuelve la consulta y todas sus respuestas; el PUT consulta respuestas para comprobar el límite de 200. Diseñar revisión monotónica por consulta, endpoint de cambios y agregados de conteos; recuperar nombres por bloque bajo demanda. ETag solo ahorra ancho de banda si el servidor evita también releer/calcular el cuerpo. Conservar el contrato público y autorización del creador.
3. **Notificaciones y concurrencia.** Evaluar eventos de actualización por consulta o polling adaptativo con backoff. Un millón de pestañas activas a 30 s representa unas 33.333 solicitudes/s: la pausa de pestañas ocultas no resuelve por sí sola esa escala. Separar correos en cola idempotente con reintentos y métricas de entrega.
4. **Base de datos.** Revisar planes reales e índices usados por `poll_id` y orden de respuestas, comprobar límites de filas configurados y contadores atómicos; no elevar indiscriminadamente el límite de 200. Para consultas masivas, paginar y agregar en servidor. No aplicar índices/migraciones sin examinar esquema y carga, especialmente en la base compartida con VIP.
5. **Renderizado de consultas extensas.** La solicitud previa exige mostrar todas las semanas. Mantener esa experiencia; considerar `content-visibility` o virtualización accesible tras medir y probar búsqueda, foco y lector de pantalla. Las listas de participantes y el DOM de semanas aún crecen con el contenido.
6. **CPU fuera del hilo principal cuando corresponda.** Un Worker para ranking solo si el perfil de dispositivos lentos lo justifica; transferir únicamente datos necesarios y versionar/cancelar cálculos obsoletos. La serialización también cuesta.
7. **Protección operativa.** Límites de solicitudes por ruta, presupuesto de funciones y conexiones, caché de agregados por consulta con invalidación, despliegue gradual y reversión. No almacenar respuestas privadas en cachés públicas compartidas por accidente.

## Comprobaciones

TypeScript, compilación de ambas variantes y suites de horarios, API en memoria, exportación y rendimiento. El ranking optimizado se compara con el anterior en fechas, semana habitual, días del mes, bloques 30/60, varias duraciones y fechas discontinuas. Revisión en navegador local de selección/desmarcado, conteos y coincidencias con cuatro participantes sintéticos. No se crearon consultas ni se enviaron correos de prueba en producción.

Recomendado antes de tráfico masivo: perfil de heap con ciclos de montar/desmontar, React Profiler, pruebas de red lenta/fallos, pruebas reales de lector de pantalla y carga de backend en staging. Esta implementación reduce costes identificados; no certifica capacidad para millones de usuarios concurrentes.

## Referencias oficiales

- [React memo: estabilidad de props y uso selectivo](https://react.dev/reference/react/memo)
- [Page Visibility API: pausa de trabajo en pestañas ocultas](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [Supabase select: límites de resultados y paginación](https://supabase.com/docs/reference/javascript/select)
