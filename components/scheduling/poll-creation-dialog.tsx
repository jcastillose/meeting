"use client";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { add, clock, modes, type Mode, type Poll } from "@/lib/domain";
import { scheduleErrors } from "@/lib/schedule";
import { DailyRangesEditor } from "@/components/daily-ranges-editor";
export type PollCreationDialogProps = {
  accountEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Poll;
  setForm: Dispatch<SetStateAction<Poll>>;
  busy: boolean;
  error: string;
  dirty: boolean;
  onSubmit: () => Promise<void>;
  notificationEmail: string;
};
function Choose({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function PollCreationDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  error,
  dirty,
  onSubmit,
  notificationEmail,
  accountEmail,
}: PollCreationDialogProps) {
  const invalidSchedule =
    !!form.dailyRanges &&
    scheduleErrors(form.dailyRanges, form.step, form.duration || form.step)
      .length > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent style={{ maxWidth: form.dailyRanges ? 860 : 560 }}>
        <DialogTitle>Nueva consulta de horarios</DialogTitle>
        <DialogDescription>
          Elige cómo quieres consultar al grupo. Cada consulta tiene su propio
          enlace.
        </DialogDescription>
        <form
          aria-busy={busy}
          className="dialogform"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <fieldset disabled={busy} className="creation-fields">
            <fieldset className="creator-fields">
              <legend>Quién crea la consulta</legend>{accountEmail&&<p className="small muted">Consulta vinculada a tu cuenta: <strong>{accountEmail}</strong>. Podrás ampliarla desde tu historial.</p>}
              <p className="muted small">
                Tus datos de contacto no se mostrarán en el calendario público.
                No necesitas crear una cuenta.
              </p>
              <label className="field">
                Nombre y apellido del creador
                <input
                  required
                  autoComplete="name"
                  maxLength={120}
                  value={form.creator?.name || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      creator: {
                        ...form.creator,
                        name: e.target.value,
                        email: form.creator?.email || "",
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                Correo electrónico del creador
                <input
                  type="email"
                  readOnly={!!accountEmail}
                  required
                  autoComplete="email"
                  aria-describedby="creator-email-notice"
                  maxLength={254}
                  value={form.creator?.email || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      creator: {
                        ...form.creator,
                        name: form.creator?.name || "",
                        email: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label className="notification-choice">
                <input
                  type="checkbox"
                  checked={form.creator?.notify !== false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      creator: {
                        name: form.creator?.name || "",
                        email: form.creator?.email || "",
                        notify: e.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Recibir avisos por correo de nuevos registros y cambios de
                  disponibilidad
                </span>
              </label>
              <p className="small muted">
                Recibirás un enlace privado para gestionar la consulta, aunque
                desactives los avisos.
              </p>
              <p
                id="creator-email-notice"
                className="small muted"
                style={{ marginBottom: 0, overflowWrap: "anywhere" }}
              >
                Para asegurar la adecuada recepción de notificaciones de
                disponibilidad, agrega la dirección{" "}
                <strong>{notificationEmail}</strong> a tus contactos o casillas
                de correo confiable.
              </p>
            </fieldset>
            <label className="field">
              Título
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="field">
              <span>Tipo de consulta</span>
              <Choose
                label="Tipo de consulta"
                value={form.dailyRanges ? "custom" : form.mode}
                onChange={(v) =>
                  setForm({
                    ...form,
                    mode: v === "custom" ? "dates" : (v as Mode),
                    dailyRanges:
                      v === "custom"
                        ? form.dailyRanges || [
                            { date: form.start, from: form.from, to: form.to },
                          ]
                        : undefined,
                  })
                }
                options={
                  [
                    ...Object.entries(modes),
                    ["custom", "Fechas con horarios distintos por día"],
                  ] as [string, string][]
                }
              />
            </div>
            {form.dailyRanges ? (
              <DailyRangesEditor
                ranges={form.dailyRanges}
                step={form.step}
                duration={form.duration || form.step}
                disabled={busy}
                onChange={(dailyRanges) => setForm({ ...form, dailyRanges })}
              />
            ) : form.mode === "dates" ? (
              <div className="row">
                <label className="field">
                  Desde
                  <input
                    type="date"
                    required
                    value={form.start}
                    onChange={(e) =>
                      setForm({ ...form, start: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Hasta
                  <input
                    type="date"
                    required
                    min={form.start}
                    max={add(form.start, 61)}
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <p className="hint">
                {form.mode === "week"
                  ? "Consulta de lunes a domingo, sin asociar las preferencias a fechas concretas."
                  : "Consulta los días 1 al 31 de cualquier mes, sin asociarlos a un calendario concreto."}
              </p>
            )}
            <div className="row">
              {!form.dailyRanges && (
                <>
                  <div className="field">
                    <span>Desde las</span>
                    <Choose
                      label="Hora inicial"
                      value={String(form.from)}
                      onChange={(v) => setForm({ ...form, from: Number(v) })}
                      options={Array.from({ length: 24 }, (_, i) => [
                        String(i * 60),
                        clock(i * 60),
                      ])}
                    />
                  </div>
                  <div className="field">
                    <span>Hasta las</span>
                    <Choose
                      label="Hora final"
                      value={String(form.to)}
                      onChange={(v) => setForm({ ...form, to: Number(v) })}
                      options={Array.from({ length: 24 }, (_, i) => [
                        String((i + 1) * 60),
                        clock((i + 1) * 60),
                      ])}
                    />
                  </div>
                </>
              )}
              <div className="field">
                <span>Bloques</span>
                <Choose
                  label="Duración del bloque"
                  value={String(form.step)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      step: Number(v),
                      duration:
                        Math.ceil((form.duration || 60) / Number(v)) *
                        Number(v),
                    })
                  }
                  options={[
                    ["30", "30 minutos"],
                    ["60", "60 minutos"],
                  ]}
                />
              </div>
            </div>
            <label className="field">
              Duración de la reunión (minutos)
              <input
                type="number"
                required
                min={form.step}
                step={form.step}
                max={
                  form.dailyRanges
                    ? 1440
                    : Math.max(form.step, form.to - form.from)
                }
                value={form.duration || form.step}
                onChange={(e) =>
                  setForm({ ...form, duration: Number(e.target.value) })
                }
              />
            </label>
            <p className="small muted">
              Las coincidencias deben cubrir la duración completa de la reunión.
              {form.dailyRanges &&
                " Cada día debe ofrecer al menos esa duración y sus horas deben coincidir con el tamaño de bloque."}
            </p>
            <label className="field">
              Zona horaria
              <input
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </label>
            <p className="small muted">
              Quien tenga el enlace podrá ver nombres, comentarios y
              preferencias. No se requiere cuenta.
            </p>
            {dirty && (
              <p className="small muted">
                Al crear una nueva consulta se descartarán los cambios sin
                guardar de la consulta actual.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || invalidSchedule}>
              {busy ? "Creando…" : "Crear consulta y obtener enlace"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
