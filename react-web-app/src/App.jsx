import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  MapPin,
  Navigation,
  Info,
  AlertCircle,
  Share2,
  Car,
  User,
  Activity,
  Link,
  Link2Off,
} from "lucide-react";
import MapComponent from "./components/MapComponent";

const API_BASE_URL = window.location.origin; // 로컬/Vercel 환경에 관계없이 현재 도메인 사용

function App() {
  const [token, setToken] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [trackingTarget, setTrackingTarget] = useState("driver"); // 'driver', 'passenger', or null
  const [lastRequestedAt, setLastRequestedAt] = useState(Date.now());
  const [showTraffic, setShowTraffic] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showVisitAlert, setShowVisitAlert] = useState(false);

  const watchId = useRef(null);
  const pollTimer = useRef(null);
  const isConnectedRef = useRef(true);
  const passengerLocationRef = useRef(null);

  // 1. URL에서 토큰 추출 및 초기 방문 알림
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      // 처음 방문 시 알림 띄우기
      setShowVisitAlert(true);
      const timer = setTimeout(() => setShowVisitAlert(false), 8000); // 8초로 넉넉하게
      return () => clearTimeout(timer);
    } else {
      setError("유효하지 않은 링크입니다. 토큰이 필요합니다.");
    }
  }, []);

  const getDeviceMessage = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (
      ua.indexOf("iphone") > -1 ||
      ua.indexOf("ipad") > -1 ||
      ua.indexOf("ipod") > -1
    ) {
      return "화면을 이동하면 위치 공유가 즉시 중단됩니다.";
    }
    return "브라우저를 닫거나 다른 앱으로 이동하면 위치 공유가 중단될 수 있습니다.";
  };

  // 2. 초기 세션 정보 확인 및 위치 추적 시작
  useEffect(() => {
    if (!token) return;

    const initTracking = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/links/${token}`);
        setSessionInfo(res.data);
        if (res.data.driver_location) {
          setDriverLocation(res.data.driver_location);
        }
        startPolling();
        startSharing();
      } catch (err) {
        if (
          err.response &&
          (err.response.status === 410 || err.response.status === 404)
        ) {
          setError("이 세션은 종료되었거나 만료되었습니다.");
        } else {
          setError("서버 연결 오류");
        }
      }
    };

    initTracking();

    return () => {
      stopPolling();
      stopSharing();
    };
  }, [token]);

  // 드라이버 위치 폴링 (5초)
  const startPolling = () => {
    pollTimer.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/links/${token}`);
        setDriverLocation(res.data.driver_location);

        // 내 위치 하트비트 전송 (2초마다 강제 동기화)
        const loc = passengerLocationRef.current || {
          latitude: 0,
          longitude: 0,
          accuracy_m: 0,
        };
        sendLocationToServer({
          ...loc,
          recorded_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Polling failed:", err);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  };

  // 탑승자 위치 공유 (HTML5 Geolocation)
  const startSharing = () => {
    if (!navigator.geolocation) {
      setWarning("브라우저가 위치 공유를 지원하지 않습니다.");
      setWarning("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }

    setIsSharing(true);

    // 즉시 현재 위치 가져오기 (watchPosition이 첫 데이터를 주기 전까지의 공백을 메꿈)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy),
          recorded_at: new Date(pos.timestamp).toISOString(),
        };
        setPassengerLocation(loc);
        passengerLocationRef.current = loc;
        sendLocationToServer(loc);
      },
      (err) => console.log("Initial geolocation failed:", err),
      { enableHighAccuracy: true },
    );

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy),
          recorded_at: new Date(pos.timestamp).toISOString(),
        };
        setPassengerLocation(loc);
        passengerLocationRef.current = loc;
        sendLocationToServer(loc);
        setWarning(null); // 성공 시 경고 제거
      },
      (err) => {
        console.error("Geolocation error:", err);
        setWarning(
          "위치 정보를 가져올 수 없습니다 (권한 혹은 주소 보안 확인).",
        );
        setIsSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  };

  const stopSharing = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    setIsSharing(false);
  };

  const sendLocationToServer = async (loc) => {
    try {
      await axios.post(`${API_BASE_URL}/api/v1/links/${token}/locations`, {
        latitude: isConnectedRef.current ? loc.latitude : 0,
        longitude: isConnectedRef.current ? loc.longitude : 0,
        accuracy_m: loc.accuracy_m,
        recorded_at: loc.recorded_at || new Date().toISOString(),
        device_info: navigator.userAgent,
      });
    } catch (err) {
      console.error("Failed to share location:", err);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0f172a] text-white">
        <div className="card glass max-w-md w-full text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-red-500" />
          <h1 className="text-2xl font-bold">오류 발생</h1>
          <p className="text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-black">
      {/* Map View */}
      <div className="absolute inset-0">
        <MapComponent
          driverLocation={driverLocation}
          passengerLocation={passengerLocation}
          trackingTarget={trackingTarget}
          setTrackingTarget={setTrackingTarget}
          lastRequestedAt={lastRequestedAt}
          showTraffic={showTraffic}
        />
      </div>

      {/* Initial Visit Alert Overlay */}
      {showVisitAlert && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-500"
          onClick={() => setShowVisitAlert(false)}
        >
          <div
            className="card glass max-w-sm w-full p-8 text-center space-y-6 border border-white/20 shadow-2xl scale-in-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-500/30">
              <AlertCircle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">알림</h2>
              <p className="text-slate-300 text-sm leading-relaxed px-2">
                {getDeviceMessage()}
              </p>
            </div>
            <button
              onClick={() => setShowVisitAlert(false)}
              className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
            >
              확인했습니다
            </button>
            <p className="text-[10px] text-slate-500 pt-2">
              이 메시지는 잠시 후 사라집니다.
            </p>
          </div>
        </div>
      )}

      {/* Warning Overlay */}
      {warning && (
        <div className="absolute top-20 left-6 right-6 z-20 pointer-events-none">
          <div className="bg-amber-500/90 text-white text-xs p-2 rounded-lg text-center backdrop-blur-md pointer-events-auto">
            <AlertCircle size={14} className="inline mr-1 mb-0.5" />
            {warning}
          </div>
        </div>
      )}

      {/* Top Navigation Bar Overlay - Compact Version */}
      <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
        <div className="card glass p-1 px-3 rounded-2xl pointer-events-auto flex items-center gap-2 shadow-2xl border border-white/10 backdrop-blur-xl">
          <button
            onClick={() => {
              setTrackingTarget("driver");
              setLastRequestedAt(Date.now());
            }}
            className={`p-2 rounded-xl transition-all duration-300 ${trackingTarget === "driver" ? "bg-blue-500 text-white shadow-lg scale-110" : "text-slate-400 hover:bg-white/10"}`}
            title="차 위치"
          >
            <Car size={18} />
          </button>

          <button
            onClick={() => {
              setTrackingTarget("passenger");
              setLastRequestedAt(Date.now());
            }}
            className={`p-2 rounded-xl transition-all duration-300 ${trackingTarget === "passenger" ? "bg-green-500 text-white shadow-lg scale-110" : "text-slate-400 hover:bg-white/10"}`}
            title="내 위치"
          >
            <User size={18} />
          </button>

          <button
            onClick={() => {
              setTrackingTarget("all");
              setLastRequestedAt(Date.now());
            }}
            className={`p-2 rounded-xl transition-all duration-300 ${trackingTarget === "all" ? "bg-amber-500 text-white shadow-lg scale-110" : "text-slate-400 hover:bg-white/10"}`}
            title="전체 보기"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <Car size={10} className="absolute -top-0.5 -left-0.5" />
              <User size={10} className="absolute -bottom-0.5 -right-0.5" />
            </div>
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`p-2 rounded-xl transition-all duration-300 ${showTraffic ? "bg-rose-500 text-white shadow-lg scale-110" : "text-slate-400 hover:bg-white/10"}`}
            title="교통정보"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="8" y="2" width="8" height="20" rx="2" ry="2" />
              <circle
                cx="12"
                cy="7"
                r="1.5"
                fill={showTraffic ? "#fff" : "currentColor"}
              />
              <circle
                cx="12"
                cy="12"
                r="1.5"
                fill={showTraffic ? "#fff" : "currentColor"}
              />
              <circle
                cx="12"
                cy="17"
                r="1.5"
                fill={showTraffic ? "#fff" : "currentColor"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Connection Toggle Button */}
      <div className="absolute bottom-8 left-6 right-6 z-30 pointer-events-auto">
        <button
          onClick={() => {
            const nextState = !isConnected;
            setIsConnected(nextState);
            isConnectedRef.current = nextState;
            if (passengerLocation) {
              axios
                .post(`${API_BASE_URL}/api/v1/links/${token}/locations`, {
                  latitude: nextState ? passengerLocation.latitude : 0,
                  longitude: nextState ? passengerLocation.longitude : 0,
                  accuracy_m: passengerLocation.accuracy_m,
                  recorded_at: new Date().toISOString(),
                })
                .catch((err) =>
                  console.error("Immediate toggle sync failed:", err),
                );
            }
          }}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all duration-300 shadow-2xl border border-white/20 backdrop-blur-xl
            ${
              isConnected
                ? "bg-rose-500/90 text-white hover:bg-rose-600"
                : "bg-emerald-500/90 text-white hover:bg-emerald-600 animate-pulse"
            }`}
        >
          {isConnected ? "위치 공유 중단" : "위치 공유 재개"}
        </button>
      </div>
    </div>
  );
}

export default App;
