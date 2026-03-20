import React, { useEffect, useRef } from "react";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function MapComponent({
  driverLocation,
  passengerLocation,
  trackingTarget,
  setTrackingTarget,
  lastRequestedAt,
  showTraffic,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const passengerMarker = useRef(null);
  const isUserInteracting = useRef(false);
  const interactionTimer = useRef(null);
  const trafficLayer = useRef(null);

  // 버튼 클릭(lastRequestedAt 변경) 시 즉시 트래킹 재개
  useEffect(() => {
    isUserInteracting.current = false;
    if (interactionTimer.current) {
      clearTimeout(interactionTimer.current);
      interactionTimer.current = null;
    }
  }, [lastRequestedAt]);

  useEffect(() => {
    if (!mapRef.current || !window.naver || !window.naver.maps) return;

    // 네이버 지도 초기화
    const center = new window.naver.maps.LatLng(
      DEFAULT_CENTER.lat,
      DEFAULT_CENTER.lng,
    );

    // 남한 영역 제한을 위한 좌표 설정
    const koreaBounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(31.43, 123.48),
      new window.naver.maps.LatLng(39.31, 132.03),
    );

    mapInstance.current = new window.naver.maps.Map(mapRef.current, {
      center: center,
      zoom: 16,
      minZoom: 6,
      maxBounds: koreaBounds,
      zoomControl: false,
      scaleControl: true,
      logoControl: false,
      mapDataControl: false,
      disableKineticPan: false, // 관성 드래깅(Kinetic Panning) 활성화
    });

    // 사용자가 지도를 조작하면 트래킹 일시 중지 (10초)
    const handleInteraction = () => {
      isUserInteracting.current = true;
      if (interactionTimer.current) clearTimeout(interactionTimer.current);

      interactionTimer.current = setTimeout(() => {
        isUserInteracting.current = false;
        console.log("Tracking resumed after 10s of inactivity");
      }, 10000);
    };

    window.naver.maps.Event.addListener(
      mapInstance.current,
      "dragstart",
      handleInteraction,
    );
    window.naver.maps.Event.addListener(
      mapInstance.current,
      "zoom_changed",
      handleInteraction,
    );

    // 운전자 마커 (차 모양)
    driverMarker.current = new window.naver.maps.Marker({
      position: center,
      map: mapInstance.current,
      title: "운전자",
      icon: {
        content: `
          <div style="background-color:#3b82f6; width:34px; height:34px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
              <path d="M5 17h10"/>
            </svg>
          </div>
        `,
        anchor: new window.naver.maps.Point(17, 17),
      },
    });

    // 탑승자 마커 (사람 모양)
    passengerMarker.current = new window.naver.maps.Marker({
      position: center,
      map: mapInstance.current,
      title: "나 (탑승자)",
      icon: {
        content: `
          <div style="background-color:#22c55e; width:30px; height:30px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        `,
        anchor: new window.naver.maps.Point(15, 15),
      },
    });

    return () => {
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    };
  }, []);

  const previousTargetRef = useRef(trackingTarget);
  const showAllTimerRef = useRef(null);

  // 트래킹 모드가 'all'로 바뀔 때의 특수 처리 (10초 유지 후 복원)
  useEffect(() => {
    if (trackingTarget === "all") {
      // 이미 타이머가 있다면 초기화
      if (showAllTimerRef.current) clearTimeout(showAllTimerRef.current);

      // 화면에 맞춤
      const bounds = new window.naver.maps.LatLngBounds();
      let hasPoint = false;
      if (driverLocation) {
        bounds.extend(
          new window.naver.maps.LatLng(
            driverLocation.latitude,
            driverLocation.longitude,
          ),
        );
        hasPoint = true;
      }
      if (passengerLocation) {
        bounds.extend(
          new window.naver.maps.LatLng(
            passengerLocation.latitude,
            passengerLocation.longitude,
          ),
        );
        hasPoint = true;
      }
      if (hasPoint && mapInstance.current) {
        mapInstance.current.panToBounds(bounds); // fitBounds 대신 panToBounds로 부드럽게 이동
      }

      // 10초 뒤에 이전 모드로 복구
      showAllTimerRef.current = setTimeout(() => {
        setTrackingTarget(previousTargetRef.current || "driver");
      }, 10000);
    } else {
      // 'all'이 아니면 현재 모드를 백업
      previousTargetRef.current = trackingTarget;
      if (showAllTimerRef.current) {
        clearTimeout(showAllTimerRef.current);
        showAllTimerRef.current = null;
      }
    }
  }, [trackingTarget, setTrackingTarget]);

  // 교통 정보 레이어 제어
  useEffect(() => {
    if (!mapInstance.current || !window.naver || !window.naver.maps) return;

    if (showTraffic) {
      if (!trafficLayer.current) {
        trafficLayer.current = new window.naver.maps.TrafficLayer();
      }
      trafficLayer.current.setMap(mapInstance.current);
    } else {
      if (trafficLayer.current) {
        trafficLayer.current.setMap(null);
      }
    }
  }, [showTraffic]);

  // 트래킹 모드에 따른 지도 중심 이동
  useEffect(() => {
    if (
      !mapInstance.current ||
      isUserInteracting.current ||
      trackingTarget === "all"
    )
      return;

    if (trackingTarget === "driver" && driverLocation) {
      const pos = new window.naver.maps.LatLng(
        driverLocation.latitude,
        driverLocation.longitude,
      );
      mapInstance.current.panTo(pos);
    } else if (trackingTarget === "passenger" && passengerLocation) {
      const pos = new window.naver.maps.LatLng(
        passengerLocation.latitude,
        passengerLocation.longitude,
      );
      mapInstance.current.panTo(pos);
    }
  }, [driverLocation, passengerLocation, trackingTarget, lastRequestedAt]);

  const initialFitRef = useRef(false);

  // 초기 범위 자동 조정 (처음 딱 한 번만)
  useEffect(() => {
    if (!mapInstance.current || initialFitRef.current) return;

    const bounds = new window.naver.maps.LatLngBounds();
    let hasPoint = false;

    if (driverLocation) {
      bounds.extend(
        new window.naver.maps.LatLng(
          driverLocation.latitude,
          driverLocation.longitude,
        ),
      );
      hasPoint = true;
    }
    if (passengerLocation) {
      bounds.extend(
        new window.naver.maps.LatLng(
          passengerLocation.latitude,
          passengerLocation.longitude,
        ),
      );
      hasPoint = true;
    }

    if (hasPoint) {
      mapInstance.current.fitBounds(bounds, {
        top: 100,
        right: 50,
        bottom: 150,
        left: 50,
      });
      initialFitRef.current = true;
    }
  }, [driverLocation, passengerLocation]);

  // 운전자 위치 마커 업데이트
  useEffect(() => {
    if (driverLocation && driverMarker.current) {
      const pos = new window.naver.maps.LatLng(
        driverLocation.latitude,
        driverLocation.longitude,
      );
      driverMarker.current.setPosition(pos);
    }
  }, [driverLocation]);

  // 탑승자 위치 마커 업데이트
  useEffect(() => {
    if (passengerLocation && passengerMarker.current) {
      const pos = new window.naver.maps.LatLng(
        passengerLocation.latitude,
        passengerLocation.longitude,
      );
      passengerMarker.current.setPosition(pos);
    }
  }, [passengerLocation]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    />
  );
}
