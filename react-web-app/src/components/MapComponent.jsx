import React, { useEffect, useRef } from 'react';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function MapComponent({ driverLocation, passengerLocation }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const passengerMarker = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // 네이버 지도 초기화
    const center = new window.naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    mapInstance.current = new window.naver.maps.Map(mapRef.current, {
      center: center,
      zoom: 16,
      zoomControl: false,
      logoControl: true,
    });

    // 운전자 마커
    driverMarker.current = new window.naver.maps.Marker({
      position: center,
      map: mapInstance.current,
      title: "운전자",
      icon: {
        content: '<div style="background-color:#6366f1; width:16px; height:16px; border-radius:8px; border:2px solid #fff; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>',
        anchor: new window.naver.maps.Point(8, 8)
      }
    });

    // 탑승자 마커 (본인)
    passengerMarker.current = new window.naver.maps.Marker({
      position: center,
      map: mapInstance.current,
      title: "나 (탑승자)",
      icon: {
        content: '<div style="background-color:#10b981; width:14px; height:14px; border-radius:7px; border:2px solid #fff; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>',
        anchor: new window.naver.maps.Point(7, 7)
      }
    });

    return () => {
        if (mapInstance.current) {
            // Cleanup logic if needed
        }
    };
  }, []);

  // 운전자 위치 업데이트
  useEffect(() => {
    if (driverLocation && driverMarker.current && mapInstance.current) {
      const pos = new window.naver.maps.LatLng(driverLocation.latitude, driverLocation.longitude);
      driverMarker.current.setPosition(pos);
      // 운전자를 지도의 중심으로 (선택 사항)
      // mapInstance.current.setCenter(pos);
    }
  }, [driverLocation]);

  // 탑승자 위치 업데이트
  useEffect(() => {
    if (passengerLocation && passengerMarker.current) {
      const pos = new window.naver.maps.LatLng(passengerLocation.latitude, passengerLocation.longitude);
      passengerMarker.current.setPosition(pos);
    }
  }, [passengerLocation]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
