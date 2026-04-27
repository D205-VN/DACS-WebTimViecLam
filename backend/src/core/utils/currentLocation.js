const { findNearestLocation, normalizeProvinceName } = require('./locationCoordinates');

function toFiniteNumber(value) {
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

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return { error: 'Vui lòng cho phép lấy vị trí hiện tại trước khi tiếp tục.' };
  }

  const nearestLocation = findNearestLocation({ lat, lng });
  const fallbackLocation = normalizeProvinceName(String(currentLocation || '').trim());
  const resolvedLocation = nearestLocation
    ? normalizeProvinceName(nearestLocation.name)
    : fallbackLocation;

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
