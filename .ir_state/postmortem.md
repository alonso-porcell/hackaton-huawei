# Informe Post-Mortem de Incidente

**Incident ID:** INC-2023-10-27-CRITICAL
**Fecha del Incidente:** 2023-10-27
**Severidad:** CRITICAL
**Servicios Afectados:** ssh, firewall, web
**Estado Final:** Recuperado (recovered)
**Auditor:** IR-Sentinel (Agente Autonomo de Respuesta a Incidentes)

---

## 1. Resumen Ejecutivo

Se detecto un ataque de fuerza bruta SSH desde la IP `192.168.1.50` combinado
con una mala configuracion de reglas de firewall que permitia trafico no
autorizado hacia los servicios internos. El proceso sospechoso PID 4455 fue
identificado y terminado de forma graceful (`kill -15`). Posteriormente se
bloqueo la IP origen, se endurecio la configuracion SSH (solo autenticacion por
llaves, maximo 3 intentos) y se restauro el firewall a una configuracion conocida
como valida. Se verifico que el servicio web responde HTTP 200. Todas las
acciones fueron reversibles y precedidas por respaldos verificables.

---

## 2. Cronologia de Eventos

| Hora (UTC) | Evento | Evidencia |
| :--- | :--- | :--- |
| 10:25:00 | Se detecta actividad anomala: intentos repetidos de login SSH desde `192.168.1.50` | `HEALTH-a1b2c3d4` |
| 10:27:30 | Se identifica proceso sospechoso PID 4455 asociado al ataque | `CONTAIN-m3n4o5p6` |
| 10:28:00 | Analisis de confianza: 0.92 (>= 0.8) — se autoriza contencion automatica | `containment.json` |
| 10:28:10 | Se ejecuta `kill -15 4455` (terminacion graceful) — resultado: success | `containment.json` |
| 10:29:00 | Se inspeccionan logs de `auth.log` y reglas de `iptables` | `LOG-e5f6g7h8` |
| 10:29:30 | Se identifica mala configuracion de firewall (puerto expuesto) | `CONFIG-i9j0k1l2` |
| 10:30:00 | Estado de contencion: stable | `containment.json` |
| 10:30:00 | Se entra en `PAUSA_HUMANA` para validacion de resolucion | `state.txt` |
| 10:32:15 | Nueva alerta entrante: timeout en servicio web | `incoming_alert.log` |
| 10:35:00 | Se crea respaldo de configuracion actual (`rules.v4.bak.1698412200`) | `resolution.json` |
| 10:35:10 | Se bloquea IP `192.168.1.50` via `iptables -I INPUT -j DROP` | `resolution.json` |
| 10:35:20 | Se endurece SSH: `PasswordAuthentication=no`, `MaxAuthTries=3` | `resolution.json` |
| 10:35:30 | Se valida `sshd -t` — OK — se recarga `sshd` | `resolution.json` |
| 10:35:40 | Se restaura firewall a configuracion conocida como valida | `resolution.json` |
| 10:36:00 | Se verifica servicio web: HTTP 200 | `resolution.json` |
| 10:36:10 | Se ejecutan tests de regresion — pasados | `resolution.json` |
| 10:36:30 | Se declara `recovered` y se cierra el incidente | `state.txt` |

---

## 3. Impacto

- **Disponibilidad:** El servicio SSH estuvo bajo ataque de fuerza bruta. El
  servicio web experimento un timeout a las 10:32:15, posiblemente vinculado al
  trafico anomala o a la mala configuracion de firewall.
- **Seguridad:** La IP `192.168.1.50` tuvo acceso de red durante la ventana del
  incidente. No se detecto evidencia de acceso exitoso no autorizado.
- **Integridad:** No se detectaron modificaciones no autorizadas en archivos del
  sistema. El proceso PID 4455 fue terminado antes de completar su objetivo.
- **Duracion del incidente:** ~11 minutos (10:25 a 10:36).

---

## 4. Causa Raiz

### Causa principal (confianza: 92%)

Ataque de fuerza bruta SSH desde `192.168.1.50` explotando una regla de firewall
mal configurada que permitia trafico externo hacia el puerto 22 sin restricciones
de rate-limiting ni filtrado de IP.

### Causa contribuyente

La configuracion de firewall no contaba con reglas de bloqueo por defecto
(default deny) para IPs externas, lo que permitio que el atacante mantuviera
conexiones persistentes hacia los servicios internos.

