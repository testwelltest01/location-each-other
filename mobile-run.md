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
- 실제 단말에서 테스트하려면 같은 네트워크(Wi-Fi)에서 백엔드 주소를 PC LAN IP로 설정하세요.

## 2) 앱 환경변수

`EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`를 사용해 Naver Map 클라이언트 키를 주입합니다.
- React Native 앱에서 읽는 변수: `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`
- 클라이언트 키는 앱 시작 전 환경변수로 설정

Windows 예시(PowerShell):

```powershell
$env:EXPO_PUBLIC_NAVER_MAP_CLIENT_ID="<YOUR_NAVER_CLIENT_ID>"
npm run start
```

권장: 프로젝트 루트에 `.env` 또는 `.env.local` 작성

```bash
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=<YOUR_NAVER_CLIENT_ID>
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
