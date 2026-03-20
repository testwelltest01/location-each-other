from __future__ import annotations

from fastapi import FastAPI

from app.api.v1.links import router as links_router
from app.api.v1.sessions import router as sessions_router

app = FastAPI(title="Pickup Session MVP")

app.include_router(sessions_router)
app.include_router(links_router)


@app.get("/")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
