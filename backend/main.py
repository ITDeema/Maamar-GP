"""Run alone:  uvicorn main:app --reload --port 8000
If the team already has a FastAPI app, add two lines to it instead:
    from services_api import router as services_router
    app.include_router(services_router)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sun_wind_api import router as sun_wind_router
from services_api import router as services_router
from facade_indicators_api import router as facade_router

app = FastAPI(title="Maamar API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(services_router)
app.include_router(sun_wind_router)
app.include_router(facade_router)
