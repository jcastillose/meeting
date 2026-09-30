"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DailyRangesEditor } from "@/components/daily-ranges-editor";
import { TimeField } from "./time-field";
import { extendSchedule } from "@/lib/schedule-extension";
import { today, type Poll, type DailyRange } from "@/lib/domain";
type Extension = {
  id: string;
  revision: number;
  ranges?: DailyRange[];
  from?: number;
  to?: number;
};
export function ScheduleExtensionDialog({
  poll,
  onClose,
  onSave,
}: {
  poll: Poll | null;
  onClose: () => void;
  onSave: (body: Extension) => Promise<void>;
}) {
  const [ranges, setRanges] = useState<DailyRange[]>([]),
    [from, setFrom] = useState(540),
    [to, setTo] = useState(1080),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (poll) {
      setRanges([{ date: poll.end || today(), from: poll.from, to: poll.to }]);
      setFrom(poll.from);
      setTo(poll.to);
      setError("");
    }
  }, [poll]);
  let validation = "";
  if (poll)
    try {
      extendSchedule(poll, { ranges, from, to });
    } catch (e) {
      validation = (e as Error).message;
    }
  return (
    <Dialog
      open={!!poll}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent style={{ maxWidth: 860 }}>
        <DialogTitle>Añadir días u horarios</DialogTitle>
        <DialogDescription>
          {poll?.title}. Los bloques actuales y las respuestas se conservan. Los
          nuevos quedan sin respuesta hasta que cada participante los marque.
        </DialogDescription>
        {poll && (
          <form
            className="dialogform"
            aria-busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              if (validation) return;
              setBusy(true);
              setError("");
              try {
                await onSave({
                  id: poll.id,
                  revision: poll.scheduleRevision || 0,
                  ...(poll.mode === "dates" ? { ranges } : { from, to }),
                });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="creation-fields" disabled={busy}>
              {poll.mode === "dates" ? (
                <DailyRangesEditor
                  ranges={ranges}
                  onChange={setRanges}
                  step={poll.step}
                  duration={poll.duration || poll.step}
                  disabled={busy}
                />
              ) : (
                <>
                  <p>
                    Esta consulta ya incluye todos los días de la semana o del
                    mes. Puedes ampliar su horario común.
                  </p>
                  <TimeField
                    label="Desde"
                    value={from}
                    onChange={setFrom}
                    step={poll.step}
                  />
                  <TimeField
                    label="Hasta"
                    value={to}
                    onChange={setTo}
                    step={poll.step}
                    allowMidnight
                  />
                </>
              )}
              {poll.closed && (
                <p className="hint">
                  La consulta seguirá cerrada después de ampliar los horarios.
                </p>
              )}
              {(error || validation) && (
                <p role="alert" className="error">
                  {error || validation}
                </p>
              )}
              <Button type="submit" disabled={busy || !!validation}>
                {busy ? "Guardando…" : "Guardar ampliación"}
              </Button>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
