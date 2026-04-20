const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const CSV_PATH = '/Users/tandung/.cache/kagglehub/datasets/saugataroyarghya/resume-dataset/versions/1/resume_data.csv';
const OUT_PATH = path.join(__dirname, '../src/data/resume_knowledge.json');

const rolesData = {};

function safeParseList(str) {
  if (!str) return [];
  try {
    // Some strings are "['Skill 1', 'Skill 2']"
    let clean = str.replace(/'/g, '"');
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) {
    // fallback: split by comma if not valid JSON array
    return str.replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
}

console.log('Bắt đầu đọc và phân tích dữ liệu từ:', CSV_PATH);

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on('data', (row) => {
    // Tìm key job_position_name (vì có thể dính ký tự BOM ở đầu tên cột)
    const jobKey = Object.keys(row).find(k => k.includes('job_position_name'));
    let role = row[jobKey] ? row[jobKey].trim() : '';
    
    // Nếu không có job_position_name, thử lấy positions
    if (!role && row.positions) {
      const pos = safeParseList(row.positions);
      if (pos.length > 0) role = pos[0];
    }

    if (!role || role === 'N/A' || role.length > 50) return;

    if (!rolesData[role]) {
      rolesData[role] = {
        objectives: [],
        skills_counter: {},
        responsibilities: []
      };
    }

    const data = rolesData[role];

    // Lấy objective
    if (row.career_objective && row.career_objective !== 'N/A' && row.career_objective.length > 20) {
      if (data.objectives.length < 10) { // Giới hạn lưu 10 cái dài nhất/đẹp nhất
        data.objectives.push(row.career_objective.trim());
      }
    }

    // Đếm skills
    if (row.skills && row.skills !== 'N/A') {
      const skillsList = safeParseList(row.skills);
      skillsList.forEach(skill => {
        const s = skill.trim();
        if (s) {
          data.skills_counter[s] = (data.skills_counter[s] || 0) + 1;
        }
      });
    }

    // Lấy responsibilities
    if (row.responsibilities && row.responsibilities !== 'N/A') {
      // Split by newline or bullet points
      const respList = row.responsibilities.split('\n')
        .map(r => r.replace(/^[-\*•]\s*/, '').trim())
        .filter(r => r.length > 15);
      
      respList.forEach(r => {
        if (data.responsibilities.length < 20 && !data.responsibilities.includes(r)) {
          data.responsibilities.push(r);
        }
      });
    }
  })
  .on('end', () => {
    console.log(`Đã đọc xong CSV. Phân tích được ${Object.keys(rolesData).length} vị trí.`);
    
    // Lọc và chuẩn hóa dữ liệu để xuất file JSON không quá nặng
    const finalData = {};
    
    // Chỉ lấy Top 100 vị trí xuất hiện nhiều nhất (dựa trên tổng số skill counter)
    const sortedRoles = Object.keys(rolesData).sort((a, b) => {
      const countA = Object.values(rolesData[a].skills_counter).reduce((acc, val) => acc + val, 0);
      const countB = Object.values(rolesData[b].skills_counter).reduce((acc, val) => acc + val, 0);
      return countB - countA;
    }).slice(0, 100);

    sortedRoles.forEach(role => {
      const data = rolesData[role];
      
      // Top 20 skills phổ biến nhất
      const topSkills = Object.keys(data.skills_counter)
        .sort((a, b) => data.skills_counter[b] - data.skills_counter[a])
        .slice(0, 20);

      // Random 5 objectives
      const topObjectives = data.objectives.slice(0, 5);
      
      // Random 7 responsibilities
      const topResponsibilities = data.responsibilities.slice(0, 7);

      if (topSkills.length > 0 || topObjectives.length > 0 || topResponsibilities.length > 0) {
        finalData[role] = {
          objectives: topObjectives,
          skills: topSkills,
          responsibilities: topResponsibilities
        };
      }
    });

    // Ghi ra file
    fs.writeFileSync(OUT_PATH, JSON.stringify(finalData, null, 2));
    console.log(`Đã lưu dữ liệu rút gọn của ${Object.keys(finalData).length} vị trí vào: ${OUT_PATH}`);
  });
