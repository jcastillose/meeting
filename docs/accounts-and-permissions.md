# Cuentas, recuperación y ampliación de consultas

## Uso

En `/admin`, «Olvidé mi contraseña» solicita un enlace válido durante 30 minutos y de un solo uso. La respuesta es genérica para no revelar qué correos tienen cuenta. Tras cambiar la contraseña se invalidan las sesiones de la aplicación. El original utiliza Supabase Auth; FAHU mantiene su autenticación independiente en el esquema `atmeet_fahu` y no modifica usuarios del portal VIP.

Remitentes: `atmeet@contact.agencements.net` y `atmeetfahu@contact.agencements.net`. Ambas pantallas recuerdan añadirlos a contactos o remitentes confiables. Resend usa las variables de servidor existentes; no se exponen claves al navegador.

## Permisos

| Acción | Administración | Gestión |
|---|---|---|
| Historial | Todas las consultas | Solo creadas con esa cuenta |
| Añadir días y horarios | Cualquier consulta | Solo propias |
| Eliminar | Todas | Solo propias |
| Invitar cuentas | Administración o gestión | No |
| Recuperar/cambiar contraseña | Propia | Propia |

Las cuentas existentes mantienen administración. Las invitaciones nuevas seleccionan Gestión por defecto. El tipo se almacena en la invitación y se consume atómicamente; el destinatario no puede elegir un rol distinto al activarla. Los roles se comprueban en cada petición, no solo en la interfaz.

Para vincular una consulta, iniciar sesión y después crearla. El servidor obtiene el identificador de la sesión y fuerza el correo del creador al de esa cuenta. Un `ownerId` enviado por el navegador se ignora. Los visitantes pueden continuar creando y respondiendo sin cuenta.

Las consultas antiguas sin `ownerId` no se asignan automáticamente por coincidencia de correo, porque ese correo histórico no acredita propiedad. Administración puede verlas y ampliarlas; el enlace privado de creador sigue funcionando. No se vincularon consultas retroactivamente.

## Ampliación

En el historial, «Añadir días u horarios» abre el editor escrito/visual para fechas concretas. Los tramos nuevos se unen a los anteriores; nunca eliminan bloques, cambian su zona horaria, tamaño, duración o significado. Se conservan respuestas y enlaces. Los bloques nuevos quedan sin respuesta.

En semana o mes habitual ya están disponibles los siete días o los días 1–31; se amplía el horario común. Una consulta cerrada permanece cerrada. El límite sigue siendo 62 días de extensión y 256 tramos. Se usa una revisión de agenda y un bloqueo de fila para impedir que dos ampliaciones sobrescriban cambios.

## Implementación y despliegue

- `supabase/account-roles.sql`: migración aditiva, distinta por plataforma. Ejecutar antes de publicar el servidor.
- `lib/admin-server.ts`: sesión, roles, invitaciones, recuperación y ampliación autorizada.
- `netlify/functions/api.ts`: asociación de una nueva consulta con la sesión.
- `lib/schedule-extension.ts`: reglas de ampliación pura y preservación de bloques.
- `components/scheduling/schedule-extension-dialog.tsx`: editor reutilizable.
- `scripts/test-account-roles.mjs`: permisos, propietario, manipulación de payload, conflictos y recuperación original.
- `scripts/test-admin.mjs`: regresión de sesiones e invitaciones; incluye recuperación FAHU.
- `supabase/test-account-roles.sql`: prueba transaccional con fixtures y rollback; reemplaza temporalmente el resolvedor de roles dentro de esa transacción y lo restaura con rollback. No ejecutar parcialmente ni eliminar el rollback.

Las RPC nuevas solo permiten ejecución a `service_role`, usan `SECURITY INVOKER` y comprueban propiedad/rol. La tabla nueva de recuperación original tiene RLS activado y carece de acceso de clientes. El hash de gestión y la identidad propietaria no aparecen en respuestas públicas.

