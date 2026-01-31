'use client';

import { useState } from 'react';

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
  if (score >= 90) return 3;
  if (score >= 85) return 5;
  if (score >= 80) return 10;
  if (score >= 75) return 15;
  if (score >= 70) return 20;
  if (score >= 65) return 30;
  return 35;
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
];

const LOADING_MESSAGES = [
  '이력서를 분석하고 있어요...',
  '적합한 공고를 찾고 있어요...',
  '매칭 점수를 계산하고 있어요...',
  '거의 다 됐어요!',
];

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [currentSalary, setCurrentSalary] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resumeText.trim().length < 30) {
      setError('이력서 내용을 30자 이상 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingMessage(LOADING_MESSAGES[0]);

    // 로딩 메시지 순환
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
    }, 3000);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText,
          currentSalary: currentSalary > 0 ? currentSalary : null
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
      clearInterval(messageInterval);
      setLoading(false);
    }
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
        {/* 로딩 화면 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
            </div>
            <p className="text-xl font-semibold text-gray-800 mb-2">{loadingMessage}</p>
            <p className="text-sm text-gray-500">최대 30초 정도 소요될 수 있어요</p>
            
            {/* 프로그레스 바 */}
            <div className="w-64 mt-6 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" 
                   style={{ width: '100%', animation: 'loading 2s ease-in-out infinite' }}></div>
            </div>
            
            <style jsx>{`
              @keyframes loading {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(0%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        )}

        {!result && !loading && (
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
                placeholder="이력서 내용을 붙여넣기 해주세요.&#10;&#10;예시:&#10;- 경력: 프론트엔드 개발자 3년&#10;- 기술: React, TypeScript, Next.js&#10;- 학력: 컴퓨터공학 전공"
                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-800"
              />
              
              <p className="mt-2 text-sm text-gray-500 text-right">
                {resumeText.length}자 입력됨
              </p>

              {/* 현재 연봉 선택 */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  현재 연봉 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  입력하시면 현재 연봉 이상의 포지션만 추천해드려요
                </p>
                <select
                  value={currentSalary}
                  onChange={(e) => setCurrentSalary(Number(e.target.value))}
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                >
                  {SALARY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={resumeText.trim().length < 30 || loading}
                className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all
                  ${resumeText.trim().length < 30 || loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                  }`}
              >
                내 맞춤 공고 찾기
              </button>
            </form>
          </>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* 핏 메시지 */}
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg">
                &quot;{result.hookMessage}&quot;
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
              {/* 상위 % + 연봉 */}
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
                {/* 경력 미스매치 경고 */}
                {result.experienceWarning && (
                  <div className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${
                    result.experienceWarning.type === 'slight' 
                      ? 'bg-yellow-50 border border-yellow-200' 
                      : 'bg-orange-50 border border-orange-200'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      result.experienceWarning.type === 'slight'
                        ? 'bg-yellow-200'
                        : 'bg-orange-200'
                    }`}>
                      <span className={`text-sm ${
                        result.experienceWarning.type === 'slight'
                          ? 'text-yellow-700'
                          : 'text-orange-700'
                      }`}>!</span>
                    </div>
                    <p className={`text-sm ${
                      result.experienceWarning.type === 'slight'
                        ? 'text-yellow-800'
                        : 'text-orange-800'
                    }`}>
                      {result.experienceWarning.message}
                    </p>
                  </div>
                )}

                {/* 공고 정보 */}
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

                {/* 원티드 추천 이유 */}
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

                {/* 매칭 포인트 */}
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

                {/* CTA */}
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
              onClick={() => { setResult(null); setResumeText(''); }}
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
