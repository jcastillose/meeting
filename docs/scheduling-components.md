# Editor de horarios de at meet

## Alcance y arquitectura implementada

Esta refactorización modulariza la creación de consultas y el editor de horarios. La página principal conserva la coordinación de carga, respuestas y navegación; no se ha reescrito toda la aplicación ni se ha probado una carga de millones de usuarios.

```text
Home (estado de consulta y persistencia)
└── PollCreationDialog (formulario, envío, errores y estado ocupado)
    └── DailyRangesEditor (componente controlado, pestañas y validación)
        ├── WrittenRanges (fechas y varios tramos por fecha)
        │   └── TimeField (texto HH:MM, estados intermedios y errores)
        └── VisualSchedule (semana, bloques y navegación por teclado)

lib/schedule.ts → reglas puras compartidas por interfaz y API
lib/domain.ts   → días únicos, bloques válidos y coincidencias continuas
lib/api.ts      → validación de entrada y normalización antes de guardar
```

El componente visual no conoce Supabase, Resend ni las marcas de los sitios. La ventana recibe `notificationEmail`; cada plataforma conserva su remitente. No cambia el almacenamiento ni la autenticación.

## Contrato reutilizable

```tsx
import {useState} from 'react';
import {DailyRangesEditor} from '@/components/daily-ranges-editor';
import {scheduleErrors} from '@/lib/schedule';
import type {DailyRange} from '@/lib/domain';

function ScheduleExample() {
  const [ranges, setRanges] = useState<DailyRange[]>([
    {date: '2026-10-05', from: 540, to: 720},
    {date: '2026-10-05', from: 900, to: 1080},
  ]);
  const [saving, setSaving] = useState(false);
  const errors = scheduleErrors(ranges, 30, 60);

  return <>
    <DailyRangesEditor ranges={ranges} onChange={setRanges}
      step={30} duration={60} disabled={saving}/>
    <button disabled={saving || errors.length > 0}
      onClick={async () => {
        setSaving(true);
        try { /* Enviar la consulta completa mediante la API de la app. */ }
        finally { setSaving(false); }
      }}>Guardar</button>
  </>;
}
```

`ranges` es el único estado persistible. `onChange` devuelve una lista nueva. Las vistas guardan únicamente estado de presentación (semana visible, pestaña, foco y texto parcial). `step` admite 30 o 60 minutos; `duration` debe ser un múltiplo del bloque. `disabled` bloquea la interacción durante el envío.

## Reglas y casos límite

- Minutos locales desde medianoche: 0–1440; 24:00 solo como fin.
- Máximo 62 días de extensión y 256 tramos. Los días pueden ser discontinuos.
- Varios tramos por fecha; se rechazan solapamientos escritos. Los tramos adyacentes se unen al guardar.
- La selección visual divide un tramo si se desmarca un bloque intermedio, sin seleccionar automáticamente las pausas.
- Una reunión debe caber íntegramente dentro de un tramo continuo. Las coincidencias y los archivos de calendario no atraviesan pausas.
- Un borrador vacío o parcialmente escrito es editable, pero no se puede enviar. El servidor vuelve a validar los datos.
- Las consultas anteriores sin `dailyRanges` siguen usando su rango común.
- Al cambiar el tamaño de bloque, las horas incompatibles muestran errores; no se redondean ni se pierden silenciosamente.

## Accesibilidad y responsive

- Etiquetas explícitas, `fieldset`/`legend`, pestañas de Radix y mensajes de estado con `aria-live`.
- Edición escrita completa como alternativa al calendario. Errores asociados a los campos y resumen visible.
- Cuadrícula con un único punto de tabulación: flechas, Inicio/Fin y Enter/Espacio. Tab permite salir de la cuadrícula sin recorrer cientos de botones.
- Estado seleccionado expresado con marca ✓ y `aria-pressed`, además del color.
- Indicador visible de foco, controles de calendario de 44 px y cabeceras fijas.
- En móvil, campos en dos columnas, fecha a todo el ancho y calendario con desplazamiento horizontal interno; no se comprime cada día hasta hacerlo ilegible.
- El estado ocupado bloquea el formulario y evita cerrar el diálogo durante el envío. Los errores de red conservan el borrador.

## Verificación y mantenimiento

```sh
npm run typecheck
npm run test:scheduling
npm run build:netlify
```

Las pruebas cubren dividir/unir bloques, varios tramos por fecha, normalización, límites, validación del servidor, conversión reversible de bloques, coincidencias que no cruzan pausas, modos anteriores y exportación con zonas horarias/cambios de hora. Las pruebas usan almacenamiento en memoria, sin enviar correos ni crear consultas de producción.

Mantener las reglas de negocio en `lib/schedule.ts`; no duplicarlas por vista o por marca. No guardar cada clic en el servidor: editar localmente y enviar una sola consulta validada. Mantener el DOM del editor acotado a una semana (hasta 336 bloques) en lugar de renderizar todos los días del período. Separar cambios de identidad de cambios funcionales al sincronizar ambas plataformas.

Antes de afirmar capacidad para millones de usuarios, medir concurrencia de funciones, base de datos, límites del proveedor, latencia, telemetría y rendimiento real. Este cambio mejora los límites del componente; no elimina los límites operativos del servicio ni sustituye pruebas de carga. Recomendado complementar la revisión de teclado y móvil con lectores de pantalla reales y auditoría automatizada continua.
