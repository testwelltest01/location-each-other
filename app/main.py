from __future__ import annotations

from fastapi import FastAPI

# 다른 파일에 정의된 API 라우터들을 가져옵니다.
from app.api.v1.links import router as links_router
from app.api.v1.sessions import router as sessions_router

# [공부 포인트 1] FastAPI 인스턴스 생성
# 이 객체가 웹 애플리케이션의 중심이 됩니다.
app = FastAPI(title="Pickup Session MVP")

# [공부 포인트 2] 라우터 등록
# 분리된 파일에 정의된 API 경로들을 실제 애플리케이션에 등록합니다.
app.include_router(sessions_router)
app.include_router(links_router)


# 서버가 잘 작동하는지 확인하기 위한 헬스체크 엔드포인트입니다.
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Pickup Session API Server is running!"}


# [공부 포인트 3] uvicorn 실행
# 이 파일이 메인으로 실행될 때, 웹 서버(uvicorn)를 구동합니다.
if __name__ == "__main__":
    import uvicorn

    # 'app.main:app'은 app 디렉토리의 main.py 파일 내의 app 객체를 의미합니다.
    # reload=True는 코드 수정 시 서버를 자동으로 재시작해주는 개발용 옵션입니다.
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
