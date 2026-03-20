import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Info, AlertCircle, Share2 } from 'lucide-react';
import MapComponent from './components/MapComponent';

const API_BASE_URL = ''; // Vercel 배포 시 /api 경로로 프록시됨

function App() {
  const [token, setToken] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  const watchId = useRef(null);
  const pollTimer = useRef(null);

  // 1. URL에서 토큰 추출
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    } else {
      setError('유효하지 않은 링크입니다. 토큰이 필요합니다.');
    }
  }, []);

  // 2. 초기 세션 정보 확인 및 위치 추적 시작
  useEffect(() => {
    if (!token) return;

    const initTracking = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/links/${token}`);
        setSessionInfo(res.data);
        startPolling();
        startSharing();
      } catch (err) {
        if (err.response && (err.response.status === 410 || err.response.status === 404)) {
          setError('이 세션은 종료되었거나 만료되었습니다.');
        } else {
          setError('서버 연결 오류');
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
      } catch (err) {
        console.error('Polling failed:', err);
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  };

  // 탑승자 위치 공유 (HTML5 Geolocation)
  const startSharing = () => {
    if (!navigator.geolocation) {
      setWarning('브라우저가 위치 공유를 지원하지 않습니다.');
      return;
    }

    // HTTP 환경에서는 localhost가 아니면 위치 공유가 차단됨
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      setWarning('HTTP 환경에서는 보안상 위치 전송이 제한될 수 있습니다 (HTTPS 필요).');
    }

    setIsSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy),
        };
        setPassengerLocation(loc);
        sendLocationToServer(loc);
        setWarning(null); // 성공 시 경고 제거
      },
      (err) => {
        console.error('Geolocation error:', err);
        setWarning('위치 정보를 가져올 수 없습니다 (권한 혹은 주소 보안 확인).');
        setIsSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const stopSharing = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    setIsSharing(false);
  };

  const sendLocationToServer = async (loc) => {
    try {
      await axios.post(`${API_BASE_URL}/api/v1/links/${token}/locations`, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy_m: loc.accuracy_m,
      });
    } catch (err) {
      console.error('Failed to share location:', err);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0f172a] text-white">
        <div className="card glass max-w-md w-full text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-red-500" />
          <h1 className="text-2xl font-bold">오류 발생</h1>
          <p className="text-slate-400">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
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
        />
      </div>

      {/* Warning Overlay */}
      {warning && (
        <div className="absolute top-20 left-6 right-6 z-20">
          <div className="bg-amber-500/90 text-white text-xs p-2 rounded-lg text-center backdrop-blur-md">
            <AlertCircle size={14} className="inline mr-1 mb-0.5" />
            {warning}
          </div>
        </div>
      )}

      {/* Header Overlay */}
      <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start">
        <div className="card glass flex items-center gap-3 py-2 px-4 rounded-full">
          <div className="badge badge-live">LIVE</div>
          <span className="text-sm font-semibold text-white">운전자 추적 중</span>
        </div>
        <button className="card glass p-2 rounded-full text-white">
          <Share2 size={20} />
        </button>
      </div>

      {/* Bottom Interface */}
      <div className="absolute bottom-10 left-6 right-6 z-10">
        <div className="card glass space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Navigation size={24} className="text-indigo-400" />
             </div>
             <div>
                <h2 className="font-bold text-white">운전자 위치 정보</h2>
                <p className="text-xs text-slate-400">5초마다 갱신됨</p>
             </div>
          </div>

          <div className="h-[1px] bg-white/10 w-full" />

          <div className="flex items-center justify-between text-sm">
             <div className="flex items-center gap-2 text-slate-300">
                <MapPin size={16} />
                <span>정보: {driverLocation ? '연결됨' : '좌표 확인 중...'}</span>
             </div>
             {isSharing && (
               <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  내 위치 공유 중
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