Pruebas locales no envían correos reales ni crean cuentas en producción. El asesor de seguridad del original informa RLS sin políticas (intencional para tablas exclusivas de servidor) y una advertencia previa de protección de contraseñas filtradas desactivada. [Documentación de esa protección](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se cambió la configuración comercial o de Auth asociada a esa opción.

## Cierre y horario confirmado desde la cuenta

En Administración, «Gestionar y notificar» abre la consulta usando la sesión actual. Administración puede gestionar todas; Gestión solo las creadas con su cuenta. Se puede seleccionar un bloque válido para la duración de la reunión y confirmar el cierre. Para propuestas abstractas de semana/mes, se exige además una fecha real que corresponda al día propuesto. El horario y zona horaria quedan guardados.

Después del cierre, la vista previa del mensaje incluye el horario confirmado. El envío individual oculta los correos de los demás participantes, omite respuestas antiguas sin correo y rechaza una vista previa cuyo horario quedó desactualizado. La confirmación del cierre no envía el correo automáticamente.

Aplicar también `supabase/account-management.sql` después de `account-roles.sql`, antes de publicar. Las pruebas `scripts/test-management.mjs` usan correo simulado; `supabase/test-account-roles.sql` verifica los permisos dentro de una transacción que se revierte.

### Corrección del límite entre Auth y la base de aplicación

`recovery-auth-boundary.sql` evita consultas directas de las funciones de aplicación a `auth.users`. El servidor verifica el usuario mediante Auth Admin API y sincroniza únicamente ID, correo, rol y versión en `meeting_accounts`, con RLS y acceso exclusivo de servidor. No se copian contraseñas ni sus hashes. Los cambios de versión invalidan enlaces antiguos. Ejecutar `test-recovery-service-role.sql` con el rol real `service_role`; probar solo como `postgres` no detecta este tipo de fallo.

## Solicitudes de cuenta

En Administración, sin sesión, «Solicitar cuenta de gestión» recoge nombre, correo y mensaje opcional. La solicitud no concede acceso ni permite elegir privilegios. Administración ve una bandeja paginada, elige Gestión o Administración y confirma la aprobación o el rechazo. Al aprobar se genera una invitación de siete días y se envía al correo registrado, usando el remitente de cada sitio. Si falla el envío, se muestra el enlace privado para compartirlo manualmente.

El correo se verifica al utilizar la invitación. Las solicitudes no deben considerarse identidad verificada al revisarlas. Se deduplican por correo, no se sobrescriben decisiones anteriores y la bandeja pendiente está limitada a 1.000 registros. Un campo trampa filtra envíos automatizados simples. Para exposición a mayor tráfico, añadir un límite por IP en el proveedor de despliegue o un desafío antispam.

La decisión y la invitación se guardan en una misma transacción con bloqueo de fila para impedir dobles aprobaciones. Solo el servidor puede acceder a las tablas y funciones. Gestión puede eliminar consultas propias mediante `meeting_account_delete_poll`, que verifica rol y propietario y borra consulta y respuestas atómicamente. Las consultas antiguas sin propietario siguen reservadas a Administración.

Aplicar `supabase/account-requests.sql` antes del despliegue. Validación: `scripts/test-account-requests.mjs`, pruebas de roles y `supabase/test-account-requests.sql` bajo el rol real `service_role`, dentro de una transacción revertida. No se crean cuentas ni se envían correos reales en las pruebas.


### Correos de solicitudes y confirmación
Las solicitudes pendientes avisan exclusivamente a administradores activos; cada destinatario recibe su propio correo. Se guardan acuses por destinatario y una reserva atómica evita ejecuciones concurrentes. Un trabajador de Netlify revisa la cola cada 15 minutos, con hasta seis intentos dentro de 23 horas; los errores quedan registrados en los logs y la solicitud permanece disponible en Administración. Aplicar `supabase/request-notifications.sql` antes de desplegar.

En Gestión, seleccionar el horario definitivo (y una fecha concreta para consultas habituales), confirmar el cierre y revisar el mensaje. El correo incluye título, fecha, duración y zona horaria, un enlace de Google Calendar y descarga .ics compatible con Calendario de macOS. Cada participante confirma la incorporación en su calendario. No se comparten correos de otras personas ni enlaces privados de gestión.
