import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export default function FilterSidebar() {
  const [expandedSections, setExpandedSections] = useState({
    salary: true,
    level: true,
    industry: true,
  });

  const [selectedSalary, setSelectedSalary] = useState('');
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState([]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleLevel = (level) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const toggleIndustry = (industry) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
  };

  const salaryRanges = [
    { value: '', label: 'Tất cả' },
    { value: '5-10', label: '5 - 10 triệu' },
    { value: '10-15', label: '10 - 15 triệu' },
    { value: '15-20', label: '15 - 20 triệu' },
    { value: '20-30', label: '20 - 30 triệu' },
    { value: '30+', label: 'Trên 30 triệu' },
  ];

  const levels = ['Thực tập sinh', 'Nhân viên', 'Trưởng nhóm', 'Quản lý', 'Giám đốc'];
  const industries = ['Công nghệ thông tin', 'Marketing', 'Tài chính', 'Giáo dục', 'Y tế', 'Bán hàng', 'Thiết kế'];

  return (
    <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-navy-700" />
          <h3 className="text-base font-bold text-gray-800">Bộ lọc</h3>
        </div>
        <button
          onClick={() => {
            setSelectedSalary('');
            setSelectedLevels([]);
            setSelectedIndustries([]);
          }}
          className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors"
        >
          Xóa tất cả
        </button>
      </div>

      {/* Salary Filter */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('salary')}
          className="flex items-center justify-between w-full py-2 text-sm font-semibold text-gray-700"
        >
          Mức lương
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.salary ? 'rotate-180' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${expandedSections.salary ? 'max-h-60' : 'max-h-0'}`}>
          <div className="space-y-1 pt-1">
            {salaryRanges.map((range) => (
              <label
                key={range.value}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSalary === range.value ? 'bg-navy-50 text-navy-700' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="salary"
                  value={range.value}
                  checked={selectedSalary === range.value}
                  onChange={() => setSelectedSalary(range.value)}
                  className="w-4 h-4 text-navy-600 accent-navy-700"
                />
                <span className="text-sm">{range.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 my-3"></div>

      {/* Level Filter */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('level')}
          className="flex items-center justify-between w-full py-2 text-sm font-semibold text-gray-700"
        >
          Cấp bậc
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.level ? 'rotate-180' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${expandedSections.level ? 'max-h-60' : 'max-h-0'}`}>
          <div className="space-y-1 pt-1">
            {levels.map((level) => (
              <label
                key={level}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedLevels.includes(level) ? 'bg-navy-50 text-navy-700' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedLevels.includes(level)}
                  onChange={() => toggleLevel(level)}
                  className="w-4 h-4 rounded text-navy-600 accent-navy-700"
                />
                <span className="text-sm">{level}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 my-3"></div>

      {/* Industry Filter */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('industry')}
          className="flex items-center justify-between w-full py-2 text-sm font-semibold text-gray-700"
        >
          Ngành nghề
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.industry ? 'rotate-180' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${expandedSections.industry ? 'max-h-80' : 'max-h-0'}`}>
          <div className="space-y-1 pt-1">
            {industries.map((industry) => (
              <label
                key={industry}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedIndustries.includes(industry) ? 'bg-navy-50 text-navy-700' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIndustries.includes(industry)}
                  onChange={() => toggleIndustry(industry)}
                  className="w-4 h-4 rounded text-navy-600 accent-navy-700"
                />
                <span className="text-sm">{industry}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Apply Button */}
      <button className="w-full mt-4 py-2.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/20 transition-all duration-200">
        Áp dụng bộ lọc
      </button>
    </aside>
  );
}
