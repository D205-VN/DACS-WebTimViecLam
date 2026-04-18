const fs = require('fs');
const path = require('path');

const mappings = {
  "Lào Cai": ["Tỉnh Lào Cai", "Tỉnh Yên Bái"],
  "Thái Nguyên": ["Tỉnh Thái Nguyên", "Tỉnh Bắc Kạn"],
  "Phú Thọ": ["Tỉnh Phú Thọ", "Tỉnh Vĩnh Phúc", "Tỉnh Hoà Bình"],
  "Bắc Ninh": ["Tỉnh Bắc Ninh", "Tỉnh Bắc Giang"],
  "Hưng Yên": ["Tỉnh Hưng Yên", "Tỉnh Thái Bình"],
  "Hải Phòng": ["Thành phố Hải Phòng", "Tỉnh Hải Dương"],
  "Ninh Bình": ["Tỉnh Ninh Bình", "Tỉnh Hà Nam", "Tỉnh Nam Định"],
  "Quảng Trị": ["Tỉnh Quảng Trị", "Tỉnh Quảng Bình"],
  "Đà Nẵng": ["Thành phố Đà Nẵng", "Tỉnh Quảng Nam"],
  "Quảng Ngãi": ["Tỉnh Quảng Ngãi", "Tỉnh Kon Tum"],
  "Gia Lai": ["Tỉnh Gia Lai", "Tỉnh Bình Định"],
  "Khánh Hòa": ["Tỉnh Khánh Hòa", "Tỉnh Ninh Thuận"],
  "Lâm Đồng": ["Tỉnh Lâm Đồng", "Tỉnh Đắk Nông", "Tỉnh Bình Thuận"],
  "Đắk Lắk": ["Tỉnh Đắk Lắk", "Tỉnh Phú Yên"],
  "Thành phố Hồ Chí Minh": ["Thành phố Hồ Chí Minh", "Tỉnh Bà Rịa - Vũng Tàu", "Tỉnh Bình Dương"],
  "Đồng Nai": ["Tỉnh Đồng Nai", "Tỉnh Bình Phước"],
  "Tây Ninh": ["Tỉnh Tây Ninh", "Tỉnh Long An"],
  "Cần Thơ": ["Thành phố Cần Thơ", "Tỉnh Sóc Trăng", "Tỉnh Hậu Giang"],
  "Vĩnh Long": ["Tỉnh Vĩnh Long", "Tỉnh Bến Tre", "Tỉnh Trà Vinh"],
  "Đồng Tháp": ["Tỉnh Đồng Tháp", "Tỉnh Tiền Giang"],
  "Cà Mau": ["Tỉnh Cà Mau", "Tỉnh Bạc Liêu"],
  "An Giang": ["Tỉnh An Giang", "Tỉnh Kiên Giang"],
  "Tuyên Quang": ["Tỉnh Tuyên Quang", "Tỉnh Hà Giang"]
};

const unchanged = [
  "Tỉnh Cao Bằng", "Tỉnh Điện Biên", "Tỉnh Hà Tĩnh", "Tỉnh Lai Châu", 
  "Tỉnh Lạng Sơn", "Tỉnh Nghệ An", "Tỉnh Quảng Ninh", "Tỉnh Thanh Hóa", 
  "Tỉnh Sơn La", "Thành phố Hà Nội", "Thành phố Huế"
];

async function generate() {
  console.log("Đang tải dữ liệu 63 tỉnh thành...");
  const res = await fetch('https://provinces.open-api.vn/api/?depth=3');
  const data = await res.json();
  
  const oldProvincesMap = {};
  data.forEach(p => {
    oldProvincesMap[p.name] = p;
  });

  const newProvinces = [];

  // Xử lý các tỉnh sáp nhập
  for (const [newName, oldNames] of Object.entries(mappings)) {
    const combinedWards = [];
    
    oldNames.forEach(oldName => {
      const oldProv = oldProvincesMap[oldName];
      if (!oldProv) {
        console.error("Không tìm thấy:", oldName);
        return;
      }
      
      (oldProv.districts || []).forEach(dist => {
        (dist.wards || []).forEach(ward => {
          combinedWards.push({
            code: ward.code,
            name: `${ward.name} - ${dist.name}`
          });
        });
      });
    });

    newProvinces.push({
      name: newName,
      code: newName, // Dùng tên làm code cho đơn giản
      wards: combinedWards
    });
  }

  // Xử lý các tỉnh không đổi
  unchanged.forEach(oldName => {
    const oldProv = oldProvincesMap[oldName];
    if (!oldProv) {
        console.error("Không tìm thấy:", oldName);
        return;
    }
    
    let displayName = oldName.replace("Tỉnh ", "").replace("Thành phố ", "");
    // Giữ nguyên Thành phố Hồ Chí Minh, Hà Nội, Hải Phòng, Đà Nẵng, Cần Thơ, Huế? 
    // Các tỉnh kia lấy tên ngắn gọn.
    
    const combinedWards = [];
    (oldProv.districts || []).forEach(dist => {
      (dist.wards || []).forEach(ward => {
        combinedWards.push({
          code: ward.code,
          name: `${ward.name} - ${dist.name}`
        });
      });
    });

    newProvinces.push({
      name: displayName,
      code: displayName,
      wards: combinedWards
    });
  });

  // Sort by name
  newProvinces.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const outDir = path.join(__dirname, '../../frontend/public/data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'vietnam_34_provinces.json');
  fs.writeFileSync(outFile, JSON.stringify(newProvinces, null, 2));
  console.log(`Đã xuất 34 tỉnh thành mới ra ${outFile}`);
}

generate();
