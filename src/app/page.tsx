'use client';

import { useState, useEffect } from 'react';

interface MatchResult {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    tags: string[];
  };
  score: number;
  summary: string;
  keyMatches: string[];
  salaryRange: string;
  hookMessage: string;
  matchReasons: {
    experience: string;
    skills: string;
    fit: string;
  };
  experienceWarning: {
    type: 'match' | 'slight' | 'significant';
    message: string;
  } | null;
}

function getTopPercent(score: number): number {
  if (score >= 88) return 5;
  if (score >= 83) return 10;
  if (score >= 78) return 15;
  if (score >= 73) return 20;
  if (score >= 68) return 25;
  if (score >= 63) return 30;
  if (score >= 58) return 35;
  return 40;
}

const SALARY_OPTIONS = [
  { value: 0, label: '선택 안함' },
  { value: 3000, label: '3,000만원' },
  { value: 4000, label: '4,000만원' },
  { value: 5000, label: '5,000만원' },
  { value: 6000, label: '6,000만원' },
  { value: 7000, label: '7,000만원' },
  { value: 8000, label: '8,000만원' },
  { value: 9000, label: '9,000만원' },
  { value: 10000, label: '1억원' },
  { value: 12000, label: '1억 2,000만원' },
  { value: 15000, label: '1억 5,000만원 이상' },
  { value: -1, label: '직접 입력' },
];

const LOCATION_OPTIONS = [
  { value: '서울', label: '서울' },
  { value: '경기', label: '경기' },
  { value: '인천', label: '인천' },
  { value: '부산', label: '부산' },
  { value: '대구', label: '대구' },
  { value: '대전', label: '대전' },
  { value: '광주', label: '광주' },
  { value: '세종', label: '세종' },
  { value: '울산', label: '울산' },
  { value: '강원', label: '강원' },
  { value: '충북', label: '충북' },
  { value: '충남', label: '충남' },
  { value: '전북', label: '전북' },
  { value: '전남', label: '전남' },
  { value: '경북', label: '경북' },
  { value: '경남', label: '경남' },
  { value: '제주', label: '제주' },
  { value: '원격', label: '원격근무' },
];

