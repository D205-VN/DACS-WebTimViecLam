import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export default function FilterSidebar({ value, options, onApply }) {
  const [expandedSections, setExpandedSections] = useState({
    salary: true,
    level: true,
    industry: true,
  });

  const [selectedSalary, setSelectedSalary] = useState(value?.salaryRange || '');
  const [selectedLevels, setSelectedLevels] = useState(value?.levels || []);
  const [selectedIndustries, setSelectedIndustries] = useState(value?.industries || []);

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

  const salaryRanges = options?.salaryRanges || [];
  const levels = options?.levels || [];
  const industries = options?.industries || [];

  const applyFilters = () => {
    onApply?.({
      salaryRange: selectedSalary,
      levels: selectedLevels,
      industries: selectedIndustries,
    });
  };

  const clearFilters = () => {
    setSelectedSalary('');
    setSelectedLevels([]);
    setSelectedIndustries([]);
    onApply?.({
      salaryRange: '',
      levels: [],
      industries: [],
    });
  };

  return (
    <aside className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-navy-700" />
          <h3 className="text-base font-bold text-gray-800">Bộ lọc</h3>
        </div>
        <button
          onClick={clearFilters}
          className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
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
                  <span className="text-sm flex-1">{range.label}</span>
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
                  key={typeof level === 'string' ? level : level.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedLevels.includes(typeof level === 'string' ? level : level.value) ? 'bg-navy-50 text-navy-700' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLevels.includes(typeof level === 'string' ? level : level.value)}
                    onChange={() => toggleLevel(typeof level === 'string' ? level : level.value)}
                    className="w-4 h-4 rounded text-navy-600 accent-navy-700"
                  />
                  <span className="text-sm flex-1">{typeof level === 'string' ? level : level.value}</span>
                  {typeof level === 'object' && level.count ? (
                    <span className="text-[11px] text-gray-400">{level.count}</span>
                  ) : null}
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
          <div className={`overflow-hidden transition-all duration-300 ${expandedSections.industry ? 'max-h-[26rem]' : 'max-h-0'}`}>
            <div className={`space-y-1 pt-1 ${industries.length > 7 ? 'max-h-[22rem] overflow-y-auto pr-1' : ''}`}>
              {industries.map((industry) => (
                <label
                  key={typeof industry === 'string' ? industry : industry.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIndustries.includes(typeof industry === 'string' ? industry : industry.value) ? 'bg-navy-50 text-navy-700' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(typeof industry === 'string' ? industry : industry.value)}
                    onChange={() => toggleIndustry(typeof industry === 'string' ? industry : industry.value)}
                    className="w-4 h-4 rounded text-navy-600 accent-navy-700"
                  />
                  <span className="text-sm flex-1">{typeof industry === 'string' ? industry : industry.value}</span>
                  {typeof industry === 'object' && industry.count ? (
                    <span className="text-[11px] text-gray-400">{industry.count}</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
        <button
          onClick={applyFilters}
          className="w-full py-2.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/20 transition-all duration-200"
        >
          Áp dụng bộ lọc
        </button>
      </div>
    </aside>
  );
}
