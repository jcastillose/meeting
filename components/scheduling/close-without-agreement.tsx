"use client";
import {useState} from 'react';
import {Button} from '@/components/ui/button';

export function CloseWithoutAgreement({busy,onConfirm}:{busy:boolean;onConfirm:()=>Promise<boolean>}){
 const [review,setReview]=useState(false);
 return <div className="close-without-agreement">
  {!review?<Button type="button" variant="outline" disabled={busy} onClick={()=>setReview(true)}>Cerrar sin acuerdo de horario</Button>:
   <div className="send-review" role="region" aria-labelledby="no-agreement-title">
    <h3 id="no-agreement-title">Cerrar sin acuerdo de horario</h3>
    <p>Se conservarán las respuestas y se bloquearán nuevos registros. La consulta indicará que no se definió un horario. Después podrás revisar y enviar el aviso a quienes respondieron.</p>
    <div className="row">
     <Button type="button" variant="outline" disabled={busy} onClick={()=>setReview(false)}>Cancelar</Button>
     <Button type="button" disabled={busy} onClick={async()=>{if(await onConfirm())setReview(false)}}>{busy?'Cerrando…':'Confirmar cierre sin acuerdo'}</Button>
    </div>
   </div>}
 </div>;
}
