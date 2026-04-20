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

export const provinceCenters = [
  { name: 'An Giang', lat: 10.5216, lng: 105.1259, aliases: ['long xuyen', 'chau doc'] },
  { name: 'Bắc Ninh', lat: 21.1861, lng: 106.0763, aliases: [] },
  { name: 'Cà Mau', lat: 9.1769, lng: 105.1524, aliases: [] },
  { name: 'Cao Bằng', lat: 22.6657, lng: 106.257, aliases: [] },
  { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469, aliases: ['can tho', 'ct'] },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, aliases: ['da nang', 'dn'] },
  { name: 'Đắk Lắk', lat: 12.7100, lng: 108.2378, aliases: ['dak lak', 'buon ma thuot'] },
  { name: 'Điện Biên', lat: 21.386, lng: 103.023, aliases: ['dien bien'] },
  { name: 'Đồng Nai', lat: 10.9447, lng: 106.8243, aliases: ['bien hoa'] },
  { name: 'Đồng Tháp', lat: 10.4938, lng: 105.6882, aliases: ['cao lanh'] },
  { name: 'Gia Lai', lat: 13.9833, lng: 108.0000, aliases: ['pleiku'] },
  { name: 'Hà Nội', lat: 21.0278, lng: 105.8342, aliases: ['ha noi', 'hn'] },
  { name: 'Hà Tĩnh', lat: 18.355, lng: 105.8877, aliases: ['ha tinh'] },
  { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881, aliases: ['hai phong', 'hp'] },
  { name: 'Huế', lat: 16.4637, lng: 107.5909, aliases: ['hue', 'thua thien hue'] },
  { name: 'Hưng Yên', lat: 20.6464, lng: 106.0511, aliases: ['hung yen'] },
  { name: 'Khánh Hòa', lat: 12.2388, lng: 109.1967, aliases: ['khanh hoa', 'nha trang'] },
  { name: 'Lai Châu', lat: 22.3964, lng: 103.4707, aliases: ['lai chau'] },
  { name: 'Lạng Sơn', lat: 21.8537, lng: 106.761, aliases: ['lang son'] },
  { name: 'Lào Cai', lat: 22.4856, lng: 103.9707, aliases: ['lao cai'] },
  { name: 'Lâm Đồng', lat: 11.9404, lng: 108.4583, aliases: ['lam dong', 'da lat', 'dalat'] },
  { name: 'Nghệ An', lat: 18.6796, lng: 105.6813, aliases: ['nghe an', 'vinh'] },
  { name: 'Ninh Bình', lat: 20.2506, lng: 105.9745, aliases: ['ninh binh'] },
  { name: 'Phú Thọ', lat: 21.3227, lng: 105.401, aliases: ['phu tho', 'viet tri'] },
  { name: 'Quảng Ngãi', lat: 15.1214, lng: 108.8044, aliases: ['quang ngai'] },
  { name: 'Quảng Ninh', lat: 20.9712, lng: 107.0448, aliases: ['quang ninh', 'ha long'] },
  { name: 'Quảng Trị', lat: 16.749, lng: 107.1855, aliases: ['quang tri', 'dong ha'] },
  { name: 'Sơn La', lat: 21.3256, lng: 103.9188, aliases: ['son la'] },
  { name: 'Tây Ninh', lat: 11.3352, lng: 106.1099, aliases: ['tay ninh'] },
  { name: 'Thái Nguyên', lat: 21.5942, lng: 105.8482, aliases: ['thai nguyen'] },
  { name: 'Thanh Hóa', lat: 19.8067, lng: 105.7852, aliases: ['thanh hoa'] },
  { name: 'Thành phố Hồ Chí Minh', lat: 10.7769, lng: 106.7009, aliases: ['ho chi minh', 'hcm', 'tp hcm', 'tphcm', 'sai gon', 'saigon', 'sg'] },
  { name: 'Tuyên Quang', lat: 21.8236, lng: 105.214, aliases: ['tuyen quang'] },
  { name: 'Vĩnh Long', lat: 10.2397, lng: 105.9572, aliases: ['vinh long'] },
].map((province) => ({
  ...province,
  normalizedName: normalizeSearchText(province.name),
  normalizedAliases: province.aliases.map((alias) => normalizeSearchText(alias)),
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
    provinceCenters.find((province) => {
      const variants = [province.normalizedName, ...province.normalizedAliases];
      return variants.some((alias) => matchesAlias(normalizedInput, alias));
    }) || null
  );
}

export function findNearestProvince(coords) {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return null;
  }

  let nearestProvince = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  provinceCenters.forEach((province) => {
    const distance = getDistanceKm(coords, province);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestProvince = province;
    }
  });

  return nearestProvince;
}
