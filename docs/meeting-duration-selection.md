# Duración de propuestas y respuestas

La duración elegida es el mínimo continuo que debe cubrir cada propuesta y cada tramo de disponibilidad positiva.

- El organizador elige duración antes de los horarios. Cada clic del calendario propone o retira esa ventana completa. Los campos escritos conservan sus valores y se validan; cambiar duración no los amplía ni los borra.
- La vista sigue agrupada por horas con medias horas, pero la acción usa la duración de la reunión. Al final del horario propuesto selecciona la última ventana completa que contiene la celda.
- Toda secuencia de Disponible/Si hace falta debe durar al menos una reunión. Se pueden combinar ambos estados, proponer tramos más largos y responder sin disponibilidad o con intervalos ocupados.
- Vacíos, pausas y días separados interrumpen la continuidad. Un fragmento corto debe ampliarse o borrarse antes de guardar; el servidor verifica la misma regla antes de persistir.
- Respuestas anteriores no se cambian automáticamente. Al editarlas, los tramos cortos deben corregirse para guardar. La herramienta de marcado acepta exactamente las claves indicadas y rechaza un resultado incompleto sin añadir disponibilidad fuera de la lista.

Ejemplo: reunión90min,paso30min; seleccionar09:00 marca09:00–10:30. Dos medias horas aisladas no pueden guardarse como disponibilidad para esa reunión.
