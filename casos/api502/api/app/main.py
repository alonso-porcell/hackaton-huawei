from fastapi import FastAPI


app = FastAPI(
    title="Payments API",
    description="Servicio saludable detrás del incidente simulado de Nginx.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "payments-api",
    }

