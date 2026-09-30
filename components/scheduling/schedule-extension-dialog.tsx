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
import { replaceSchedule } from "@/lib/schedule-extension";
import { days, validKeys, type Poll, type DailyRange } from "@/lib/domain";
type Extension = {
  id: string;
  revision: number;
  notifyParticipants: boolean;
  reopen: boolean;
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
    [notifyParticipants,setNotifyParticipants]=useState(true),
    [reopen,setReopen]=useState(false),
    [review,setReview]=useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (poll) {
      setRanges(poll.dailyRanges?.map(r=>({...r}))||days(poll).map(date=>({date,from:poll.from,to:poll.to})));
      setNotifyParticipants(true);setReopen(false);setReview(false);
      setFrom(poll.from);
      setTo(poll.to);
      setError("");
    }
  }, [poll]);
  let validation = "";
  if (poll)
    try {
      replaceSchedule(poll, { ranges, from, to });
    } catch (e) {
      validation = (e as Error).message;
    }
  if(poll?.closed&&!reopen)validation="Confirma la reapertura para cambiar las propuestas de una consulta cerrada.";
  const original=poll?validKeys(poll):new Set<string>();
  let added=0,removed=0;
  if(poll&&!validation){const next=validKeys({...poll,...replaceSchedule(poll,{ranges,from,to})});added=[...next].filter(k=>!original.has(k)).length;removed=[...original].filter(k=>!next.has(k)).length;}
  return (
    <Dialog
      open={!!poll}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent style={{ maxWidth: 860 }}>
        <DialogTitle>Editar propuestas horarias</DialogTitle>
        <DialogDescription>
          {poll?.title}. Puedes añadir, modificar o retirar bloques. Las preferencias de los bloques que permanezcan se conservan; los nuevos deben ser respondidos. Se guardará el historial del cambio.
        </DialogDescription>
        {poll && (
          <form
            className="dialogform"
            aria-busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              if (validation) return;
              if(!review){setReview(true);return;}
              setBusy(true);
              setError("");
              try {
                await onSave({
                  id: poll.id,
                  revision: poll.scheduleRevision || 0,
                  notifyParticipants,reopen,
                  ...(poll.mode === "dates" ? { ranges } : { from, to }),
                });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="creation-fields" disabled={busy||review}>
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
                    Esta consulta incluye los días de la semana o del mes. Puedes ajustar su rango horario común.
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
                <label className="notification-choice"><input type="checkbox" checked={reopen} onChange={e=>setReopen(e.target.checked)}/><span>Reabrir registros y retirar el horario definitivo anterior. Las personas podrán revisar sus opciones nuevamente.</span></label>
              )}
              {(error || validation) && (
                <p role="alert" className="error">
                  {error || validation}
                </p>
              )}
              <label className="notification-choice"><input type="checkbox" checked={notifyParticipants} onChange={e=>setNotifyParticipants(e.target.checked)}/><span>Notificar por correo a quienes ya respondieron</span></label>
            </fieldset>
            <p className="small muted">{added} bloques nuevos · {removed} bloques retirados. Las respuestas de bloques retirados se conservarán en el historial interno del cambio.</p>
            {review?<div className="send-review"><h3>Revisar cambios</h3><p>Se actualizarán las propuestas de «{poll.title}». {poll.closed?'Se reabrirán los registros y se retirará la confirmación anterior.':''}</p><p>{notifyParticipants?'Se enviará un aviso a los participantes con correo registrado.':'No se enviarán avisos por correo.'}</p><div className="row"><Button type="submit" disabled={busy}>{busy?'Guardando…':'Confirmar cambios'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setReview(false)}>Volver a editar</Button></div></div>:<Button type="submit" disabled={busy||!!validation||(!added&&!removed)}>Revisar cambios</Button>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
