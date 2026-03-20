/**
 * [공부 포인트 1] API 통신을 위한 공통 경로(Base URL) 설정
 * 로컬 개발 시에는 본인의 컴퓨터 IP 주소를 사용해야 핸드폰(Expo Go)에서 접근이 가능합니다.
 * 환경 변수(EXPO_PUBLIC_API_BASE_URL)가 있으면 그것을 쓰고, 없으면 기본 IP를 사용합니다.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://172.30.1.83:8000";

// 테스트를 위한 기본 드라이버 토큰 (인증용)
export const DEFAULT_DRIVER_TOKEN = "DRIVER_TOKEN_1";

/**
 * [공부 포인트 2] 인증 헤더 생성기
 * API 호출 시 'Bearer' 스키마를 사용하는 Authorization 헤더를 만들어줍니다.
 */
export function authHeader(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * [공부 포인트 3] 안전한 JSON 파싱
 * 서버 응답이 비어있거나 올바른 JSON 형식이 아닐 경우 에러가 나지 않도록 처리합니다.
 */
function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * [공부 포인트 4] fetch API를 활용한 공통 요청 함수
 * @param {string} method - HTTP 메서드 (GET, POST 등)
 * @param {string} path - API 엔드포인트 경로
 * @param {object} body - 요청 본문 데이터
 * @param {object} headers - 추가 헤더
 */
export async function requestJson({ method = "GET", path, body, headers = {} }) {
  // 전체 URL 조립
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  
  // fetch 실행
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json", // JSON 형태로 데이터를 보냄을 명시
      ...headers,
    },
    // 본문 데이터가 있으면 문자열(JSON string)로 변환하여 전송
    body: body ? JSON.stringify(body) : undefined,
  });

  // 응답을 일단 텍스트로 받아낸 뒤
  const text = await response.text();
  // JSON으로 변환 시도
  const data = parseJsonSafe(text);

  /**
   * [공부 포인트 5] HTTP 상태 코드 처리
   * 200번대가 아닌 경우(4xx, 5xx) 에러를 던져(throw) 호출한 곳에서 처리하게 합니다.
   */
  if (!response.ok) {
    const detail = data?.detail || data?.message || "API 요청 실패";
    throw new Error(`${detail} (HTTP ${response.status})`);
  }

  return data;
}

export default requestJson;
