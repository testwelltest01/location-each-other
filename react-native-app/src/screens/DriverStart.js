import React, { useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
// [학습 포인트 1] 공통 API 요청 함수 임포트
import requestJson, {
  DEFAULT_DRIVER_TOKEN,
  authHeader,
} from "../api/httpClient";

export default function DriverStart({ navigation }) {
  console.log("DriverStart.js 에서 function DriverStart 실행함");

  // [학습 포인트 2] 비동기 통신을 위한 상태 정의
  // isLoading: 현재 서버와 통신 중인지 여부 (UI에서 로딩 바를 보여주기 위함)
  // message: 사용자에게 보여줄 안내 메시지나 에러 메시지
  // sessionInfo: 서버로부터 받은 세션 데이터 (ID, 만료시간 등)
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);

  /**
   * [학습 포인트 3] 세션 생성 함수 (비동기)
   * 서버에 POST 요청을 보내 새로운 세션을 만듭니다.
   */
  const createSession = async () => {
    console.log("DriverStart.js 에서 const createSession 실행함");

    setIsLoading(true); // 통신 시작 시 로딩 상태 활성화
    setMessage(""); // 이전 메시지 초기화

    try {
      // [학습 포인트 4] 실제 API 호출 (POST /api/v1/sessions)
      const response = await requestJson({
        method: "POST",
        path: "/api/v1/sessions",
        headers: authHeader(DEFAULT_DRIVER_TOKEN), // 인증 헤더 추가
        body: {
          driver_id: "11111111-1111-1111-1111-111111111111", // 실제 앱에선 로그인된 ID 사용
          session_ttl_minutes: 120, // 2시간 유지
          link_ttl_minutes: 120,
          max_access_count: null,
        },
      });

      // 서버 응답 데이터를 상태에 저장
      setSessionInfo(response);
      setMessage("세션이 성공적으로 생성되었습니다.");

      // [학습 포인트 5] 성공 시 자동 화면 전환
      // 서버에서 받은 실제 ID와 토큰들을 다음 화면으로 전달합니다.
      navigation.navigate("DriverActiveSession", {
        sessionId: response.session_id,
        linkToken: response.link_token,
        sessionStatus: response.session_status,
        sessionExpiresAt: response.expires_at,
        linkUrl: response.link_url,
        driverToken: DEFAULT_DRIVER_TOKEN,
      });
    } catch (e) {
      // 에러 발생 시 사용자에게 에러 내용 표시
      setMessage(e.message || "세션 생성에 실패했습니다.");
    } finally {
      // 통신이 성공하든 실패하든 로딩 상태는 해제
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>세션 시작 (운전자)</Text>

      <View style={styles.section}>
        <Text style={styles.label}>드라이버 토큰 (Auth)</Text>
        <Text style={styles.value}>{DEFAULT_DRIVER_TOKEN}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>현재 세션 상태</Text>
        <Text style={styles.value}>{sessionInfo?.session_status || "-"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>세션 ID</Text>
        <Text style={styles.value}>{sessionInfo?.session_id || "-"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{sessionInfo?.link_token || "-"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>세션 만료 시간</Text>
        <Text style={styles.value}>{sessionInfo?.expires_at || "-"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>상태 안내</Text>
        <Text style={styles.value}>
          {message || "세션 시작 버튼을 눌러주세요."}
        </Text>
      </View>

      <View style={styles.row}>
        {/* 통신 중일 때는 버튼을 비활성화(disabled)하여 중복 요청을 방지합니다. */}
        <Button
          title={isLoading ? "생성 중..." : "새 세션 시작 (API 호출)"}
          onPress={createSession}
          disabled={isLoading}
        />
      </View>

      {/* [학습 포인트 6] ActivityIndicator (로딩 스피너)
          사용자에게 '작업 중'임을 시각적으로 알려주는 핵심 UI 요소입니다.
      */}
      {isLoading ? (
        <ActivityIndicator style={styles.row} size="small" color="#0000ff" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  section: {
    marginVertical: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  row: {
    marginTop: 8,
  },
  label: {
    fontWeight: "700",
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: "#333",
  },
});
