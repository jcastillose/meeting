# Cuentas, recuperación y ampliación de consultas

## Uso

En `/admin`, «Olvidé mi contraseña» solicita un enlace válido durante 30 minutos y de un solo uso. La respuesta es genérica para no revelar qué correos tienen cuenta. Tras cambiar la contraseña se invalidan las sesiones de la aplicación. El original utiliza Supabase Auth; FAHU mantiene su autenticación independiente en el esquema `atmeet_fahu` y no modifica usuarios del portal VIP.

Remitentes: `atmeet@contact.agencements.net` y `atmeetfahu@contact.agencements.net`. Ambas pantallas recuerdan añadirlos a contactos o remitentes confiables. Resend usa las variables de servidor existentes; no se exponen claves al navegador.

## Permisos

| Acción | Administración | Gestión |
|---|---|---|
| Historial | Todas las consultas | Solo creadas con esa cuenta |
| Añadir días y horarios | Cualquier consulta | Solo propias |
| Eliminar | Todas | No |
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
