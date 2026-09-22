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

## Administración e historial (Netlify + Supabase)

Ejecutar `supabase/admin-setup.sql` una vez sobre la base existente. Es aditivo: conserva las consultas y sus respuestas. El panel `/admin` muestra todas las consultas, incluidas las anteriores, con búsqueda y paginación. Solo cuentas invitadas con `app_metadata.meeting_admin = true` pueden entrar. El permiso se comprueba contra Supabase en cada petición. Las cuentas públicas de Supabase no reciben ese permiso.

La primera invitación se provisiona por el propietario de la base: generar 32 bytes aleatorios en hexadecimal, insertar su SHA-256 en `meeting_admin_invitations.token_hash` con `email=''` y entregar al propietario `/admin#invite=TOKEN`. No guardar el token en GitHub. Las siguientes invitaciones se crean desde el panel para un correo concreto, vencen en siete días y se consumen de forma atómica. El administrador comparte el enlace; la aplicación no envía correos. La persona invitada elige su contraseña. Las contraseñas son administradas por Supabase Auth; nunca se guardan en las tablas de la aplicación.

Las sesiones duran ocho horas y usan cookies HttpOnly, Secure en HTTPS y SameSite=Strict. Solo se almacena el hash de la sesión en la base. Cerrar sesión elimina la sesión; cambiar contraseña cierra las demás. Para revocar una cuenta desde Supabase, quitar `meeting_admin` de sus metadatos de aplicación o eliminarla. No habilitar políticas de acceso público para las tablas de administración: solo las funciones del servidor acceden a ellas.

Los enlaces compartidos usan `/r/titulo~codigo`. El código codifica el identificador aleatorio completo de 128 bits, de modo que títulos iguales no colisionan y los enlaces no son consecutivos. Los enlaces antiguos `/?p=...` siguen funcionando, sin cambiar las respuestas ni los permisos de edición del navegador.

Pruebas de administración: compilar `scripts/test-admin.mjs` con esbuild para Node y ejecutar el resultado. Comprueban permisos, cookies, origen, invitaciones de un uso, cierre de sesión y compatibilidad de enlaces.
