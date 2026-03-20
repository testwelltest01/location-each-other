import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import requestJson from "../api/httpClient";

export default function PassengerShare({ route }) {
  const { linkToken, sessionStatus } = route.params || {};

  // 공유 상태 관리
  const [sharing, setSharing] = useState(false);
  const [lastSharedAt, setLastSharedAt] = useState("아직 공유 전");
  const [pointId, setPointId] = useState("");
  const [error, setError] = useState("");

  /**
   * [학습 포인트 1] useRef의 활용
   * timerRef: setInterval의 ID를 저장합니다. 화면이 다시 그려져도 값이 유지되어야 하지만, 값이 바뀌었다고 화면을 다시 그릴 필요는 없을 때 사용합니다.
   * indexRef: 샘플 데이터를 순차적으로 보여주기 위한 인덱스를 저장합니다.
   */
  const timerRef = useRef(null);
  const indexRef = useRef(0);

  // 시뮬레이션을 위한 샘플 위치 데이터
  const samplePoints = [
    { latitude: 37.5665, longitude: 126.978 },
    { latitude: 37.5670, longitude: 126.9776 },
    { latitude: 37.5658, longitude: 126.9778 },
  ];

  /**
   * [학습 포인트 2] 위치 전송 함수 (POST /api/v1/links/.../locations)
   * 서버에 현재 위도, 경도 데이터를 보냅니다.
   */
  const sendLocation = useCallback(async () => {
    const point = samplePoints[indexRef.current % samplePoints.length];
    indexRef.current += 1;

    try {
      const result = await requestJson({
        method: "POST",
        path: `/api/v1/links/${linkToken}/locations`,
        body: {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy_m: 5.0,
          recorded_at: new Date().toISOString(),
        },
      });

      // 전송 성공 시 서버에서 생성된 ID와 시간을 화면에 표시
      setPointId(result.point_id || "");
      setLastSharedAt(`${new Date().toLocaleTimeString()} (저장됨: ${result.saved_at || "n/a"})`);
      setError("");
    } catch (e) {
      setError(e.message || "위치 전송 중 오류 발생");
    }
  }, [linkToken]);

  // 타이머 중단 함수
  const stopSharing = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * [학습 포인트 3] Polling (주기적 실행) 구현
   * '공유 시작' 버튼을 누르면 5초마다 위치를 보내는 타이머를 시작합니다.
   */
  const toggleShare = async () => {
    if (!linkToken) {
      setError("링크 토큰이 없습니다.");
      return;
    }

    if (sharing) {
      stopSharing();
      setSharing(false);
      setLastSharedAt("공유 중단");
      return;
    }

    setSharing(true);
    setError("");

    try {
      // 시작하자마자 첫 번째 위치 전송 시도
      await sendLocation();
    } catch (e) {
      setError(e.message || "공유 시작 실패");
      setSharing(false);
      return;
    }

    // 5초 간격으로 반복 실행 (Polling)
    timerRef.current = setInterval(async () => {
      await sendLocation();
    }, 5000);
  };

  /**
   * [학습 포인트 4] 컴포넌트 언마운트 시 정리 (Cleanup)
   * 사용자가 이 화면을 벗어날 때 타이머를 끄지 않으면 백그라운드에서 계속 실행되어 리소스를 낭비하게 됩니다.
   */
  useEffect(() => {
    return () => stopSharing(); // 화면을 나갈 때 타이머를 확실히 끕니다.
  }, [stopSharing]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>실시간 위치 공유 (탑승자)</Text>

      <View style={styles.row}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{linkToken || "-"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>세션 상태</Text>
        <Text style={styles.value}>{sessionStatus || "active"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>공유 상태</Text>
        <Text style={styles.value}>{sharing ? "공유 중 (Running)" : "중지됨 (Stopped)"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>마지막 전송 시간</Text>
        <Text style={styles.value}>{lastSharedAt}</Text>
      </View>

      {pointId ? (
        <View style={styles.row}>
          <Text style={styles.label}>서버 저장 ID (Point ID)</Text>
          <Text style={styles.value}>{pointId}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        title={sharing ? "위치 공유 중단하기" : "내 실시간 위치 공유 시작"}
        color={sharing ? "#cc0000" : "#007AFF"}
        onPress={toggleShare}
        disabled={!linkToken}
      />

      <View style={styles.row}>
        <Text style={styles.note}>샘플 좌표를 사용하여 5초 간격으로 서버에 전송합니다.</Text>
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
