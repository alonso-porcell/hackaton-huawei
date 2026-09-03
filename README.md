# hackaton-huawei

Coordinacion Hackaton
**Agente de Incident Response**

#Metricas:
  -Responde ante incidente simulado
  -Investiga registros y alertas
  -identifica causa raiz
  -Propone o ejecuta medidas correctivas.

#Rúbrica:
	-Tareas exitosas o correctas = 30%
	-Comportamiento y Autonomia = 25%
	-Uso de herramientas y Orquestacion
	-Gestion de la ambiguedad

Harness y CLI de Desarrollo: Interfaces de orquestación local como OpenCode y Claude Code que integran el ciclo de lectura-edición-ejecución en la terminal.
Context Engineering y Protocolos de Extensión: El uso de estándares como MCP para conectar agentes con bases de datos, APIs y sistemas de archivos, condicionado por la gestión rigurosa de la ventana de contexto .
Capa de Abstracción de Inferencia: Proveedores y proxies de inferencia ,Kostra, que exponen interfaces estandarizadas compatibles con las APIs de OpenAI y Anthropic para servir modelos de razonamiento avanzado como glm-5.2.

Frameworks como Everything Claude Code (ECC) y proyectos nacidos en competencias de alta intensidad, donde la modularización en subagentes, habilidades (skills), reglas (rules) y ganchos (hooks) transformó un asistente aislado en un equipo de desarrollo virtual estructurado. Paralelamente, plataformas como OpenClaw introdujeron pasarelas (Gateways) y archivos de identidad (SOUL.md) para conectar modelos a canales de mensajería (WhatsApp, Telegram, Slack), visibilizando al mismo tiempo los riesgos de seguridad derivados de otorgar ejecución de shell sin aislamiento estricto.
Desglose de Variables
Categoría
Variable / Elemento
Definición Técnica y Métricas
Infraestructura
Gateway / Endpoint Kostra
URL base: [https://ai.kostra.cloud/v1](https://ai.kostra.cloud/v1) (OpenAI format) y [https://ai.kostra.cloud](https://ai.kostra.cloud) (Anthropic format).
Infraestructura
Modelo de Inferencia
glm-5.2 con soporte para deep thinking ("thinking": {"type": "enabled"}).
Infraestructura
Runtime de Aislamiento
Contenedor Docker basado en imagen node:18 sobre SO host Fedora, montando volúmenes persistentes (/workspace).
Context Engineering
Presupuesto de Contexto
Ventana teórica vs. utilizable (un exceso de herramientas reduce un contexto de 200k tokens a ~70k tokens efectivos).
Context Engineering
Límite de Herramientas
Umbral óptimo: \le 10 servidores MCP activos y \le 80 herramientas simultáneas en memoria de trabajo.
Agentes y Reglas
Arquitectura Modular
Subagentes especializados (planner, code-reviewer, security-reviewer), reglas jerárquicas (CLAUDE.md, .claude/rules/) y habilidades (.claude/skills/).
Automatización
Ganchos de Evento (Hooks)
Ciclos de vida: PreToolUse, PostToolUse, UserPromptSubmit, Stop, PreCompact, Notification.
Plataformas
Arquitectura OpenClaw
Pasarela Node.js, definición de personalidad en SOUL.md, ciclo de sondeo Heartbeat cada 30 min y canales (Telegram/Discord/WhatsApp).
Hackathon
Dinámica Competitiva
Equipos de máximo 2 integrantes, alcance enfocado en un MVP acotado y funcional con ventaja de dominio vertical.

Visión 360° y Matices
La trampa de la sobrecarga de herramientas: Instalar repositorios completos con cientos de agentes y habilidades (como la totalidad de ECC) sin podar herramientas consume la mayor parte del presupuesto de tokens en metadatos del sistema, degradando drásticamente la capacidad de razonamiento del modelo sobre código complejo.
Aislamiento extremo vs. Viabilidad de Red: Sistemas como Tails destruyen la persistencia operativa e introducen bloqueos masivos por enrutamiento Tor en endpoints de inferencia. La contención mediante Docker en Linux/Fedora ofrece aislamiento de procesos sin sacrificar persistencia ni estabilidad de red.
La brecha de seguridad en agentes abiertos: Plataformas como OpenClaw ejecutan código con privilegios completos por defecto. Con auditorías que detectan entre un 20% y 26% de vulnerabilidades o scripts maliciosos en marketplaces como ClawHub, el despliegue de agentes exige entornos sandboxed sin acceso a credenciales o claves SSH del sistema anfitrión.
Compatibilidad de formato de API: La unificación de saldo en Kostra Cloud permite alternar entre esquemas de OpenAI y Anthropic, pero la compatibilidad de herramientas (tool use/function calling) y el modo thinking requieren validación en el archivo opencode.json o en variables de entorno antes de la fase de construcción.
Efectos Cascada
Consecuencias de Primer Orden: Fallos en la resolución de dependencias locales o variables de entorno no propagadas impiden que los harnesses (OpenCode, Claude Code) inicialicen sesiones de terminal.
Consecuencias de Segundo Orden: Bucles descontrolados en subagentes autónomos o herramientas mal configuradas provocan llamadas infinitas a la API, agotando el saldo asignado ($20.000 CLP) en minutos.
Consecuencias de Tercer Orden: La ejecución de comandos no saneados en repositorios locales sin capas de revisión puede sobreescribir ramas críticas o filtrar claves API (sk-xxxxx) en el historial de Git si no se cuenta con hooks de auditoría en la fase Stop o PreToolUse.
Suposiciones Explícitas
Se asume que el endpoint ai.kostra.cloud mantiene paridad funcional con los esquemas de llamada de herramientas de OpenAI y Anthropic bajo el modelo glm-5.2.
Se asume disponibilidad continua de red en el evento y acceso sin restricciones a los registros públicos de Docker y npm.
Se asume que la contención Docker resuelve en su totalidad los riesgos de seguridad asociados a scripts de compilación de paquetes npm de terceros.
PARTE II: ROADMAP DE EJECUCIÓN LINEAL ASCENDENTE
[FASE 0: Configuración y Blindaje Operativo]
                    │
                    ▼
[NIVEL 1: Inferencia Base y Conectividad Kostra]
                    │
                    ▼
[NIVEL 2: Context Engineering, Reglas y Hooks]
                    │
                    ▼
[NIVEL 3: Orquestación de Subagentes y Flujos Paralelos]
                    │
                    ▼
[NIVEL 4: Agentes Autónomos y Arquitectura de Producción]


Fase 0: Configuración y Área de Trabajo (Inquebrantable)
1. Despliegue del Entorno Contenedorizado (Host Fedora) Crea el directorio de trabajo local y levanta el contenedor con Node.js 18+:
mkdir -p ~/hackathon_workspace/mi_codigo
cd ~/hackathon_workspace
docker run -it --name kostra_dev \
  -v $(pwd)/mi_codigo:/workspace \
  -w /workspace \
  -p 3000:3000 -p 8080:8080 \
  node:18-bullseye /bin/bash


2. Instalación de Herramientas y Dependencias Globales Dentro del contenedor, instala los harnesses de terminal y utilidades base:
npm install -g opencode-ai @anthropic-ai/claude-code
apt-get update && apt-get install -y git tmux jq curl nano


3. Estructuración del Sistema de Archivos y Configuración Establece las rutas para configuraciones, reglas y agentes:
mkdir -p ~/.config/opencode
mkdir -p ~/.claude/rules ~/.claude/skills ~/.claude/agents


Métrica de Validación: opencode -v && node -v && git --version devuelve versiones válidas sin errores en consola (Node \ge 18.0.0).
Dependencia Crítica: Intentar operar sin montar el volumen local provocará la pérdida total del código al detener el contenedor.
Nivel 1: Inferencia Base y Conectividad Kostra (Principiante)
1. Configuración de OpenCode para Kostra Cloud Crea el archivo ~/.config/opencode/opencode.json inyectando las credenciales y activando el modo de razonamiento profundo:
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "kostra": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Kostra",
      "options": {},
      "baseURL": "https://ai.kostra.cloud/v1",
      "apiKey": "sk-xxxxx",
      "models": {
        "glm-5.2": {
          "name": "glm-5.2",
          "options": {
            "thinking": {
              "type": "enabled"
            }
          }
        }
      }
    }
  }
}


