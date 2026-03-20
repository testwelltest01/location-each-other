// [학습 포인트 1] EXPO_PUBLIC_ 접두사의 의미
// Expo 프로젝트에서 'EXPO_PUBLIC_'으로 시작하는 환경변수는 앱 코드(클라이언트)에서 
// process.env를 통해 직접 접근할 수 있습니다. 
export const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID || "";

// [학습 포인트 2] 지도 기본 중심점 (서울시청 좌표)
export const MAP_DEFAULT_CENTER = {
  latitude: 37.5665,
  longitude: 126.978,
};

// [학습 포인트 3] 기본 줌 레벨 (숫자가 클수록 더 확대됨)
export const MAP_DEFAULT_ZOOM = 16;
