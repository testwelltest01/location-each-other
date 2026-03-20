import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
};

function buildMapHtml({ clientId, zoom }) {
  console.log("NaverDynamicMap.js 실행함");
  const level = Number.isFinite(zoom) ? zoom : 16;
  const title = JSON.stringify("현재 위치");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <style>
          html,
          body,
          #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
          body {
            overflow: hidden;
            background-color: #eee;
          }
        </style>
        <script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          (function () {
            var mapInstance = null;
            var driverMarker = null;
            var passengerMarkers = {}; // linkToken -> marker

            window.navermap_authFailure = function () {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'AUTH_FAILURE',
                  message: '네이버 지도 인증 실패 (ncpKeyId 확인 필요)'
                }));
              }
            };

            function isValidCoord(v) {
              return typeof v === "number" && Number.isFinite(v);
            }

            function safeLatLng(lat, lng) {
              return new naver.maps.LatLng(lat, lng);
            }

            function initMap() {
              if (typeof naver === "undefined" || !naver || !naver.maps) {
                window.setTimeout(initMap, 300);
                return;
              }

              var defaultCenter = safeLatLng(${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng});
              mapInstance = new naver.maps.Map("map", {
                center: defaultCenter,
                zoom: ${level},
                zoomControl: false,
                logoControl: true,
              });

              // 운전자 마커 (기본 파란색 스타일)
              driverMarker = new naver.maps.Marker({
                position: defaultCenter,
                map: mapInstance,
                title: ${title},
                clickable: false,
                icon: {
                    content: '<div style="background-color:#007AFF; width:12px; height:12px; border-radius:6px; border:2px solid #fff; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
                    anchor: new naver.maps.Point(6, 6)
                }
              });

              if (window.__pendingDriverLocation) {
                window.__setMapLocation(...window.__pendingDriverLocation);
                window.__pendingDriverLocation = null;
              }
              if (window.__pendingPassengerLocations) {
                window.__setPassengerLocations(window.__pendingPassengerLocations);
                window.__pendingPassengerLocations = null;
              }
            }

            window.__setMapLocation = function (lat, lng, titleText) {
              if (!mapInstance || !driverMarker) {
                window.__pendingDriverLocation = [lat, lng, titleText];
                return;
              }
              var pos = safeLatLng(Number(lat), Number(lng));
              driverMarker.setPosition(pos);
              if (titleText) driverMarker.setTitle(titleText);
              mapInstance.setCenter(pos);
            };

            window.__setPassengerLocations = function (passengers) {
              if (!mapInstance) {
                window.__pendingPassengerLocations = passengers;
                return;
              }

              var currentTokens = {};
              passengers.forEach(function(p) {
                var token = p.link_token;
                currentTokens[token] = true;
                var pos = safeLatLng(Number(p.latitude), Number(p.longitude));

                if (passengerMarkers[token]) {
                  passengerMarkers[token].setPosition(pos);
                } else {
                  passengerMarkers[token] = new naver.maps.Marker({
                    position: pos,
                    map: mapInstance,
                    title: "탑승자 " + token.substring(0,4),
                    icon: {
                        content: '<div style="background-color:#4CD964; width:10px; height:10px; border-radius:5px; border:2px solid #fff; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
                        anchor: new naver.maps.Point(5, 5)
                    }
                  });
                }
              });

              // 사라진 링크 토큰 마커 제거
              Object.keys(passengerMarkers).forEach(function(token) {
                if (!currentTokens[token]) {
                  passengerMarkers[token].setMap(null);
                  delete passengerMarkers[token];
                }
              });
            };

            if (document.readyState === "complete") {
              initMap();
            } else {
              window.onload = initMap;
            }

            // 디버깅을 위해 현재 오리진(주소)을 앱으로 보냅니다.
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG_ORIGIN',
                origin: window.location.origin,
                href: window.location.href
              }));
            }
          })();
        </script>
      </body>
    </html>
  `;
}

function sanitizeCoord(value, fallback) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

export default function NaverDynamicMap({
  clientId,
  latitude,
  longitude,
  zoom = 16,
  markerTitle,
  passengers = [], // [{ link_token, latitude, longitude }]
  style,
}) {
  const webViewRef = useRef(null);
  const mapReadyRef = useRef(false);
  const pendingLoadRef = useRef(false);
  const retryRef = useRef(0);
  const [reloadSeq, setReloadSeq] = useState(0);

  const html = useMemo(
    () =>
      buildMapHtml({
        clientId,
        zoom,
      }),
    [clientId, zoom],
  );

  const updateLocation = () => {
    if (!webViewRef.current || !mapReadyRef.current) {
      pendingLoadRef.current = true;
      return;
    }

    const lat = sanitizeCoord(latitude, DEFAULT_CENTER.lat);
    const lng = sanitizeCoord(longitude, DEFAULT_CENTER.lng);
    const title = JSON.stringify(markerTitle || "현재 위치");

    webViewRef.current.injectJavaScript(`
      window.__setMapLocation(${lat}, ${lng}, ${title});
      true;
    `);
    pendingLoadRef.current = false;
  };

  useEffect(() => {
    updateLocation();
  }, [latitude, longitude, markerTitle]);

  useEffect(() => {
    if (!webViewRef.current || !mapReadyRef.current) return;

    const passengersJson = JSON.stringify(passengers);
    webViewRef.current.injectJavaScript(`
      window.__setPassengerLocations(${passengersJson});
      true;
    `);
  }, [passengers]);

  if (!clientId) {
    return (
      <View style={[styles.empty, style]}>
        <Text style={styles.emptyText}>
          환경변수 EXPO_PUBLIC_NAVER_MAP_CLIENT_ID가 설정되어 있지 않습니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={reloadSeq}
        ref={webViewRef}
        source={{ html, baseUrl: "http://localhost" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        onLoad={() => {
          mapReadyRef.current = true;
          retryRef.current = 0;

          if (pendingLoadRef.current) {
            updateLocation();
          }
        }}
        onError={() => {
          mapReadyRef.current = false;

          if (retryRef.current < 1) {
            retryRef.current += 1;
            setReloadSeq((v) => v + 1);
          }
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'DEBUG_ORIGIN') {
              console.log("[MAP DEBUG] Current Origin:", data.origin);
              console.log("[MAP DEBUG] Current Href:", data.href);
            } else if (data.type === 'AUTH_FAILURE') {
              console.log("[MAP DEBUG] AUTH FAILURE:", data.message);
              setError && setError(data.message);
            }
          } catch (e) {
            console.log("[MAP DEBUG] Error parsing message:", e);
          }
        }}
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
