import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator } from "react-native";
import requestJson, { authHeader } from "../api/httpClient";
// [학습 포인트 1] 지도 컴포넌트 및 설정 임포트
import NaverDynamicMap from "../components/NaverDynamicMap";
import { MAP_DEFAULT_ZOOM, MAP_DEFAULT_CENTER, NAVER_MAP_CLIENT_ID } from "../config/mapConfig";

export default function DriverActiveSession({ route, navigation }) {
  const {
    sessionId,
    linkToken,
    sessionStatus: initialSessionStatus,
    sessionExpiresAt,
    driverToken,
  } = route.params || {};

  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus || "active");
  const [driverLocation, setDriverLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * [학습 포인트 2] 지도 좌표 바인딩
   * 서버에서 받은 위치가 있으면 그 좌표를 사용하고, 없으면 기본 중심점(서울시청)을 보여줍니다.
   */
  const mapLatitude = driverLocation?.latitude ?? MAP_DEFAULT_CENTER.latitude;
  const mapLongitude = driverLocation?.longitude ?? MAP_DEFAULT_CENTER.longitude;

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
        path: `/api/v1/sessions/${sessionId}/driver-location`,
        headers: authHeader(driverToken),
      });
      // 성공 시 위치 정보를 업데이트하면 지도가 자동으로 리렌더링되며 마커가 이동합니다.
      setDriverLocation(result.location || null);
    } catch (e) {
      setError(e.message || "위치 정보 조회 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await requestJson({
        method: "POST",
        path: `/api/v1/sessions/${sessionId}/end`,
        headers: { ...authHeader(driverToken), "Content-Type": "application/json" },
        body: { reason: "driver_end" },
      });

      setSessionStatus(result.session_status || "ended");
      navigation.navigate("SessionStateNotice", {
        linkToken,
        canAccess: false,
        reason: result.reason || "driver_end",
        message: `세션이 종료되었습니다. (${result.link_revoked_count || 0}개 링크 무효화)`,
      });
    } catch (e) {
      setError(e.message || "세션 종료 실패");
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
        <Text style={styles.label}>조회된 위치 (지도 마커)</Text>
        <Text style={styles.value}>
          {driverLocation
            ? `위도 ${driverLocation.latitude}, 경도 ${driverLocation.longitude}`
            : "아직 위치 정보가 없습니다."}
        </Text>
      </View>

      {/* [학습 포인트 3] 공통 지도 컴포넌트 호출 
          좌표가 바뀔 때마다 WebView 내부의 지도가 갱신됩니다.
      */}
      <NaverDynamicMap
        clientId={NAVER_MAP_CLIENT_ID}
        latitude={mapLatitude}
        longitude={mapLongitude}
        zoom={MAP_DEFAULT_ZOOM}
        markerTitle="탑승자 위치"
        markerText={driverLocation ? "탑승자의 현재 위치입니다" : "위치를 불러오는 중..."}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.row}>
        {isLoading ? <ActivityIndicator size="small" color="#000" /> : null}
      </View>

      <View style={styles.row}>
        <Button
          title="위치 정보 불러오기"
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
          title="탑승자 화면 샘플 열기"
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

      <View style={styles.row}>
        <Text style={styles.label}>세션 만료 시간</Text>
        <Text style={styles.value}>{sessionExpiresAt || "-"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 10,
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
    marginTop: 6,
  },
});
