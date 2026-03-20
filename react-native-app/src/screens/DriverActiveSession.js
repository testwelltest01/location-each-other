import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import requestJson, { authHeader } from "../api/httpClient";
// [학습 포인트 1] 지도 컴포넌트 및 설정 임포트
import NaverDynamicMap from "../components/NaverDynamicMap";
import {
  MAP_DEFAULT_ZOOM,
  MAP_DEFAULT_CENTER,
  NAVER_MAP_CLIENT_ID,
} from "../config/mapConfig";

export default function DriverActiveSession({ route, navigation }) {
  console.log("DriverActiveSession.js 실행함");

  const {
    sessionId,
    linkToken,
    sessionStatus: initialSessionStatus,
    sessionExpiresAt,
    driverToken,
  } = route.params || {};
  console.log(route.params);

  const [sessionStatus, setSessionStatus] = useState(
    initialSessionStatus || "active",
  );
  const [driverLocation, setDriverLocation] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [passengerLocations, setPassengerLocations] = useState([]);
  const [links, setLinks] = useState([]); // [linkInfo, ...]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const timerRef = useRef(null);
  const mapReadyRef = useRef(false);

  const stopSharing = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopSharing();
  }, [stopSharing]);

  // 화면 진입 시 자동 공유 시작
  useEffect(() => {
    if (sessionId) {
      fetchLinks();
      if (!sharing) {
        toggleShare();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /**
   * [학습 포인트 2] 지도 좌표 바인딩
   * 서버에서 받은 위치가 있으면 그 좌표를 사용하고, 없으면 기본 중심점(서울시청)을 보여줍니다.
   */
  const mapLatitude = driverLocation?.latitude ?? MAP_DEFAULT_CENTER.latitude;
  const mapLongitude =
    driverLocation?.longitude ?? MAP_DEFAULT_CENTER.longitude;

  const ensurePermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("위치 권한이 필요합니다.");
      return false;
    }
    return true;
  };

  const sendCurrentLocation = async () => {
    if (!sessionId) return;

    try {
      // 실제 기기의 현재 위치 가져오기
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = position.coords;

      // 상단 상태(지도)를 즉시 업데이트하여 반응성을 높임
      setDriverLocation({ latitude, longitude, accuracy });

      await requestJson({
        method: "POST",
        path: `/api/v1/sessions/${sessionId}/driver-location`,
        headers: {
          ...authHeader(driverToken),
          "Content-Type": "application/json",
        },
        body: {
          latitude: latitude,
          longitude: longitude,
          accuracy_m: accuracy || 0,
        },
      });
      console.log("위치 자동 전송 성공: ", { latitude, longitude });
    } catch (e) {
      console.log("위치 전송 중 에러: ", e.message);
      setError("실시간 위치 전송 중 오류 발생");
    }
  };

  const toggleShare = async () => {
    console.log("DriverActiveSession.js에서 const toggleShare 실행함");
    if (!sessionId) return;

    if (sharing) {
      stopSharing();
      setSharing(false);
      setMessage("위치 공유가 중지되었습니다.");
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    const hasPermission = await ensurePermission();
    if (!hasPermission) return;

    setSharing(true);
    setError("");
    setMessage("실시간 위치 공유를 시작합니다.");

    // 즉시 한 번 전송
    await sendCurrentLocation();

    // 2초 주기로 전송 및 탑승자 위치 조회
    timerRef.current = setInterval(async () => {
      await sendCurrentLocation();
      await fetchPassengerLocations();
    }, 2000);
  };

  const fetchLinks = async () => {
    if (!sessionId) return;
    try {
      const result = await requestJson({
        method: "GET",
        path: `/api/v1/sessions/${sessionId}/links`,
        headers: authHeader(driverToken),
      });
      // 무효화되지 않은 링크만 필터링하거나 전체를 보여줄 수 있음. 여기서는 전체를 보여주되 상태 표시
      setLinks(result.links || []);
    } catch (e) {
      console.log("링크 목록 조회 실패:", e.message);
    }
  };

  const createNewLink = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      await requestJson({
        method: "POST",
        path: `/api/v1/sessions/${sessionId}/links`,
        headers: authHeader(driverToken),
      });
      await fetchLinks();
      setMessage("새로운 공유 링크가 생성되었습니다.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setError("링크 생성 실패: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSingleLink = async (token) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      await requestJson({
        method: "DELETE",
        path: `/api/v1/sessions/${sessionId}/links/${token}`,
        headers: authHeader(driverToken),
      });
      await fetchLinks();
      setMessage("해당 링크가 무효화되었습니다.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setError("링크 무효화 실패: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLinkName = async (token, newName) => {
    if (!sessionId || !newName) return;
    setIsLoading(true);
    try {
      await requestJson({
        method: "PATCH",
        path: `/api/v1/sessions/${sessionId}/links/${token}`,
        headers: {
          ...authHeader(driverToken),
          "Content-Type": "application/json",
        },
        body: { display_name: newName },
      });
      await fetchLinks();
      setMessage("링크 이름이 변경되었습니다.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setError("이름 변경 실패: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenamePress = (link) => {
    Alert.prompt(
      "링크 이름 변경",
      "이 링크의 이름을 입력해주세요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          onPress: (newName) => updateLinkName(link.link_token, newName),
        },
      ],
      "plain-text",
      link.display_name || "",
    );
  };

  const revokeAllLinks = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      await requestJson({
        method: "DELETE",
        path: `/api/v1/sessions/${sessionId}/links`,
        headers: authHeader(driverToken),
      });
      await fetchLinks();
      setPassengerLocations([]);
      setMessage("모든 링크가 무효화되었습니다.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setError("링크 무효화 실패: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPassengerLocations = async () => {
    if (!sessionId) return;
    try {
      const result = await requestJson({
        method: "GET",
        path: `/api/v1/sessions/${sessionId}/passengers`,
        headers: authHeader(driverToken),
      });
      setPassengerLocations(result.passengers || []);
    } catch (e) {
      console.log("탑승자 위치 조회 실패:", e.message);
    }
  };

  const fetchDriverLocation = async () => {
    console.log("DriverActiveSession.js에서 const fetchDriverLocation 실행함");

    if (!sessionId) {
      console.log("세션 ID가 없습니다.");
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
      setDriverLocation(result.location || null);
      console.log("result: ", result);
    } catch (e) {
      setError(e.message || "위치 정보 조회 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (token) => {
    // Vercel 운영 서버 주소
    const fullUrl = `https://moving-gamma.vercel.app/?token=${token}`;
    try {
      await Share.share({
        message: `탑승자 위치 공유 링크입니다:\n${fullUrl}`,
        url: fullUrl, // iOS 전용
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const endSession = async () => {
    console.log("DriverActiveSession.js에서 const endSession 실행함");
    if (!sessionId) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await requestJson({
        method: "POST",
        path: `/api/v1/sessions/${sessionId}/end`,
        headers: {
          ...authHeader(driverToken),
          "Content-Type": "application/json",
        },
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

  const getConnectionStatus = (link) => {
    if (link.is_revoked) return "revoked";

    const loc = passengerLocations.find(
      (p) => p.link_token === link.link_token,
    );
    if (!loc) return "disconnected";

    // 수동 중단 체크 (0,0)
    if (loc.latitude === 0 && loc.longitude === 0) return "disconnected";

    // 타임아웃 체크 (최근 20초 이내 수신 여부)
    const now = Date.now();
    const recordedTime = new Date(loc.recorded_at).getTime();
    const diffSeconds = (now - recordedTime) / 1000;

    if (diffSeconds > 20) {
      return "disconnected";
    }

    return "connected";
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
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
        markerTitle="내 위치"
        passengers={passengerLocations}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.messageText}>{message}</Text> : null}

      <View style={styles.row}>
        {isLoading ? <ActivityIndicator size="small" color="#000" /> : null}
      </View>

      <View style={styles.linkCard}>
        <Text style={styles.cardTitle}>
          탑승자 링크 관리 ({links.filter((l) => !l.is_revoked).length})
        </Text>
        <View style={styles.buttonRow}>
          <Button
            title="새 링크 생성"
            onPress={createNewLink}
            color="#4CD964"
          />
          <Button
            title="전체 무효화"
            onPress={revokeAllLinks}
            color="#FF3B30"
          />
        </View>
        <View style={styles.linkList}>
          {links.map((link, idx) => (
            <View
              key={link.link_token}
              style={[styles.linkRow, link.is_revoked && styles.revokedRow]}
            >
              <TouchableOpacity
                style={styles.linkInfoText}
                onPress={() => !link.is_revoked && handleRenamePress(link)}
              >
                <Text
                  style={[
                    styles.linkItem,
                    link.is_revoked && styles.revokedText,
                  ]}
                >
                  {idx + 1}.{" "}
                  {link.display_name || link.link_token.substring(0, 8)}{" "}
                  {link.is_revoked ? "(만료)" : ""}
                  {!link.is_revoked &&
                    getConnectionStatus(link) === "disconnected" && (
                      <Text
                        style={{
                          color: "#d9534f",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        {" "}
                        (연결 중단됨)
                      </Text>
                    )}
                </Text>
                <Text style={styles.accessText}>
                  접속: {link.access_count}회 | 클릭하여 이름 변경
                </Text>
              </TouchableOpacity>
              <View style={styles.linkActionButtons}>
                {!link.is_revoked && (
                  <View
                    style={[
                      styles.statusBadge,
                      getConnectionStatus(link) === "connected"
                        ? styles.statusBadgeO
                        : styles.statusBadgeX,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {getConnectionStatus(link) === "connected"
                        ? "연결O"
                        : "연결X"}
                    </Text>
                  </View>
                )}
                {!link.is_revoked && (
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(link.link_token)}
                  >
                    <Text style={styles.copyBtnText}>공유</Text>
                  </TouchableOpacity>
                )}
                {!link.is_revoked && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => revokeSingleLink(link.link_token)}
                  >
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {links.length === 0 && (
            <Text style={styles.emptyLink}>생성된 링크가 없습니다.</Text>
          )}
        </View>
      </View>

      <View style={styles.row}>
        <Button
          title={sharing ? "위치 공유 중지" : "내 실시간 위치 공유 시작"}
          onPress={toggleShare}
          color={sharing ? "#d9534f" : "#007AFF"}
          disabled={!sessionId || isLoading}
        />
        {sharing && (
          <Text style={styles.note}>
            2초 간격으로 서버에 위치를 전송 및 탑승자 확인 중입니다.
          </Text>
        )}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
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
    textAlign: "center",
  },
  messageText: {
    color: "#008800",
    marginTop: 6,
    textAlign: "center",
    fontWeight: "bold",
  },
  note: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  linkCard: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    marginVertical: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#444",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  linkList: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
  linkItem: {
    fontSize: 13,
    color: "#666",
    fontFamily: "monospace",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  copyBtn: {
    backgroundColor: "#eee",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#fff0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ffcccc",
  },
  deleteBtnText: {
    fontSize: 12,
    color: "#FF3B30",
    fontWeight: "700",
  },
  linkActionButtons: {
    flexDirection: "row",
    gap: 6,
  },
  revokedRow: {
    opacity: 0.5,
    backgroundColor: "#f2f2f2",
  },
  revokedText: {
    textDecorationLine: "line-through",
  },
  accessText: {
    fontSize: 10,
    color: "#888",
  },
  linkInfoText: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  statusBadgeO: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  statusBadgeX: {
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333",
  },
});
