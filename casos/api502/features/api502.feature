# language: es

Característica: Recuperación segura de una API detrás de Nginx
  Como equipo de respuesta a incidentes
  Queremos diagnosticar y revertir un upstream incorrecto
  Para recuperar la API sin comprometer la seguridad

  Escenario: Recuperación verificable desde 502 a 200
    Dado que el proxy y el backend están saludables
    Cuando se inyecta una configuración de upstream incorrecta
    Entonces Nginx responde 502 y el backend directo responde 200
    Cuando se ejecuta la recuperación segura del incidente
    Entonces se crea un respaldo antes de restaurar
    Y la configuración se valida antes de recargar Nginx
    Y el proxy y el backend vuelven a responder 200

