import { findNearestProvince, normalizeProvinceName } from './provinceCoordinates';

function getGeolocationErrorMessage(error) {
  if (!error) {
    return 'Không thể lấy vị trí hiện tại. Vui lòng thử lại.';
  }

  if (error.code === error.PERMISSION_DENIED) {
    return 'Bạn đang chặn quyền vị trí. Hãy cho phép truy cập vị trí rồi thử lại.';
  }

  if (error.code === error.TIMEOUT) {
    return 'Hết thời gian lấy vị trí. Vui lòng thử lại.';
  }

  return 'Không thể lấy vị trí hiện tại. Vui lòng kiểm tra lại quyền truy cập vị trí.';
}

export function requestCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt hiện tại không hỗ trợ lấy vị trí.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const nearestProvince = findNearestProvince(coords);
        const resolvedLocation = nearestProvince
          ? normalizeProvinceName(nearestProvince.name)
          : '';
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null;

        if (!resolvedLocation) {
          reject(new Error('Không xác định được khu vực từ vị trí hiện tại. Vui lòng thử lại.'));
          return;
        }

        resolve({
          location: resolvedLocation,
          coords,
          accuracy,
        });
      },
      (error) => reject(new Error(getGeolocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });
}
