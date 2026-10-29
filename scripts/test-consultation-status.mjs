import assert from 'node:assert/strict';
import {consultationStatus} from '../lib/consultation-status.ts';

const poll = {id:'p1',title:'Prueba',mode:'dates',start:'2026-11-02',end:'2026-11-03',from:540,to:600,step:60,timezone:'UTC',created:''};
assert.equal(consultationStatus(poll,new Date('2026-11-03T09:59:00Z')),'open');
assert.equal(consultationStatus(poll,new Date('2026-11-03T10:00:00Z')),'expired');
assert.equal(consultationStatus({...poll,closed:true},new Date('2026-11-04T10:00:00Z')),'closed');
assert.equal(consultationStatus({...poll,dailyRanges:[{date:'2026-11-02',from:540,to:600},{date:'2026-11-04',from:720,to:780}]},new Date('2026-11-03T10:00:00Z')),'open');
assert.equal(consultationStatus({...poll,mode:'week'},new Date('2027-01-01T00:00:00Z')),'open');
assert.equal(consultationStatus({...poll,mode:'month'},new Date('2027-01-01T00:00:00Z')),'open');
assert.equal(consultationStatus({...poll,timezone:'Pacific/Auckland'},new Date('2026-11-03T09:59:00Z')),'expired');
console.log('Estados de consultas: correcto');
