# Caso `api502`

## Estado

**Propuesta seleccionada, pendiente de definición del stack.**

Este documento describe el caso de uso. En esta etapa no contiene código ni una
implementación definitiva.

## Resumen

Un cambio de configuración deja a Nginx apuntando a un puerto incorrecto. El
backend continúa saludable, pero las solicitudes que pasan por el proxy reciben
una respuesta `502 Bad Gateway`.

El agente de respuesta a incidentes debe observar el fallo, reunir evidencia,
identificar la causa raíz, aplicar una recuperación segura y reversible, y
verificar que el servicio vuelva a responder correctamente.

## Flujo propuesto

1. La API responde correctamente a través de Nginx.
2. Se activa una configuración defectuosa del upstream.
3. Nginx comienza a responder `502 Bad Gateway`.
4. El agente revisa el estado del proxy, el backend, los logs y la configuración.
5. El agente determina que el backend sigue activo y que el upstream es incorrecto.
6. Antes de modificar el sistema, respalda la configuración actual.
7. Restaura una configuración conocida como válida y la valida.
8. Recarga Nginx y comprueba la recuperación de la API.
9. Registra la evidencia, las acciones y el aprendizaje del incidente.

## Capacidades que debe demostrar

- Diagnóstico basado en evidencia y no sólo en una respuesta `502`.
- Uso controlado de herramientas con permisos limitados.
- Acción reversible con respaldo y validación previa.
- Recuperación autónoma y verificación posterior.
- Compresión y deduplicación de logs para reducir el consumo de tokens.
- Consulta y registro de memoria de incidentes.
- Interacción por texto, con voz como mejora de experiencia.
- Manejo de al menos una herramienta que falle o entregue información incompleta.

## Stack en discusión

- Kostra Cloud con GLM-5.2.
- OpenCode como agente y orquestador.
- Engram como memoria.
- Nginx como proxy del servicio afectado.
- API REST en Node.js administrada con pnpm.
- Linux y Docker como entorno reproducible.
- Herramientas especializadas para observación, recuperación y verificación.
- Optimizador de contexto y tokens para logs y resultados de herramientas.
- Voz local y gratuita para transcripción y síntesis.

La selección final de componentes, versiones e integración se documentará antes
de comenzar el desarrollo.

## Criterios iniciales de éxito

- La API pasa de `502` a `200` después de la intervención.
- La causa raíz queda respaldada por logs, estado del backend y configuración.
- Nginx sólo se recarga después de validar la configuración.
- La recuperación es reversible y no expone secretos.
- El agente registra un informe breve y sanitizado del incidente.
- La demostración completa puede ejecutarse en menos de cuatro minutos.

