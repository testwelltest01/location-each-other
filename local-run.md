# Local Development Run Guide (FastAPI + PostgreSQL)

이 문서는 구현된 API 서버를 로컬 환경에서 실행하고 테스트하는 방법을 다룹니다.

> **[학습 가이드]**
> - **Docker Compose**를 사용하는 이유는 로컬 컴퓨터에 직접 PostgreSQL을 설치하지 않고도 격리된 환경에서 DB를 실행할 수 있기 때문입니다.
> - **cURL** 명령어는 터미널에서 HTTP 요청을 보내는 가장 기본적인 도구입니다. API가 의도대로 동작하는지 확인하는 '검증' 과정을 익혀보세요.

## 1) 필수 환경변수

- `DATABASE_URL` (필수)
  - 기본값: `postgresql+psycopg://postgres:postgres@localhost:5432/pickup_mvp`
  - Compose 실행 시: `postgresql+psycopg://postgres:postgres@db:5432/pickup_mvp`

**[공부 포인트]** 앱 실행 시 `app/main.py`의 시작 이벤트에서 `init_db()`가 호출되어 DB 스키마를 자동 생성합니다. 이를 통해 테이블을 수동으로 만들 필요 없이 코드가 DB 구조를 결정하게 됩니다.

## 2) 최소 실행 환경

### A. docker-compose(권장)

```bash
# 컨테이너 빌드 및 실행
docker compose up --build
```

- API: `http://127.0.0.1:8000`
- DB: `postgresql://postgres:postgres@127.0.0.1:5432/pickup_mvp`

**[팁]** 중지하고 싶을 때는 `Ctrl + C`를 누르거나 다른 터미널에서 `docker compose down`을 입력하세요.

### B. 로컬 PostgreSQL 단독 실행(대체)

- PostgreSQL이 로컬에 이미 설치되어 있다면 `DATABASE_URL`만 맞춰서 직접 실행할 수 있습니다.

```bash
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/pickup_mvp"
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### C. Python 인터프리터 정합성 점검 (sqlalchemy import 에러 대응)

`uvicorn --reload` 재시작 시 자식 프로세스가 다른 Python을 쓰면 `ModuleNotFoundError`가 납니다. 실행 전 아래 순서를 권장합니다.

```bash
where python
python --version
python -m pip show SQLAlchemy
```

동일 터미널에서 이어서 아래처럼 실행하면 현재 프로세스와 동일 환경에서 서버가 뜹니다.

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

또는 스크립트로 실행:

```bash
./backend-start.ps1
```

`SQLAlchemy`가 보이지 않으면 `pip` 설치가 다른 Python에 들어간 것이므로, IDE/터미널의 Python 경로를 위 명령으로 통일해 주세요.

## 3) 서버 실행 확인 (Health Check)

```bash
curl http://127.0.0.1:8000/
```

정상 응답 예시:
```json
{"status":"ok","message":"Pickup Session API Server is running!"}
```

## 4) API 테스트 시나리오

아래 순서대로 요청을 보내며 데이터가 어떻게 변하는지 확인해 보세요.

1) **운전자 세션 생성**: 새로운 위치 공유 방을 만듭니다.
```bash
curl -X POST http://127.0.0.1:8000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_TOKEN_1" \
  -d '{"driver_id":"11111111-1111-1111-1111-111111111111","session_ttl_minutes":120,"link_ttl_minutes":120}'
```

2) **탑승자 링크 접속**: 생성된 `link_token`을 사용해 접속 정보를 확인합니다.
```bash
curl http://127.0.0.1:8000/api/v1/links/{link_token}
```

3) **탑승자 위치 공유**: 탑승자가 자신의 위치를 서버에 보냅니다.
```bash
curl -X POST http://127.0.0.1:8000/api/v1/links/{link_token}/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: LinkTokenOptional" \
  -d '{"latitude":37.5665,"longitude":126.9780,"accuracy_m":8.0}'
```

4) **운전자 위치 조회**: 상대방(운전자)의 위치를 확인합니다.
```bash
curl http://127.0.0.1:8000/api/v1/sessions/{session_id}/driver-location \
  -H "Authorization: Bearer DRIVER_TOKEN_1"
```

5) **세션 종료**: 운전자가 모든 공유를 중단합니다.
```bash
curl -X POST http://127.0.0.1:8000/api/v1/sessions/{session_id}/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_TOKEN_1" \
  -d '{"reason":"driver_end"}'
```

6) **링크 상태 확인**: 종료 후 링크가 비활성화되었는지 확인합니다.
```bash
curl http://127.0.0.1:8000/api/v1/links/{link_token}/status
```

## 5) 검증 체크리스트 (학습 완료 기준)

- [ ] `GET /` 호출 시 서버가 살아있는가?
- [ ] 세션 생성 시 응답에 `session_id`, `link_token` 등의 필수 값이 포함되는가?
- [ ] 위치 업로드 시 에러 없이 성공 응답이 오는가?
- [ ] 세션 종료 후 링크 상태를 조회했을 때 `can_access=false`가 되는가?

## 6) 모바일 앱 실행 (Expo)

- 모바일 화면 뼈대는 `react-native-app`에서 `npm install` 후 실행 가능합니다.
- 기본 실행:
  - `cd react-native-app`
  - `npm run start`
  - QR 코드로 Expo Go 실행
- 에뮬레이터 실행(선택):
  - `npm run android`
  - `npm run ios` (macOS + Xcode)

상세 가이드는 [mobile-run.md](mobile-run.md) 참조.