const LOADING_MESSAGES = [
  '이력서 분석 중',
  '적합한 공고 탐색 중',
  '매칭 점수 계산 중',
  '거의 완료!',
];

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [salaryOption, setSalaryOption] = useState(0);
  const [customSalary, setCustomSalary] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const getCurrentSalary = (): number | null => {
    if (salaryOption === -1) {
      const parsed = parseInt(customSalary.replace(/,/g, ''), 10);
      return isNaN(parsed) ? null : parsed;
    }
    return salaryOption > 0 ? salaryOption : null;
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resumeText.trim().length < 30) {
      setError('이력서 내용을 30자 이상 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingMessageIndex(0);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText,
          currentSalary: getCurrentSalary(),
          preferredLocations: selectedLocations.length > 0 ? selectedLocations : null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '분석 중 오류가 발생했습니다.');
      }

      if (data.matches && data.matches.length > 0) {
        setResult(data.matches[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatSalaryInput = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers) {
      return parseInt(numbers, 10).toLocaleString();
    }
    return '';
  };

  const getWarningStyle = (type: string) => {
    if (type === 'slight') {
      return {
        container: 'bg-yellow-50 border border-yellow-200',
        icon: 'bg-yellow-200',
        iconText: 'text-yellow-700',
        text: 'text-yellow-800'
      };
    }
    return {
      container: 'bg-orange-50 border border-orange-200',
      icon: 'bg-orange-200',
      iconText: 'text-orange-700',
      text: 'text-orange-800'
    };
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">원티드핏</h1>
              <p className="text-sm text-gray-500">AI 맞춤 공고 추천</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {!result && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                당신을 위한<br />
                <span className="text-blue-600">단 하나의</span> 맞춤 공고
              </h2>
              <p className="text-lg text-gray-600">
                이력서 내용을 붙여넣으면 AI가 가장 적합한 공고를 찾아드립니다.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="이력서 내용을 붙여넣기 해주세요.

예시:
- 경력: 프론트엔드 개발자 3년
- 기술: React, TypeScript, Next.js
- 학력: 컴퓨터공학 전공"
                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-800"
                disabled={loading}
              />
              
              <p className="mt-2 text-sm text-gray-500 text-right">
                {resumeText.length}자 입력됨
              </p>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  현재 연봉 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  입력하시면 현재 연봉 이상의 포지션만 추천해드려요
                </p>
                <select
                  value={salaryOption}
                  onChange={(e) => setSalaryOption(Number(e.target.value))}
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  disabled={loading}
                >
                  {SALARY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                {salaryOption === -1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={customSalary}
                      onChange={(e) => setCustomSalary(formatSalaryInput(e.target.value))}
                      placeholder="예: 7,500"
                      className="flex-1 p-3 border border-gray-200 rounded-lg bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      disabled={loading}
                    />
                    <span className="text-gray-600 font-medium">만원</span>
                  </div>
                )}
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  희망 근무지 <span className="text-gray-400 font-normal">(선택, 복수 선택 가능)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  선택하시면 해당 지역의 공고만 추천해드려요
                </p>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleLocation(option.value)}
                      disabled={loading}
                      className={[
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        selectedLocations.includes(option.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {selectedLocations.length > 0 && (
                  <p className="mt-2 text-xs text-blue-600">
                    선택: {selectedLocations.join(', ')}
                  </p>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm mb-3">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      handleSubmit(new Event('submit') as unknown as React.FormEvent);
                    }}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    🔄 다시 시도
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={resumeText.trim().length < 30 || loading}
                className={[
                  'relative w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all overflow-hidden',
                  resumeText.trim().length < 30
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : loading
                      ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white cursor-wait'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                ].join(' ')}
                style={loading ? { backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' } : {}}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="inline-block min-w-[140px]">{LOADING_MESSAGES[loadingMessageIndex]}...</span>
                  </span>
                ) : (
                  '내 맞춤 공고 찾기'
                )}
              </button>
              
              {loading && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  최대 30초 정도 소요될 수 있어요
                </p>
              )}

              <style jsx>{`
                @keyframes shimmer {
                  0% { background-position: 100% 0; }
                  100% { background-position: -100% 0; }
                }
              `}</style>
            </form>
          </>
        )}

        {result && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg">
                &quot;{result.hookMessage}&quot;
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="text-center flex-1">
                    <div className="text-sm text-blue-100 mb-1">예상 연봉</div>
                    <div className="text-2xl font-bold">{result.salaryRange}</div>
                  </div>
                  <div className="w-px h-16 bg-white/30"></div>
                  <div className="text-center flex-1">
                    <div className="text-sm text-blue-100 mb-1">최적 매칭</div>
                    <div className="text-3xl font-bold">상위 {getTopPercent(result.score)}%</div>
                    <div className="mt-2 w-full bg-white/20 rounded-full h-2">
                      <div 
                        className="bg-white rounded-full h-2 transition-all"
                        style={{ width: result.score + '%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                {result.experienceWarning && (
                  <div className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${getWarningStyle(result.experienceWarning.type).container}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${getWarningStyle(result.experienceWarning.type).icon}`}>
                      <span className={`text-sm ${getWarningStyle(result.experienceWarning.type).iconText}`}>!</span>
                    </div>
                    <p className={`text-sm ${getWarningStyle(result.experienceWarning.type).text}`}>
                      {result.experienceWarning.message}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <p className="text-sm text-gray-500 mb-1">추천 공고</p>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{result.job.title}</h3>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500">회사</p>
                      <p className="text-lg font-semibold text-blue-600">{result.job.company}</p>
                    </div>
                    <div className="w-px h-10 bg-gray-300"></div>
                    <div>
                      <p className="text-sm text-gray-500">위치</p>
                      <p className="text-lg font-semibold text-gray-700">{result.job.location}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 mb-6">
                  <p className="text-sm font-semibold text-blue-900 mb-4">원티드 추천 이유</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">1</span>
                      </div>
                      <p className="text-blue-800">{result.matchReasons?.experience || '경력 조건이 잘 맞아요'}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">2</span>
                      </div>
                      <p className="text-blue-800">{result.matchReasons?.skills || '보유 스킬이 공고와 잘 맞아요'}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">3</span>
                      </div>
                      <p className="text-blue-800">{result.matchReasons?.fit || '회원님의 경험을 살릴 수 있는 포지션이에요'}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-sm text-gray-500 mb-3">매칭 포인트</p>
                  <div className="flex flex-wrap gap-2">
                    {result.keyMatches.map((match, i) => (
                      <span key={i} className="px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">
                        {match}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href={result.job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-blue-600 text-white text-center font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  {result.job.company} 채용 공고 보러가기
                </a>
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setResumeText(''); setSalaryOption(0); setCustomSalary(''); setSelectedLocations([]); }}
              className="w-full py-3 text-gray-600 hover:text-gray-900"
            >
              다시 분석하기
            </button>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>원티드랩의 실험적 MVP 서비스</p>
          <p className="mt-1">문의: 원티드랩 PO팀</p>
        </footer>
      </div>
    </main>
  );
}
