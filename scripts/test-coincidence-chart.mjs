import assert from 'node:assert/strict';
import {rank} from '../lib/domain.ts';
import {coincidenceChart} from '../lib/coincidence-chart.ts';

const poll = {id:'test',title:'Prueba',mode:'dates',start:'2026-11-02',end:'2026-11-03',from:540,to:660,step:60,duration:60,timezone:'America/Santiago',created:''};
const votes = [
  {id:'1',name:'Ana',comment:'',slots:{'2026-11-02@540':'yes','2026-11-03@540':'yes'}},
  {id:'2',name:'Beto',comment:'',slots:{'2026-11-02@540':'yes','2026-11-03@540':'maybe'}},
  {id:'3',name:'Cata',comment:'',slots:{'2026-11-02@540':'maybe','2026-11-03@540':'yes'}},
];
const chart = coincidenceChart(poll, rank(poll, votes));
assert.equal(chart.slots.length, 2);
assert.equal(chart.slots[0].key, '2026-11-02@540');
assert.equal(chart.slots[0].yes, 2);
assert.equal(chart.slots[0].maybe, 1);
assert.equal(chart.days.length, 2);
assert.equal(chart.days[0].peak.yes, 2);
assert.equal(coincidenceChart(poll, rank(poll, votes), 1).days.length, 1);
const longer = {...poll,duration:120};
assert.equal(coincidenceChart(longer, rank(longer, votes)).slots.length, 0, 'Una reunión de dos horas exige disponibilidad durante ambos bloques.');
console.log('Gráficos de coincidencias: correcto');
