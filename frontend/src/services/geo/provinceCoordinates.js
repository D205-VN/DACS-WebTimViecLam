import rawLocationCenters from './locationCenters.json';

export function normalizeProvinceName(name = '') {
  return String(name)
    .replace(/^(Thành phố|Tỉnh)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(value = '') {
  return normalizeProvinceName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const locationCenters = rawLocationCenters.map((location) => ({
  ...location,
  normalizedName: normalizeSearchText(location.name),
  normalizedAliases: (location.aliases || []).map((alias) => normalizeSearchText(alias)),
}));

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function getDistanceKm(from, to) {
  if (!from || !to) return Number.POSITIVE_INFINITY;

  const earthRadiusKm = 6371;
  const dLat = toRadians((to.lat || 0) - (from.lat || 0));
  const dLng = toRadians((to.lng || 0) - (from.lng || 0));
  const fromLat = toRadians(from.lat || 0);
  const toLat = toRadians(to.lat || 0);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(fromLat) * Math.cos(toLat);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function matchesAlias(normalizedInput, alias) {
  if (!alias) return false;
  if (alias.length <= 3) {
    return normalizedInput === alias || normalizedInput.split(' ').includes(alias);
  }
  return normalizedInput === alias || normalizedInput.includes(alias);
}

export function findProvinceByName(input) {
  const normalizedInput = normalizeSearchText(input);
  if (!normalizedInput) return null;

  return (
    locationCenters.find((location) => {
      const variants = [location.normalizedName, ...location.normalizedAliases];
      return variants.some((alias) => matchesAlias(normalizedInput, alias));
    }) || null
  );
}

export function findNearestProvince(coords) {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return null;
  }

  let nearestLocation = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  locationCenters.forEach((location) => {
    const distance = getDistanceKm(coords, location);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLocation = location;
    }
  });

  return nearestLocation;
}