2. Exportación de Variables para Herramientas Compatibles Declara las variables de entorno para herramientas basadas en el protocolo de Anthropic/OpenAI en la sesión de terminal:
export OPENAI_BASE_URL="https://ai.kostra.cloud/v1"
export OPENAI_API_KEY="sk-xxxxx"
export ANTHROPIC_BASE_URL="https://ai.kostra.cloud"
export ANTHROPIC_AUTH_TOKEN="sk-xxxxx"
export ANTHROPIC_MODEL="glm-5.2"


Métrica de Validación: Ejecutar opencode, escribir /models, seleccionar glm-5.2 y recibir respuesta con proceso de razonamiento visible (Ctrl+P -> "Show thinking").
Dependencia Crítica: Si falla la autenticación de la API (sk-xxxxx o baseURL errónea), los niveles posteriores no podrán ejecutar tareas asistidas ni compilar código.
Nivel 2: Context Engineering, Reglas y Hooks (Intermedio)
1. Definición de Reglas de Proyecto (CLAUDE.md / rules) Crea ~/.claude/rules/coding-style.md con estándares estrictos para evitar respuestas redundantes:
# Reglas de Desarrollo
- Prohibido hardcodear secretos o claves API.
- Generar código modular en TypeScript/Python con tipado estricto.
- Prohibido dejar console.log o prints de depuración en commits.
- Toda nueva función debe incluir su test unitario correspondiente.


