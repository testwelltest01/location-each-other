import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator } from "react-native";
import requestJson from "../api/httpClient";

export default function PassengerLinkLanding({ route, navigation }) {
  const { linkToken: initialLinkToken, sessionStatus, linkActive } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkToken] = useState(initialLinkToken || "");

  /**
   * [학습 포인트 1] useEffect를 활용한 화면 진입 시 자동 실행
   * 탑승자가 링크를 누르고 들어오자마자 서버에 이 링크가 유효한지 물어봅니다.
   */
  useEffect(() => {
    // [학습 포인트 2] Memory Leak 방지를 위한 alive 패턴
    // 비동기 작업 도중 사용자가 화면을 나갔을 때, 상태 업데이트를 방지합니다.
    let alive = true;

    const checkLink = async () => {
      if (!linkToken) {
        setError("링크 토큰이 없습니다.");
        setLoading(false);
        return;
      }

      try {
        // 실제 API 호출 (GET /api/v1/links/{token})
        const result = await requestJson({
          method: "GET",
          path: `/api/v1/links/${linkToken}`,
        });
        
        if (!alive) return;
        setLinkInfo(result);

        // [학습 포인트 3] 자동 화면 전환 (인가되지 않은 경우)
        // 링크가 만료되었거나 비활성 상태면 자동으로 안내 화면으로 보냅니다.
        if (!result.link_active) {
          // 'replace'를 사용하면 뒤로가기로 다시 이 화면에 오지 못하게 막습니다.
          navigation.replace("SessionStateNotice", {
            linkToken,
            canAccess: false,
            reason: result.session_status || "inactive",
            message: "이 링크는 더 이상 사용할 수 없습니다.",
          });
        }
      } catch (e) {
        if (!alive) return;
        setError(e.message || "링크 확인 중 오류 발생");
        // 에러 발생 시에도 안내 화면으로 리다이렉트
        navigation.replace("SessionStateNotice", {
          linkToken,
          canAccess: false,
          reason: "link_error",
          message: e.message || "서버 통신 실패",
        });
      } finally {
        if (alive) setLoading(false);
      }
    };

    checkLink();

    // Cleanup 함수: 컴포넌트가 사라질 때 실행됩니다.
    return () => {
      alive = false;
    };
  }, [linkToken]);

  // 서버로부터 받은 데이터가 있으면 그것을 우선 사용, 없으면 초기 전달받은 값 사용
  const isActive = (linkInfo?.link_active ?? linkActive) === true;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>링크 접속 대기 (탑승자)</Text>

      <View style={styles.row}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{linkToken || "-"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>현재 서버 상태</Text>
        <Text style={styles.value}>{linkInfo?.session_status || sessionStatus || "확인 중..."}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>링크 활성화 여부</Text>
        <Text style={styles.value}>{isActive ? "활성 (접속 가능)" : "비활성 (만료/종료)"}</Text>
      </View>

      {/* 로딩 중일 때 보여줄 UI */}
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#0000ff" />
          <Text style={styles.value}>링크 유효성 검사 중...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* [학습 포인트 4] 조건부 렌더링
          서버 확인 결과 접속 가능한 상태일 때만 '위치 공유 시작' 버튼을 노출합니다.
      */}
      {isActive ? (
        <View style={styles.row}>
          <Button
            title="나의 위치 공유 시작하기"
            onPress={() =>
              navigation.navigate("PassengerShare", {
                linkToken,
                sessionStatus: linkInfo?.session_status || sessionStatus || "active",
              })
            }
          />
        </View>
      ) : null}

      {!isActive && !loading ? (
        <View style={styles.row}>
          <Button
            title="세션 상태 확인하러 가기"
            color="#666"
            onPress={() =>
              navigation.replace("SessionStateNotice", {
                linkToken,
                canAccess: false,
                reason: "inactive",
                message: error || "링크가 유효하지 않습니다.",
              })
            }
          />
        </View>
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
  row: {
    marginVertical: 6,
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
