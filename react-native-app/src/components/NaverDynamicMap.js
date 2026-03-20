import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
};

function buildMapHtml({ clientId, zoom }) {
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
        <script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          (function () {
            var mapInstance = null;
            var markerInstance = null;
            var defaultCenterLat = ${DEFAULT_CENTER.lat};
            var defaultCenterLng = ${DEFAULT_CENTER.lng};
            var defaultZoom = ${level};
            var defaultTitle = ${title};

            function isValidCoord(v) {
              return typeof v === "number" && Number.isFinite(v);
            }

            function safeLatLng(lat, lng) {
              return new naver.maps.LatLng(lat, lng);
            }

            function applyLocation(lat, lng, titleText) {
              if (!isValidCoord(lat) || !isValidCoord(lng) || !mapInstance || !markerInstance) {
                return;
              }

              var next = safeLatLng(lat, lng);
              mapInstance.setCenter(next);
              markerInstance.setPosition(next);

              if (titleText) {
                markerInstance.setTitle(titleText);
              }
            }

            function flushPendingLocations() {
              if (!Array.isArray(window.__pendingMapLocation)) {
                return;
              }

              for (var i = 0; i < window.__pendingMapLocation.length; i += 1) {
                var item = window.__pendingMapLocation[i];
                applyLocation(item[0], item[1], item[2]);
              }

              window.__pendingMapLocation = [];
            }

            function initMap() {
              if (typeof naver === "undefined" || !naver || !naver.maps) {
                window.setTimeout(initMap, 300);
                return;
              }

              var defaultCenter = safeLatLng(defaultCenterLat, defaultCenterLng);
              mapInstance = new naver.maps.Map("map", {
                center: defaultCenter,
                zoom: defaultZoom,
                zoomControl: false,
                logoControl: true,
              });

              markerInstance = new naver.maps.Marker({
                position: defaultCenter,
                map: mapInstance,
                title: defaultTitle,
                clickable: false,
              });

              flushPendingLocations();
            }

            window.__setMapLocation = function (lat, lng, titleText) {
              if (!mapInstance || !markerInstance || typeof naver === "undefined" || !naver.maps) {
                window.__pendingMapLocation = window.__pendingMapLocation || [];
                window.__pendingMapLocation.push([Number(lat), Number(lng), titleText]);
                return;
              }

              applyLocation(Number(lat), Number(lng), titleText);
            };

            if (document.readyState === "complete") {
              initMap();
            } else {
              window.onload = initMap;
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
    [clientId, zoom]
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
        source={{ html }}
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
