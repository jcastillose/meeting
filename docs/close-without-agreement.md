# Cierre de consulta sin acuerdo de horario

Desde «Gestionar consulta», una persona con el enlace privado o una cuenta con acceso puede elegir **Cerrar sin acuerdo de horario**. Tras confirmar, se conservan las respuestas, se bloquean nuevas preferencias y la consulta pública indica que terminó sin acuerdo. No se selecciona un evento.

El cierre prepara en «Notificar al grupo» un correo revisable. Quien gestiona la consulta debe pulsar **Enviar al grupo** para enviarlo a los participantes que registraron un correo válido. El asunto y el cuerpo del correo identifican obligatoriamente el cierre sin acuerdo, incluso si se edita el texto opcional. No se generan enlaces de Google Calendar ni archivos .ics.

Una cuenta de Administración o Gestión autorizada puede reabrir la consulta. Esto retira el resultado «sin acuerdo» sin borrar las respuestas. Si se cambian las propuestas horarias con reapertura, el resultado también se retira. Una consulta con horario ya confirmado debe reabrirse antes de cerrarla sin acuerdo.

Para actualizar una instalación existente, aplicar `supabase/close-without-agreement.sql` solo en el proyecto correspondiente. La versión FAHU toca exclusivamente el esquema `atmeet_fahu` de la base compartida. `supabase/test-close-without-agreement.sql` comprueba el flujo dentro de una transacción que se revierte.
