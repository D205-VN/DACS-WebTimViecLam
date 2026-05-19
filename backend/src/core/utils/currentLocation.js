const { findNearestLocation, normalizeProvinceName } = require('./locationCoordinates');

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function resolveCurrentLocationPayload({
  currentLocation,
  currentLat,
  currentLng,
} = {}) {
  const lat = toFiniteNumber(currentLat);
  const lng = toFiniteNumber(currentLng);
  const fallbackLocation = normalizeProvinceName(String(currentLocation || '').trim());

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    if (!fallbackLocation) {
      return { error: 'Vui lòng nhập tỉnh/thành hiện tại hoặc cho phép lấy vị trí hiện tại trước khi tiếp tục.' };
    }

    return {
      location: fallbackLocation,
      lat: null,
      lng: null,
    };
  }

  const nearestLocation = findNearestLocation({ lat, lng });
  const resolvedLocation = fallbackLocation || (nearestLocation
    ? normalizeProvinceName(nearestLocation.name)
    : '');

  if (!resolvedLocation) {
    return { error: 'Không xác định được khu vực từ vị trí hiện tại. Vui lòng thử lại.' };
  }

  return {
    location: resolvedLocation,
    lat,
    lng,
  };
}

module.exports = {
  resolveCurrentLocationPayload,
};
