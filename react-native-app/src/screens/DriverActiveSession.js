import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator } from "react-native";
import requestJson, { authHeader } from "../api/httpClient";

export default function DriverActiveSession({ route, navigation }) {
  // [학습 포인트 1] 이전 화면에서 넘겨받은 데이터(Params) 추출
  // route.params를 통해 sessionId, linkToken 등 핵심 식별자를 가져옵니다.
  const {
    sessionId,
    linkToken,
    sessionStatus: initialSessionStatus,
    sessionExpiresAt,
    driverToken,
  } = route.params || {};

  // 세션 상태와 운전자 위치 정보를 관리하는 State
  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus || "active");
  const [driverLocation, setDriverLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * [학습 포인트 2] 서버로부터 운전자 위치 조회 (GET 요청)
   * 특정 세션의 현재 저장된 운전자 위치를 가져옵니다.
   */
  const fetchDriverLocation = async () => {
    if (!sessionId) {
      setError("세션 ID가 없습니다.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await requestJson({
        method: "GET",
        // 경로 파라미터(Path Parameter)에 sessionId를 포함시킵니다.
        path: `/api/v1/sessions/${sessionId}/driver-location`,
        headers: authHeader(driverToken),
      });
      // 성공 시 위치 정보 업데이트
      setDriverLocation(result.location);
    } catch (e) {
      setError(e.message || "운전자 위치 조회 실패");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * [학습 포인트 3] 세션 강제 종료 (POST 요청)
   * 운전자가 직접 세션을 종료하고 탑승자의 접근을 차단합니다.
   */
  const endSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await requestJson({
        method: "POST",
        path: `/api/v1/sessions/${sessionId}/end`,
        headers: { ...authHeader(driverToken) },
        body: { reason: "driver_end" }, // 종료 사유를 본문에 담아 보냄
      });

      // 서버에서 바뀐 상태 반영
      setSessionStatus(result.session_status || "ended");
      
      // [학습 포인트 4] 안내 화면으로 이동
      // 종료 결과(링크가 몇 개나 취소되었는지 등)를 함께 전달합니다.
      navigation.navigate("SessionStateNotice", {
        linkToken,
        reason: result.reason || "driver_end",
        canAccess: false,
        message: `세션이 종료되었습니다. (연결된 링크 ${result.link_revoked_count || 0}개 무효화)`,
      });
    } catch (e) {
      setError(e.message || "세션 종료 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>세션 관리 (운전자)</Text>

      <View style={styles.row}>
        <Text style={styles.label}>세션 ID</Text>
        <Text style={styles.value}>{sessionId || "-"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>세션 상태</Text>
        <Text style={styles.value}>{sessionStatus}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{linkToken || "-"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>만료 예정</Text>
        <Text style={styles.value}>{sessionExpiresAt || "-"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>내 현재 위치 (서버 기록)</Text>
        <Text style={styles.value}>
          {driverLocation
            ? `위도: ${driverLocation.latitude}, 경도: ${driverLocation.longitude}`
            : "조회된 위치 없음"}
        </Text>
      </View>

      {/* 에러가 있을 경우 빨간 글씨로 안내 */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.row}>
        {isLoading ? <ActivityIndicator size="small" color="#000" /> : null}
      </View>

      <View style={styles.row}>
        <Button
          title="운전자 위치 새로고침"
          onPress={fetchDriverLocation}
          disabled={!sessionId || isLoading}
        />
      </View>

      <View style={styles.row}>
        <Button
          title="이동 종료 (세션 마감)"
          onPress={endSession}
          color="#d9534f"
          disabled={!sessionId || isLoading}
        />
      </View>

      <View style={styles.row}>
        <Button
          title="탑승자 화면 샘플 보기"
          onPress={() =>
            navigation.navigate("PassengerLinkLanding", {
              linkToken: linkToken || "link-001",
              sessionStatus: sessionStatus,
              linkActive: true,
            })
          }
          disabled={!linkToken}
        />
      </View>
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
  row: {
    marginVertical: 6,
  },
  label: {
    fontWeight: "700",
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: "#333",
  },
  errorText: {
    color: "#cc0000",
    marginTop: 4,
  },
});
