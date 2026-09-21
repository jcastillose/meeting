# Encuentro

Plataforma en español para encontrar horarios comunes. Permite consultas por fechas concretas (máximo 62 días), semana habitual y días 1–31 de un mes habitual; vistas de semana y mes; bloques de 30/60 minutos; respuestas con nombre y comentario; disponibilidad, alternativa y ocupado; comparación y borrador en Google Calendar.

## Funcionamiento y privacidad

Cada consulta tiene un identificador aleatorio de 128 bits. Quien conoce el enlace puede leer nombres, preferencias y comentarios. No se publican índices ni listados de consultas. No equivale a autenticación: no usar para información sensible. Cada navegador conserva un secreto aleatorio para actualizar exclusivamente su propia respuesta; el servidor almacena solo su hash. Perder los datos del navegador pierde esa capacidad de edición. Los nombres no se verifican y distintas personas pueden usar el mismo nombre. Las respuestas se actualizan cada 30 segundos y al volver a la pestaña. Los bloques vacíos significan «Sin respuesta».

Todos responden en la zona horaria de la consulta, visible en pantalla. La semana y el mes habitual no se convierten automáticamente en eventos. La comparación ordena primero por menos ocupados, luego menos respuestas faltantes, y después más disponibles; las alternativas se muestran separadas. El enlace Google Calendar abre un borrador, no lee calendarios ni crea eventos automáticamente.

## Publicación actual: Sites

React y Vinext con API y almacenamiento compartido D1. No se necesitan cuentas Supabase o Netlify para esta publicación. `npm ci`, `npm run db:generate` después de cambios de esquema, y `npm run build`. El manifiesto `.openai/hosting.json` declara DB; Sites aplica las migraciones de `drizzle/` al publicar.

## GitHub + Netlify + Supabase (alternativa preparada)

1. Crear un repositorio privado en GitHub y subir este proyecto, excluyendo secretos y carpetas de compilación. Mantener package-lock.json. No se ha creado un repositorio en la cuenta del usuario.
2. En un proyecto Supabase nuevo, ejecutar `supabase/schema.sql`. RLS está habilitado sin acceso público directo.
3. Importar el repositorio en Netlify. `netlify.toml` configura la compilación Vite y las funciones. Node 22.13 o superior.
4. Configurar **solo como variables de servidor de Netlify** `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Nunca usar un prefijo VITE_ para la clave, ni guardarla en GitHub o en el navegador.
5. Desplegar y probar crear consulta, compartir enlace en otro navegador, guardar dos respuestas y editar cada una. No requiere OAuth de Google para abrir borradores.

La alternativa usa la misma UI, validación y lógica de consultas; cambia el adaptador de almacenamiento por REST de Supabase desde una función de Netlify. El almacenamiento Supabase y la publicación Netlify necesitan cuentas y configuración propias; no quedan conectados por instalar un plugin. La sincronización automática de calendarios requiere un cliente OAuth y consentimiento por participante y no está implementada.

## Comprobaciones

`npx tsc --noEmit`, `npm run build` y `npx vite build --config vite.netlify.ts`. Los casos funcionales de API se prueban contra una base local temporal. Máximo 200 respuestas por consulta. Para una operación pública a gran escala añadir controles de abuso y retención según necesidades.