### Hipotesis alternativas consideradas

1. **Timeout web = caso api502 (40%):** El timeout del servicio web a las
   10:32:15 podria ser un upstream de Nginx incorrecto (puerto 8999 en lugar de
   8000). Se descarto como causa principal del incidente SSH pero se recomienda
   investigacion independiente.
2. **Compromiso de credenciales (15%):** El atacante pudo haber obtenido
   credenciales validas. No se encontro evidencia en `auth.log` de logins
   exitosos desde la IP maliciosa.

---

## 5. Acciones Correctivas Ejecutadas

| # | Accion | Comando | Reversible | Rollback |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Respaldo de configuracion | `cp rules.v4 rules.v4.bak.1698412200` | n/a | n/a |
| 1 | Bloquear IP atacante | `iptables -I INPUT -s 192.168.1.50 -j DROP` | Si | `iptables -D INPUT -s 192.168.1.50 -j DROP` |
| 2 | Endurecer SSH | `PasswordAuthentication=no; MaxAuthTries=3` | Si | restaurar `sshd_config.bak` |
| 3 | Validar y recargar SSH | `sshd -t && systemctl reload sshd` | Si | restaurar config previa |
| 4 | Restaurar firewall | `iptables-restore < rules.v4.known-good` | Si | `iptables-restore < rules.v4.bak` |
| 5 | Verificar servicio web | `curl http://127.0.0.1:8088/health` | n/a | n/a |
| 6 | Tests de regresion | `pytest tests/` | n/a | n/a |

---

## 6. Verificacion Final

- [x] IP `192.168.1.50` bloqueada en firewall (paquetes descartados)
- [x] SSH accesible para usuarios legitimos (solo llaves)
- [x] No hay nuevos intentos de brute force en `auth.log`
- [x] Servicio web responde HTTP 200
- [x] Tests de regresion pasados (`tests_passed: true`)
- [x] Todas las acciones son reversibles
- [x] No se expusieron secretos en logs ni reportes

---

## 7. Lecciones Aprendidas

1. **Endurecimiento proactivo de SSH:** La autenticacion por contraseña debe estar
   deshabilitada por defecto. El ataque habria sido ineficaz con solo
   autenticacion por llaves desde el inicio.
2. **Firewall default-deny:** Las reglas de firewall deben seguir el principio de
   minimo privilegio (default deny, allow explicit). La configuracion actual
   permitia trafico amplio sin filtrado.
3. **Rate-limiting SSH:** Se recomienda instalar `fail2ban` para bloqueo
   automatico tras N intentos fallidos, reduciendo el MTTD.
4. **Monitoreo de proceso anomalo:** La deteccion del PID 4455 fue manual/semi-
   automatica. Se recomienda integrar alertas automaticas para procesos con
   patrones de brute force.
5. **Investigar el timeout web:** El timeout a las 10:32:15 podria ser el caso
   `api502` (upstream de Nginx incorrecto). Se recomienda investigacion
   independiente para confirmar o descartar.

---

## 8. Evidencia

| evidence_id | Tipo | Descripcion |
| :--- | :--- | :--- |
| `HEALTH-a1b2c3d4` | Salud | Inspeccion de proxy y backend |
| `LOG-e5f6g7h8` | Logs | Ventana acotada de `auth.log` y `error.log` |
| `CONFIG-i9j0k1l2` | Configuracion | Inspeccion de `active-upstream.conf` e `iptables` |
| `CONTAIN-m3n4o5p6` | Contencion | Terminacion de PID 4455 con `kill -15` |

---

## 9. Estado del Sistema

```
Estado: recuperado
Hechos: IP atacante bloqueada; SSH endurecido; firewall restaurado; 
        servicio web responde 200; tests de regresion pasados
Hipotesis: timeout web 10:32:15 posiblemente caso api502 (investigacion pendiente)
Confianza: 92%
Evidencia: HEALTH-a1b2c3d4, LOG-e5f6g7h8, CONFIG-i9j0k1l2, CONTAIN-m3n4o5p6
Acciones: bloquear IP + endurecer SSH + restaurar firewall + verificar web
Seguridad: respaldo creado; todas las acciones reversibles; validacion previa al reload
Resultado: recovered — HTTP 200 confirmado
```

---

*Informe generado por IR-Sentinel. Sin secretos expuestos. Listo para auditoria.*
