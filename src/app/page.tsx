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
}

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
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

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
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
                placeholder="이력서 내용을 붙여넣기 해주세요.&#10;&#10;예시:&#10;- 경력: 프론트엔드 개발자 3년&#10;- 기술: React, TypeScript, Next.js&#10;- 학력: 컴퓨터공학 전공"
                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-800"
              />
              
              <p className="mt-2 text-sm text-gray-500 text-right">
                {resumeText.length}자 입력됨
              </p>

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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    AI가 분석 중...
                  </span>
                ) : (
                  '내 맞춤 공고 찾기'
                )}
              </button>
            </form>
          </>
        )}

        {result && (
          <div className="space-y-6">
            {/* 핏 메시지 - 최상단 후킹 */}
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg">
                &quot;{result.hookMessage}&quot;
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
              {/* 연봉 + 점수 영역 */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="text-center flex-1">
                    <div className="text-sm text-blue-100 mb-1">예상 연봉</div>
                    <div className="text-2xl font-bold">{result.salaryRange}</div>
                  </div>
                  <div className="w-px h-12 bg-white/30"></div>
                  <div className="text-center flex-1">
                    <div className="text-sm text-blue-100 mb-1">매칭 점수</div>
                    <div className="text-4xl font-bold">{result.score}</div>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
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

                {/* AI 추천 이유 */}
                <div className="bg-blue-50 rounded-xl p-6 mb-6">
                  <p className="text-sm font-semibold text-blue-900 mb-2">AI 추천 이유</p>
                  <p className="text-blue-800">{result.summary}</p>
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

                {/* CTA 버튼 */}
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
