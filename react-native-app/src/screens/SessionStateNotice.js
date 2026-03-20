import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import requestJson from "../api/httpClient";

export default function SessionStateNotice({ route, navigation }) {
  console.log("SessionStateNotice.js 실행함");

  // [학습 포인트 1] 공통 안내 화면의 파라미터 수신
  // 세션이 왜 끝났는지(reason), 현재 서버 상태는 어떠한지 등을 파라미터로 받습니다.
  const { reason, canAccess, message, linkToken } = route.params || {};

  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * [학습 포인트 2] 안내 화면에서도 최신 상태 조회 (GET /api/v1/links/.../status)
   * 화면을 보고 있는 도중에 세션이 만료되었을 수도 있으므로 최신 상태를 불러옵니다.
   */
  const fetchStatus = async () => {
    console.log("SessionStateNotice.js 에서 const fetchStatus실행함");

    if (!linkToken) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await requestJson({
        method: "GET",
        path: `/api/v1/links/${linkToken}/status`,
      });
      setServerStatus(result);
    } catch (e) {
      setError(e.message || "상태 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [linkToken]);

  // [학습 포인트 3] 데이터 우선순위 결정 (Nullish Coalescing)
  // 서버에서 받은 값이 있으면 쓰고, 없으면 이전 화면에서 전달받은 예비(fallback) 값을 사용합니다.
  const currentCanAccess = serverStatus?.can_access ?? canAccess ?? false;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>세션 종료 및 안내</Text>

      <View style={styles.row}>
        <Text style={styles.label}>접속 가능 여부</Text>
        <Text style={styles.value}>
          {currentCanAccess ? "접속 가능" : "접속 불가 (만료/종료)"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>링크 상태</Text>
        <Text style={styles.value}>
          {serverStatus?.link_status || message || reason || "정보 없음"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>세션 상태</Text>
        <Text style={styles.value}>{serverStatus?.session_status || "-"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>세션 만료 시간</Text>
        <Text style={styles.value}>
          {serverStatus?.session_expires_at || "-"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>링크 만료 시간</Text>
        <Text style={styles.value}>{serverStatus?.link_expires_at || "-"}</Text>
      </View>

      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.row}>
        <Button
          title="정보 새로고침"
          onPress={fetchStatus}
          disabled={loading || !linkToken}
        />
      </View>

      <View style={styles.row}>
        <Button
          title="처음 화면으로 돌아가기"
          onPress={() => navigation.navigate("DriverStart")}
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
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
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
});
