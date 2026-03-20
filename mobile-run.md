# Expo 실행 가이드 (MVP)

## 0) 사전 준비
- Node.js 18+
- Expo Go (iOS/Android)
- 백엔드 API 서버 URL: `http://<PC_IP>:8000`

## 1) 앱 실행

```bash
cd C:\Users\user\Desktop\20260320\react-native-app
npm install
npm run start
```

- `expo start` 실행 후 표시되는 QR 코드를 iPhone 12 mini의 Expo Go로 스캔합니다.
- 같은 Wi-Fi에서 백엔드가 실행되어 있어야 합니다.

## 2) 앱 환경변수

`EXPO_PUBLIC_API_BASE_URL`은 선택값입니다.
- 미설정이면 앱은 Expo host 정보(Metro)가 제공하는 IP를 자동으로 읽어 `http://<PC_IP>:8000`으로 연결을 시도합니다.
- 문제가 있으면 아래 환경변수로 고정하세요.

```powershell
$env:EXPO_PUBLIC_NAVER_MAP_CLIENT_ID="<YOUR_NAVER_CLIENT_ID>"
$env:EXPO_PUBLIC_API_BASE_URL="http://<PC_IP>:8000"
npm run start
```

권장: `react-native-app/.env` 또는 `.env.local`에 작성

```bash
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=<YOUR_NAVER_CLIENT_ID>
EXPO_PUBLIC_API_BASE_URL=http://<PC_IP>:8000
```

> `Client Secret`은 앱에 전달하지 않습니다. Secret은 서버/백엔드에서만 사용하세요.

## 3) 동작 확인 체크

### DriverActiveSession
1. 세션 생성 후 `DriverActiveSession` 진입
2. `Load driver location` 버튼 클릭
3. 지도 출력 + 마커 표시 확인

### PassengerShare
1. 링크 진입 후 `PassengerShare` 진입
2. 위치 권한 허용
3. 지도에 현재 위치 마커 표시 확인
4. `Start sharing` 토글 시 주기 호출(`5초`)이 동작하고 `point_id` 또는 `saved_at` 값 표시 확인

### 링크 상태
1. 세션 종료/만료 후 `SessionStateNotice`에서 `can_access`가 반영되는지 확인
