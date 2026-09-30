# Verificación de ambas plataformas — 30 septiembre 2026

Aplicaciones: https://atmeet.netlify.app y https://atmeetfahu.netlify.app.

| Funcionalidad | Verificación |
|---|---|
| Creación con fechas, semana/mes habitual y horarios por día | Suite de reglas, validación API y editores compartidos |
| Edición escrita y visual sincronizada | Prueba de interfaz: cambiar inicio por escrito y añadir un bloque en calendario |
| Preferencias independientes, duración, coincidencias y exportación | Suites de votación, duración completa, ranking y calendario UTC/DST |
| Cuentas de administración y gestión | Pruebas de API y SQL: gestor solo propias; admin todas |
| Invitación, recuperación y solicitudes | Suites de invitación, tokens de un uso, expiración, aprobación y avisos |
| Ampliación y sustitución de propuestas | Pruebas de propietario, conflicto de revisión y validación |
| Conservación de respuestas | Prueba SQL con service_role: conservar bloques vigentes y archivar los retirados |
| Cierre y notificación del evento seleccionado | Pruebas de cierre, fecha concreta y rechazo de revisión obsoleta |
| Google Calendar y Calendario macOS | Pruebas de enlace, ICS confirmado, zona horaria y privacidad del correo |
| Avisos de cambios y solicitudes | Pruebas de reintentos, acuses parciales y claves de idempotencia estables |
| Adaptación a teléfono | Editor y revisión inspeccionados a 390 × 844; el diálogo permite desplazamiento |
| Supabase | Migraciones aplicadas y probadas con rollback; nuevas tablas con RLS y acceso solo de servidor |

La copia FAHU utiliza únicamente atmeet_fahu dentro del proyecto compartido. Las comprobaciones de base de datos revierten sus fixtures. Los envíos se prueban mediante dobles del proveedor; esta revisión no comprueba recepción en una bandeja real. Los despliegues se verifican mediante los archivos publicados y controles de API sin modificar consultas reales.

El aviso de Supabase «RLS enabled, no policy» en tablas privadas es intencional: los roles públicos carecen de privilegios y toda operación pasa por el servidor. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
