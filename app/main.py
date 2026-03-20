from __future__ import annotations

from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.links import router as links_router
from app.api.v1.sessions import router as sessions_router
from app.db import init_db
from app import models


app = FastAPI(title="Pickup Session MVP")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)
app.include_router(links_router)


# [학습 포인트] FastAPI Startup Event
# 서버가 시작될 때 특정 함수를 실행하게 설정할 수 있습니다.
@app.on_event("startup")
def on_startup() -> None:
    """
    서버 시작 시 DB 테이블을 생성합니다.
    (현업에서는 보통 Alembic 같은 마이그레이션 도구를 사용하지만,
    프로토타이핑 단계나 학습 단계에서는 init_db()로 테이블을 생성하는 것이 편리합니다.)
    """
    init_db()


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Pickup Session API Server is running!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
