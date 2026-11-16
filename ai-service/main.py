from fastapi import FastAPI

app = FastAPI(
    title="Mdinty AI Service", 
    description="Microservice d'IA pour la classification d'incidents urbains et l'analyse RAG"
)

@app.get("/")
def read_root():
    return {"message": "API Mdinty IA opérationnelle !"}