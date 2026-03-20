import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

// [학습 포인트 1] 지도 기본 중심점 (서울시청 기준)
const DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
};

/**
 * [학습 포인트 2] WebView에 주입할 HTML 문자열 생성 함수
 * 네이티브 SDK 대신 웹용 JS SDK를 WebView 안에서 실행하여 지도를 표시합니다.
 * 이 방식은 Expo Go 환경에서도 별도의 네이티브 설정 없이 지도를 띄울 수 있는 장점이 있습니다.
 */
function buildMapHtml({
  clientId,
  latitude,
  longitude,
  zoom,
  markerTitle,
}) {
  const lat = Number.isFinite(latitude) ? latitude : DEFAULT_CENTER.lat;
  const lng = Number.isFinite(longitude) ? longitude : DEFAULT_CENTER.lng;
  const level = Number.isFinite(zoom) ? zoom : 16;
  const title = JSON.stringify(markerTitle || "현재 위치");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
          body { overflow: hidden; background-color: #eee; }
        </style>
        <!-- 네이버 지도 JS SDK 로드 (클라이언트 ID 기반) -->
        <script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          function initialize() {
            // 지도 생성
            var map = new naver.maps.Map("map", {
              center: new naver.maps.LatLng(${lat}, ${lng}),
              zoom: ${level},
              zoomControl: false, // UI 복잡도를 줄이기 위해 줌 컨트롤 숨김
              logoControl: true
            });
            // 마커 생성 및 표시
            new naver.maps.Marker({
              position: new naver.maps.LatLng(${lat}, ${lng}),
              map: map,
              title: ${title},
              clickable: false
            });
          }
          // 창 로드가 완료된 후 지도 초기화 실행
          window.onload = initialize;
        </script>
      </body>
    </html>
  `;
}

export default function NaverDynamicMap({
  clientId,
  latitude,
  longitude,
  zoom = 16,
  markerTitle,
  style,
}) {
  /**
   * [학습 포인트 3] useMemo를 통한 웹 뷰 콘텐츠 최적화
   * 좌표나 줌 레벨이 바뀔 때만 HTML을 새로 생성하여 성능을 유지합니다.
   */
  const html = useMemo(
    () =>
      buildMapHtml({
        clientId,
        latitude,
        longitude,
        zoom,
        markerTitle,
      }),
    [clientId, latitude, longitude, zoom, markerTitle]
  );

  // 클라이언트 ID가 없는 경우 사용자에게 설정 안내 메시지 표시
  if (!clientId) {
    return (
      <View style={[styles.empty, style]}>
        <Text style={styles.emptyText}>
          환경변수(EXPO_PUBLIC_NAVER_MAP_CLIENT_ID)를 설정해주세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* 
        [학습 포인트 4] WebView 컴포넌트 사용법
        - source={{ html }}: 직접 작성한 HTML 문자열을 화면에 렌더링합니다.
        - originWhitelist: 보안 정책상 허용할 출처를 지정합니다.
        - javaScriptEnabled: SDK 실행을 위해 JS 활성화가 필수입니다.
      */}
      <WebView 
        source={{ html }} 
        originWhitelist={["*"]} 
        javaScriptEnabled 
        style={styles.webview} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
  },
  empty: {
    height: 280,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 12,
  },
  emptyText: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
  },
});
