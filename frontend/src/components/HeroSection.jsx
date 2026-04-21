import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Briefcase, ChevronDown, Sparkles, TrendingUp, Users, Loader2, LocateFixed } from 'lucide-react';
import { findNearestProvince, locationCenters, normalizeProvinceName } from '../data/provinceCoordinates';

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
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-navy-600/10 to-transparent rounded-full"></div>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        ></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-sm text-navy-100">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Hơn <strong className="text-white">12,500+</strong> việc làm mới mỗi ngày</span>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-4">
            Tìm kiếm công việc
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              mơ ước của bạn
            </span>
          </h1>
          <p className="text-base sm:text-lg text-navy-200 max-w-2xl mx-auto leading-relaxed">
            Khám phá hàng ngàn cơ hội việc làm từ các công ty hàng đầu Việt Nam.
            <br className="hidden sm:block" />
            Bắt đầu hành trình sự nghiệp của bạn ngay hôm nay.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-2xl shadow-navy-900/30 p-2 sm:p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                triggerSearch();
              }}
              className="flex flex-col sm:flex-row gap-2 sm:gap-0"
            >
              <div className="flex items-center gap-2 flex-1 px-4 py-3 sm:border-r border-gray-200">
                <Search className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setLocationNotice(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && triggerSearch({ keyword: e.currentTarget.value })}
                  placeholder="Chức danh, từ khóa..."
                  className="w-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none bg-transparent"
                />
              </div>

              <div
                ref={locationBoxRef}
                className="relative flex items-center gap-2 flex-1 px-4 py-3 sm:border-r border-gray-200"
              >
                <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
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
                  className="w-full pr-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={detectingLocation}
                  className="rounded-lg p-1.5 text-navy-600 transition-colors hover:bg-navy-50 hover:text-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Lấy vị trí hiện tại"
                >
                  {detectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                </button>
                {showSuggestions && filteredLocations.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50 py-2 z-20">
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
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setJobTypeOpen(!jobTypeOpen)}
                  className="flex items-center justify-between gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-400 shrink-0" />
                    <span className={jobType ? 'text-gray-800' : 'text-gray-400'}>
                      {jobType ? jobTypes.find((j) => j.value === jobType)?.label : 'Loại công việc'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${jobTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                {jobTypeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50 py-1 z-10">
                    {jobTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setJobType(type.value);
                          setJobTypeOpen(false);
                          triggerSearch({ jobType: type.value });
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          jobType === type.value
                            ? 'text-navy-700 bg-navy-50 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
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
                className="bg-gradient-to-r from-navy-600 to-navy-800 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-navy-700/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shrink-0"
              >
                <span className="hidden sm:inline">Tìm kiếm</span>
                <Search className="w-5 h-5 sm:hidden" />
              </button>
            </form>
          </div>
          {locationNotice ? (
            <div className={`mt-3 flex items-center justify-center gap-2 text-sm ${
              locationNotice.type === 'error' ? 'text-rose-100' : 'text-emerald-200'
            }`}>
              {locationNotice.type === 'error' ? <MapPin className="w-4 h-4" /> : <LocateFixed className="w-4 h-4" />}
              <span>{locationNotice.message}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          <span className="text-sm text-navy-300">Phổ biến:</span>
          {popularTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setKeyword(tag);
                setLocationNotice(null);
                triggerSearch({ keyword: tag });
              }}
              className="px-3 py-1 text-xs font-medium text-navy-200 bg-white/8 border border-white/10 rounded-full hover:bg-white/15 hover:text-white transition-all duration-200"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <stat.icon className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</span>
              </div>
              <span className="text-sm text-navy-300">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
