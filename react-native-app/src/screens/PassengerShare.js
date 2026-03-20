import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
// [학습 포인트 1] expo-location 임포트
// 기기의 GPS 정보를 가져오기 위해 엑스포 공식 위치 라이브러리를 사용합니다.
import * as Location from "expo-location";
import requestJson from "../api/httpClient";
import NaverDynamicMap from "../components/NaverDynamicMap";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, NAVER_MAP_CLIENT_ID } from "../config/mapConfig";

export default function PassengerShare({ route }) {
  const { linkToken, sessionStatus } = route.params || {};

  const [sharing, setSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastSharedAt, setLastSharedAt] = useState("아직 공유 전");
  const [pointId, setPointId] = useState("");
  const [error, setError] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);

  const timerRef = useRef(null);

  const mapLatitude = currentLocation?.latitude ?? MAP_DEFAULT_CENTER.latitude;
  const mapLongitude = currentLocation?.longitude ?? MAP_DEFAULT_CENTER.longitude;

  const stopSharing = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * [학습 포인트 2] 위치 권한 확인 및 요청
   * 사용자의 기기에서 위치 정보 접근 권한을 명시적으로 받아야 합니다.
   */
  const ensurePermission = useCallback(async () => {
    if (permissionGranted) return true;

    // 포그라운드(앱이 켜져 있을 때) 위치 권한 요청
    const { status } = await Location.requestForegroundPermissionsAsync();
    const ok = status === "granted";
    setPermissionGranted(ok);
    if (!ok) {
      setError("위치 권한이 거부되었습니다.");
      return false;
    }
    return true;
  }, [permissionGranted]);

  /**
   * [학습 포인트 3] 현재 위치 좌표 획득
   * GPS를 통해 현재 기기의 위도와 경도를 가져옵니다.
   */
  const getCurrentPosition = useCallback(async () => {
    const hasPermission = await ensurePermission();
    if (!hasPermission) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High, // 높은 정확도 설정
    });

    const { latitude, longitude, accuracy } = position.coords;
    const next = {
      latitude,
      longitude,
      accuracy,
      recordedAt: new Date().toISOString(),
    };
    // 상태를 업데이트하면 지도의 마커 위치가 바뀝니다.
    setCurrentLocation(next);
    return next;
  }, [ensurePermission]);

  /**
   * [학습 포인트 4] 실제 위치 데이터를 포함한 API 전송
   * 기존 목업 데이터 대신 GPS에서 얻은 실시간 좌표를 서버로 보냅니다.
   */
  const sendLocation = useCallback(
    async (position) => {
      const latest = position || (await getCurrentPosition());
      if (!latest) {
        throw new Error("위치 정보를 가져올 수 없습니다.");
      }

      const result = await requestJson({
        method: "POST",
        path: `/api/v1/links/${linkToken}/locations`,
        body: {
          latitude: latest.latitude,
          longitude: latest.longitude,
          accuracy_m: latest.accuracy ?? undefined,
          recorded_at: latest.recordedAt || new Date().toISOString(),
        },
      });

      setPointId(result.point_id || "");
      setLastSharedAt(`${new Date().toLocaleTimeString()} (저장됨: ${result.saved_at || "n/a"})`);
      setError("");
      return result;
    },
    [getCurrentPosition, linkToken]
  );

  const toggleShare = async () => {
    if (!linkToken) {
      setError("링크 토큰이 없습니다.");
      return;
    }

    if (sharing) {
      stopSharing();
      setSharing(false);
      setLastSharedAt("공유 중지");
      return;
    }

    setError("");
    const hasPermission = await ensurePermission();
    if (!hasPermission) {
      return;
    }

    setSharing(true);
    try {
      await sendLocation();
    } catch (e) {
      setError(e.message || "공유 실패");
      setSharing(false);
      return;
    }

    // 5초마다 현재 위치를 다시 얻어오고 서버에 전송 (실시간 갱신)
    timerRef.current = setInterval(async () => {
      try {
        await sendLocation();
      } catch (e) {
        setError(e.message || "위치 공유 중 오류");
      }
    }, 5000);
  };

  useEffect(() => {
    ensurePermission();
    return () => stopSharing();
  }, [ensurePermission, stopSharing]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 위치 공유 (탑승자)</Text>

      <View style={styles.row}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{linkToken || "-"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>세션 상태</Text>
        <Text style={styles.value}>{sessionStatus || "active"}</Text>
      </View>

      {/* 실시간으로 변화하는 내 위치를 마커로 표시 */}
      <NaverDynamicMap
        clientId={NAVER_MAP_CLIENT_ID}
        latitude={mapLatitude}
        longitude={mapLongitude}
        zoom={MAP_DEFAULT_ZOOM}
        markerTitle="내 현재 위치"
        markerText={currentLocation ? "내 위치가 공유되고 있습니다" : "위치를 찾는 중..."}
      />

      <View style={styles.row}>
        <Text style={styles.label}>공유 상태</Text>
        <Text style={styles.value}>{sharing ? "실시간 공유 중" : "중지됨"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>마지막 전송</Text>
        <Text style={styles.value}>{lastSharedAt}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>현재 위도/경도</Text>
        <Text style={styles.value}>
          {currentLocation
            ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
            : "측정 전"}
        </Text>
      </View>
      {pointId ? (
        <View style={styles.row}>
          <Text style={styles.label}>서버 저장 Point ID</Text>
          <Text style={styles.value}>{pointId}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <Button
        title={sharing ? "공유 중단하기" : "실시간 위치 공유 시작"}
        color={sharing ? "#cc0000" : "#007AFF"}
        onPress={toggleShare}
        disabled={!linkToken}
      />
      <View style={styles.row}>
        <Text style={styles.note}>5초마다 GPS를 갱신하여 서버에 전송합니다.</Text>
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
    marginVertical: 4,
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
  errorText: {
    color: "#cc0000",
  },
  note: {
    fontSize: 12,
    color: "#888",
    marginTop: 10,
    fontStyle: "italic",
  },
});
