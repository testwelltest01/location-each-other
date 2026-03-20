# Expo 모바일 앱 실행 가이드 (MVP 화면 뼈대)

이 문서는 `react-native-app` 디렉터리의 Expo 스켈레톤 앱을 로컬에서 실행하는 최소 방법만 정리합니다.

## 1) 사전 준비

- Node.js 18+ 권장
- npm 또는 yarn
- iOS는 Xcode/시뮬레이터, Android는 Android Studio/에뮬레이터 또는 실제 기기
- 모바일 실행용 Expo Go 설치(실기기)

## 2) 앱 실행

```bash
cd C:\Users\user\Desktop\20260320\react-native-app
npm install
npm run start
```

- `npm run start`는 Expo 개발 서버를 띄웁니다.
- 터미널에 출력되는 QR 코드를 iOS/Android Expo Go로 스캔해서 실행합니다.

## 3) 바로 실행(에뮬레이터)

```bash
cd C:\Users\user\Desktop\20260320\react-native-app
npm run android   # Android 에뮬레이터 실행
# npm run ios     # macOS + Xcode 환경에서 iOS 실행
# npm run web     # 브라우저(web) 실행
```

## 4) 검증 체크리스트

- [ ] 앱이 열리고 화면 5개가 보이는가
- [ ] 탭/버튼으로 화면 이동이 가능한가 (`DriverStart` → `DriverActiveSession` 등)
- [ ] 뒤로가기/화면 전환이 충돌 없이 동작하는가

## 5) 주의

- 현재 단계는 API 연동 없이 더미 데이터/기본 상태로 동작합니다.
- 백엔드 연동은 나중 단계에서 `axios/fetch`로 연결합니다.
