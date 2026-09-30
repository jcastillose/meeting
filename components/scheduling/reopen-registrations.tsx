"use client";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function ReopenRegistrations({busy,error,onConfirm}:{busy:boolean;error?:string;onConfirm:()=>Promise<boolean>}){
 const [open,setOpen]=useState(false);
 return <><p className="small muted">Puedes reabrir los registros conservando las respuestas existentes.</p><Button variant="outline" disabled={busy} onClick={()=>setOpen(true)}>Reabrir registros</Button><Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent><DialogTitle>¿Reabrir los registros?</DialogTitle><DialogDescription>Las personas podrán registrar o modificar su disponibilidad. Se conservarán todas las respuestas y se retirará el horario definitivo anterior, si lo hubiera. No se enviarán correos ni se cancelarán eventos en calendarios externos.</DialogDescription>{error&&<p className="error" role="alert">{error}</p>}<div className="row"><Button disabled={busy} onClick={async()=>{if(await onConfirm())setOpen(false)}}>{busy?'Reabriendo…':'Confirmar reapertura'}</Button><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button></div></DialogContent></Dialog></>;
}
