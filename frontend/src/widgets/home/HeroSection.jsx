import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Briefcase, ChevronDown, Sparkles, TrendingUp, Users, Loader2, LocateFixed } from 'lucide-react';
import { findNearestProvince, locationCenters, normalizeProvinceName } from '@shared/geo/provinceCoordinates';

const jobTypes = [
  { value: '', label: 'Tất cả' },
  { value: 'full time', label: 'Toàn thời gian' },
  { value: 'part time', label: 'Bán thời gian' },
  { value: 'others', label: 'Thực tập' },
  { value: 'remote', label: 'Làm việc từ xa' },
];

const popularTags = ['Lập trình viên', 'Marketing', 'Kế toán', 'Nhân sự', 'Bán hàng'];
const CURRENT_LOCATION_LABEL = 'Vị trí hiện tại';

const stats = [
  { label: 'Việc làm mới / ngày', value: '12,500+', icon: TrendingUp },
  { label: 'Nhà tuyển dụng', value: '8,200+', icon: Users },
  { label: 'Lĩnh vực hot', value: '25+', icon: Sparkles },
];

export default function HeroSection({ onSearch }) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [jobTypeOpen, setJobTypeOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [locationSource, setLocationSource] = useState('manual');
  const locationBoxRef = useRef(null);
  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          locationCenters
            .map((item) => normalizeProvinceName(item.name))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'vi')),
    []
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationBoxRef.current && !locationBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocations = useMemo(() => {
    const query = normalizeProvinceName(location).toLowerCase();
    if (!query) return locations.slice(0, 8);
    return locations
      .filter((item) => item.toLowerCase().includes(query))
      .slice(0, 8);
  }, [location, locations]);

  const resolveNextValue = (next, key, currentValue) =>
    Object.prototype.hasOwnProperty.call(next, key) ? next[key] : currentValue;

  const triggerSearch = (next = {}) => {
    const nextLocation = next.location ?? location;
    const nextSource = resolveNextValue(next, 'locationSource', locationSource);

    onSearch?.({
      keyword: (next.keyword ?? keyword).trim(),
      location: nextSource === 'geolocation' ? nextLocation : normalizeProvinceName(nextLocation),
      jobType: next.jobType ?? jobType,
      userCoordinates: resolveNextValue(next, 'userCoordinates', selectedCoordinates),
      locationSource: nextSource,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice({
        type: 'error',
        message: 'Trình duyệt hiện tại không hỗ trợ lấy vị trí.',
      });
      return;
    }

    setDetectingLocation(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const nearestProvince = findNearestProvince(coords);
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null;
        const referenceLocation = nearestProvince ? normalizeProvinceName(nearestProvince.name) : null;

        setSelectedCoordinates(coords);
        setLocationSource('geolocation');
        setLocation(CURRENT_LOCATION_LABEL);
        setShowSuggestions(false);
        setDetectingLocation(false);
        setLocationNotice({
          type: 'success',
          message: `Đã lấy vị trí GPS hiện tại${accuracy ? ` (sai số khoảng ${accuracy}m)` : ''}. Hệ thống sẽ sắp xếp việc làm theo khoảng cách gần bạn nhất${referenceLocation ? `, tham chiếu khu vực ${referenceLocation}` : ''}.`,
        });
        triggerSearch({
          location: CURRENT_LOCATION_LABEL,
          userCoordinates: coords,
          locationSource: 'geolocation',
        });
      },
      (error) => {
        let message = 'Không thể lấy vị trí hiện tại. Vui lòng kiểm tra lại quyền truy cập vị trí.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Bạn đang chặn quyền vị trí. Hãy cho phép vị trí rồi thử lại.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Hết thời gian lấy vị trí. Vui lòng thử lại.';
        }

        setDetectingLocation(false);
        setLocationNotice({ type: 'error', message });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
      {/* Decorative floating elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute -bottom-10 right-10 h-60 w-60 rounded-full bg-pink-400/10 blur-3xl"></div>
        <div className="absolute left-1/2 top-10 h-40 w-40 rounded-full bg-indigo-300/10 blur-2xl"></div>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            triggerSearch();
          }}
          className="grid gap-2 rounded-xl border border-white/20 bg-white/95 p-2 shadow-2xl shadow-indigo-900/20 backdrop-blur-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_220px_auto]"
        >
          <label className="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-50/50 px-3 transition-all duration-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200">
            <Search className="h-5 w-5 shrink-0 text-indigo-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setLocationNotice(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch({ keyword: e.currentTarget.value })}
              placeholder="Chức danh, từ khóa..."
              className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
          </label>

          <div ref={locationBoxRef} className="relative">
            <label className="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-50/50 px-3 transition-all duration-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200">
              <MapPin className="h-5 w-5 shrink-0 text-violet-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSelectedCoordinates(null);
                  setLocationSource('manual');
                  setLocationNotice(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && triggerSearch({ location: e.currentTarget.value })}
                placeholder="Địa điểm..."
                className="w-full bg-transparent pr-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={detectingLocation}
                className="rounded-lg p-1.5 text-indigo-600 transition-all duration-200 hover:bg-indigo-100 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                title="Lấy vị trí hiện tại"
              >
                {detectingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              </button>
            </label>
            {showSuggestions && filteredLocations.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-indigo-100 bg-white/95 py-1 shadow-xl shadow-indigo-200/30 backdrop-blur-sm">
                {filteredLocations.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setLocation(item);
                      setSelectedCoordinates(null);
                      setLocationSource('manual');
                      setLocationNotice(null);
                      setShowSuggestions(false);
                      triggerSearch({ location: item, userCoordinates: null, locationSource: 'manual' });
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-600 transition-all duration-150 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setJobTypeOpen(!jobTypeOpen)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-indigo-50/50 px-3 text-sm text-gray-700 transition-all duration-200 hover:bg-indigo-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Briefcase className="h-5 w-5 shrink-0 text-purple-400" />
                <span className={`truncate ${jobType ? 'text-gray-800' : 'text-gray-400'}`}>
                  {jobType ? jobTypes.find((j) => j.value === jobType)?.label : 'Loại công việc'}
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${jobTypeOpen ? 'rotate-180' : ''}`} />
            </button>
            {jobTypeOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-indigo-100 bg-white/95 py-1 shadow-xl shadow-indigo-200/30 backdrop-blur-sm">
                {jobTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setJobType(type.value);
                      setJobTypeOpen(false);
                      triggerSearch({ jobType: type.value });
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                      jobType === type.value
                        ? 'bg-indigo-50 font-medium text-indigo-700'
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 text-sm font-semibold text-white shadow-md shadow-amber-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-amber-300/50 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            <span>Tìm kiếm</span>
          </button>
        </form>

        {locationNotice ? (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            locationNotice.type === 'error'
              ? 'bg-rose-500/20 text-rose-100 border border-rose-400/30'
              : 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
          }`}>
            {locationNotice.type === 'error' ? <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> : <LocateFixed className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{locationNotice.message}</span>
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white/70">Phổ biến</span>
            {popularTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setKeyword(tag);
                  setLocationNotice(null);
                  triggerSearch({ keyword: tag });
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-all duration-200 hover:bg-white/20 hover:text-white"
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {stats.map((stat) => (
              <span key={stat.label} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-white/80 backdrop-blur-sm">
                <stat.icon className="h-3.5 w-3.5 text-amber-300" />
                <strong className="font-semibold text-white">{stat.value}</strong>
                {stat.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