2. Configuración de Hooks de Automatización y Seguridad Configura ~/.claude/hooks.json para formatear código automáticamente y advertir sobre sesiones persistentes:
{
  "PreToolUse": [
    {
      "matcher": "tool == \"Bash\" && tool_input.command matches \"(npm install|pytest|cargo run)\"",
      "hooks": [
        {
          "type": "command",
          "command": "if [ -z \"$TMUX\" ]; then echo '[Aviso] Ejecuta procesos largos dentro de tmux' >&2; fi"
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\.(ts|tsx|js|json)$\"",
      "hooks": [
        {
          "type": "command",
          "command": "npx prettier --write \"$TOOL_INPUT_FILE_PATH\" 2>/dev/null || true"
        }
      ]
    }
  ]
}


3. Control de Presupuesto MCP Desactiva servidores MCP no esenciales para mantener el consumo inicial de contexto bajo los 10.000 tokens:
{
  "disabledMcpServers": ["filesystem-heavy", "analytics-mcp", "slack-bridge"]
}


Métrica de Validación: Al realizar una edición de archivo asistida por IA, el archivo resultante es formateado inmediatamente por Prettier sin intervención manual, y la carga inicial de herramientas no supera 80 definiciones.
Dependencia Crítica: Omitir el control de MCP saturará el contexto, reduciendo la ventana utilizable y generando respuestas incompletas o alucinaciones en el código.
Nivel 3: Orquestación de Subagentes y Flujos Paralelos (Avanzado)
1. Creación de Subagentes Especializados Define especificaciones aisladas en ~/.claude/agents/ para delegar tareas complejas:
Archivo: ~/.claude/agents/architect.md
---
name: architect
tools: [ReadFile, GlobTool, GrepTool]
---
Rol: Diseñar estructuras de datos, modularización y flujos de arquitectura sin modificar archivos directamente. Genera especificaciones técnicas precisas para el equipo de desarrollo.


Archivo: ~/.claude/agents/code-reviewer.md
---
name: code-reviewer
tools: [ReadFile, GrepTool]
---
Rol: Auditar cambios de código buscando problemas de concurrencia, cobertura de pruebas, edge cases y vulnerabilidades de inyección antes de integrar.


2. Entorno de Ejecución Paralela con Git Worktrees Configura espacios de trabajo independientes para evitar colisiones entre el agente arquitecto y el de desarrollo:
git init /workspace/proyecto
cd /workspace/proyecto
git commit --allow-empty -m "Initial commit"
git worktree add ../feature-backend -b feature-backend
git worktree add ../feature-frontend -b feature-frontend


Métrica de Validación: Ejecución concurrente de dos instancias del harness operando en directorios de worktrees distintos sin bloqueos de Git ni colisiones de archivos.
Dependencia Crítica: Intentar paralelizar prompts sobre un único directorio de trabajo sobrescribirá archivos concurrentes y corromperá el árbol de trabajo.
Nivel 4: Agentes Autónomos y Arquitectura de Producción (Crítico/Experto)
1. Despliegue de Pasarela de Agentes (Patrón OpenClaw) Configura un gateway en Node.js aislado para conectar el modelo a un canal de control externo, limitando la ejecución a herramientas verificadas:
Archivo: /workspace/agent_gateway/SOUL.md
# Identidad del Agente
- Nombre: OpsSentinel
- Especialidad: Monitorización de compilaciones y ejecución de tests en backend.
- Comportamiento: Autónomo, conciso, genera reportes de estado cada vez que detecta fallos en la suite de pruebas.


2. Pipeline de Auditoría Estilo AgentShield Configura un flujo de evaluación trifásico antes del despliegue final:
Red Team Prompt: Identifica vectores de ataque y entradas no sanitizadas en las rutas creadas.
Blue Team Prompt: Genera parches defensivos, validaciones de esquemas y tipos estrictos.
Auditor Synthesis: Consolida los hallazgos en un informe final de seguridad ejecutable.
                  ┌──────────────────────┐
                  │   Código Generado    │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌────────────────────┐        ┌────────────────────┐
   │  Red Team Agent    │        │  Blue Team Agent   │
   │ (Detecta Vectores) │        │ (Propone Parches)  │
   └──────────┬─────────┘        └──────────┬─────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
                 ┌───────────────────────┐
                 │     Auditor Agent     │
                 │  (Reporte Priorizado) │
                 └───────────────────────┘


Métrica de Validación: El agente ejecuta de forma autónoma una prueba unitaria, detecta un fallo simulado, aplica el parche correctivo y emite un reporte estructurado de auditoría validando la corrección.
Dependencia Crítica: Desplegar agentes con permisos de shell automatizados sin la contención de Docker creada en la Fase 0 expone el sistema a modificaciones destructivas del sistema operativo anfitrión.
