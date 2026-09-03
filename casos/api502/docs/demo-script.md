# Guion de demostración (3 a 4 minutos)

## 1. Presentar el problema — 20 segundos

“Una API crítica devuelve 502 a los usuarios. No sabemos aún si cayó el backend,
si falló la red o si Nginx está mal configurado. El agente debe investigarlo sin
recibir acceso libre a la terminal.”

## 2. Activar el incidente — 15 segundos

La persona de infraestructura activa el escenario de demostración. Se muestra que
Nginx entrega 502 mientras el backend continúa en 200.

## 3. Diagnóstico autónomo — 60 segundos

En OpenCode:

```text
Usa ir-sentinel. Diagnostica api502 sin hacer cambios y entrega hechos, evidencias,
hipótesis y confianza.
```

Destacar que el agente elige las herramientas, correlaciona tres fuentes y reduce
logs repetidos antes de usar tokens de Kostra.

## 4. Recuperación segura — 60 segundos

```text
Recupera el incidente con el procedimiento seguro y escribe un postmortem breve.
```

Nombrar en pantalla: snapshot, política de confianza, `nginx -t`, recarga y doble
verificación HTTP 200.

## 5. Cierre — 30 segundos

Mostrar el resultado de Cucumber y Stryker, y resumir:

- decisión del agente con GLM-5.2 en Kostra;
- herramientas de privilegio mínimo;
- recuperación reversible;
- evidencia trazable;
- optimización de tokens cuantificada.

## Plan de respaldo

Si Kostra o internet no están disponibles, ejecutar el escenario Cucumber y usar
una captura de una ejecución previa de OpenCode. No simular una respuesta en vivo
ni ocultar la dependencia externa al jurado.
