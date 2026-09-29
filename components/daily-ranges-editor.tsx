"use client";
import { useId, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyRange } from "@/lib/domain";
import { scheduleErrors } from "@/lib/schedule";
import { WrittenRanges } from "./scheduling/written-ranges";
import { VisualSchedule } from "./scheduling/visual-schedule";
import "./scheduling/schedule-editor.css";
export type DailyRangesEditorProps = {
  ranges: DailyRange[];
  step: number;
  duration?: number;
  onChange: (ranges: DailyRange[]) => void;
  disabled?: boolean;
};
/** Controlled editor: the parent owns the draft; neither view sends network requests. */
export function DailyRangesEditor({
  ranges,
  step,
  duration = step,
  onChange,
  disabled = false,
}: DailyRangesEditorProps) {
  const id = useId();
  const errors = useMemo(
    () => scheduleErrors(ranges, step, duration),
    [ranges, step, duration],
  );
  return (
    <fieldset
      className="schedule-editor"
      disabled={disabled}
      aria-describedby={id + "-description"}
      aria-busy={disabled}
    >
      <legend>Días y horarios propuestos</legend>
      <p id={id + "-description"} className="schedule-help">
        Escribe tus tramos o márcalos en el calendario. Puedes proponer varios
        horarios por fecha y dejar pausas entre ellos.
      </p>
      <Tabs defaultValue="written">
        <TabsList aria-label="Forma de editar horarios">
          <TabsTrigger value="written">Escribir horarios</TabsTrigger>
          <TabsTrigger value="visual">Calendario visual</TabsTrigger>
        </TabsList>
        <TabsContent value="written">
          <WrittenRanges
            ranges={ranges}
            step={step}
            onChange={onChange}
            disabled={disabled}
          />
        </TabsContent>
        <TabsContent value="visual">
          <VisualSchedule
            ranges={ranges}
            step={step}
            onChange={onChange}
            disabled={disabled}
          />
        </TabsContent>
      </Tabs>
      <div aria-live="polite" className="schedule-validation">
        {errors.length ? (
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <p>
            Horarios válidos · {new Set(ranges.map((r) => r.date)).size} fechas
            · Reunión de {duration} minutos.
          </p>
        )}
      </div>
    </fieldset>
  );
}
