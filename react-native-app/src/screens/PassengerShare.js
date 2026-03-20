import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Button, StyleSheet, ScrollView } from "react-native";
import * as Location from "expo-location";
import requestJson from "../api/httpClient";
import NaverDynamicMap from "../components/NaverDynamicMap";
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  NAVER_MAP_CLIENT_ID,
} from "../config/mapConfig";

export default function PassengerShare({ route }) {
  console.log("PassengerShare.js 실행함");

  const { linkToken, sessionStatus } = route.params || {};

  const safeLinkToken = String(linkToken || "").trim();

  const toSafeCoord = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const [sharing, setSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastSharedAt, setLastSharedAt] = useState("마지막 공유: -");
  const [pointId, setPointId] = useState("");
  const [error, setError] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);

  const timerRef = useRef(null);

  const mapLatitude = toSafeCoord(
    currentLocation?.latitude,
    MAP_DEFAULT_CENTER.latitude,
  );
  const mapLongitude = toSafeCoord(
    currentLocation?.longitude,
    MAP_DEFAULT_CENTER.longitude,
  );

  const stopSharing = useCallback(() => {
    console.log("PassengerShare.js 에서 const stopSharing실행함");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const ensurePermission = useCallback(async () => {
    console.log("PassengerShare.js 에서 const ensurePermission 실행함");

    if (permissionGranted) return true;

    const { status } = await Location.requestForegroundPermissionsAsync();
    const ok = status === "granted";
    setPermissionGranted(ok);
    if (!ok) {
      setError("위치 권한이 허용되어 있지 않습니다.");
      return false;
    }
    return true;
  }, [permissionGranted]);

  const getCurrentPosition = useCallback(async () => {
    console.log("PassengerShare.js 에서 const getCurrentPosition 실행함");
    const hasPermission = await ensurePermission();
    if (!hasPermission) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude, accuracy } = position.coords;
    const next = {
      latitude,
      longitude,
      accuracy,
      recordedAt: new Date().toISOString(),
    };
    setCurrentLocation(next);
    return next;
  }, [ensurePermission]);

  const sendLocation = useCallback(
    async (position) => {
      console.log("PassengerShare.js 에서 const sendLocation 실행함");
      const latest = position || (await getCurrentPosition());
      if (!latest) {
        throw new Error("위치 좌표를 가져올 수 없습니다.");
      }

      const result = await requestJson({
        method: "POST",
        path: `/api/v1/links/${safeLinkToken}/locations`,
        body: {
          latitude: latest.latitude,
          longitude: latest.longitude,
          accuracy_m: latest.accuracy ?? undefined,
          recorded_at: latest.recordedAt || new Date().toISOString(),
        },
      });

      setPointId(result.point_id || "");
      setLastSharedAt(
        `${new Date().toLocaleTimeString()} (저장: ${result.saved_at || "n/a"})`,
      );
      setError("");
      return result;
    },
    [getCurrentPosition, safeLinkToken],
  );

  const toggleShare = async () => {
    console.log("PassengerShare.js 에서 const toggleShare 실행함");
    if (!safeLinkToken) {
      setError("링크 토큰이 없습니다.");
      return;
    }

    if (sharing) {
      stopSharing();
      setSharing(false);
      setLastSharedAt("공유 중지됨");
      return;
    }

    setError("");
    const hasPermission = await ensurePermission();
    if (!hasPermission) return;

    setSharing(true);
    try {
      await sendLocation();
    } catch (e) {
      setError(e.message || "공유 전송 실패");
      setSharing(false);
      return;
    }

    timerRef.current = setInterval(async () => {
      try {
        await sendLocation();
      } catch (e) {
        setError(e.message || "공유 전송 실패");
      }
    }, 5000);
  };

  useEffect(() => {
    let internalTimer = null;

    const startAutoShare = async () => {
      if (!safeLinkToken || sharing) return;

      const hasPermission = await ensurePermission();
      if (!hasPermission) return;

      setSharing(true);
      setError("");
      try {
        await sendLocation();
      } catch (e) {
        setError(e.message || "초기 공유 실패");
        setSharing(false);
        return;
      }

      internalTimer = setInterval(async () => {
        try {
          await sendLocation();
        } catch (e) {
          if (e.message.includes("410") || e.message.includes("403") || e.message.includes("expired") || e.message.includes("revoked")) {
            setError("이 세션(또는 링크)은 종료되었습니다.");
            setSharing(false);
            if (internalTimer) clearInterval(internalTimer);
          } else {
            setError(e.message || "자동 공유 실패");
          }
        }
      }, 5000);
      timerRef.current = internalTimer;
    };

    startAutoShare();

    return () => {
      if (internalTimer) clearInterval(internalTimer);
      stopSharing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLinkToken]);

  return (
    <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>실시간 위치 공유</Text>

      <View style={styles.row}>
        <Text style={styles.label}>링크 토큰</Text>
        <Text style={styles.value}>{safeLinkToken || "-"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>세션 상태</Text>
        <Text style={styles.value}>{sessionStatus || "active"}</Text>
      </View>

      <NaverDynamicMap
        clientId={NAVER_MAP_CLIENT_ID}
        latitude={mapLatitude}
        longitude={mapLongitude}
        zoom={MAP_DEFAULT_ZOOM}
        markerTitle="현재 위치"
      />

      <View style={styles.row}>
        <Text style={styles.label}>공유 상태</Text>
        <Text style={styles.value}>{sharing ? "공유 중" : "공유 중지됨"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>마지막 전송</Text>
        <Text style={styles.value}>{lastSharedAt}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>현재 위경도</Text>
        <Text style={styles.value}>
          {currentLocation
            ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
            : "수집 중인 위치 없음."}
        </Text>
      </View>
      {pointId ? (
        <View style={styles.row}>
          <Text style={styles.label}>Point ID</Text>
          <Text style={styles.value}>{pointId}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        title={sharing ? "공유 중지" : "현재 위치 공유 시작"}
        color={sharing ? "#cc0000" : "#007AFF"}
        onPress={toggleShare}
        disabled={!safeLinkToken}
      />
      <View style={styles.row}>
        <Text style={styles.note}>5초 간격으로 위치를 전송합니다.</Text>
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
