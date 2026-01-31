'use client';

import { useState, useCallback } from 'react';

interface MatchResult {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    url: string;
    tags: string[];
  };
  score: number;
  summary: string;
  keyMatches: string[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.pdf')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('PDF 파일만 업로드 가능합니다.');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('PDF 파일만 업로드 가능합니다.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('이력서 파일을 업로드해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      if (keyword) {
        formData.append('keyword', keyword);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '분석 중 오류가 발생했습니다.');
      }

      setResults(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 80) return '🎯';
    if (score >= 60) return '👍';
    if (score >= 40) return '🤔';
    return '📋';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">WantedFit</h1>
              <p className="text-sm text-gray-500">AI 기반 채용 공고 매칭</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!results && (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              이력서로 나에게 맞는 공고 찾기
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              PDF 이력서를 업로드하면 AI가 원티드 채용 공고 중<br />
              나와 가장 잘 맞는 Top 10 공고를 분석해 드립니다.
            </p>
          </div>
        )}

        {/* Upload Form */}
        {!results && (
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                ${dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : file 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-2">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    파일 제거
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">PDF 이력서를 드래그하거나 클릭하여 업로드</p>
                    <p className="text-sm text-gray-500 mt-1">최대 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Keyword Input (Optional) */}
            <div className="mt-4">
              <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">
                관심 직군/키워드 (선택사항)
              </label>
              <input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 프론트엔드, PM, 데이터분석"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || loading}
              className={`w-full mt-6 py-4 rounded-lg font-semibold text-white transition-all
                ${!file || loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI가 분석 중입니다... (약 30초 소요)
                </span>
              ) : (
                '매칭 분석 시작'
              )}
            </button>
          </form>
        )}

        {/* Results Section */}
        {results && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">매칭 결과</h2>
                <p className="text-gray-600">AI가 분석한 Top 10 추천 공고입니다.</p>
              </div>
              <button
                onClick={() => {
                  setResults(null);
                  setFile(null);
                  setKeyword('');
                }}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                다시 분석하기
              </button>
            </div>

            {/* Results Cards */}
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.job.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Rank & Score */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl font-bold text-gray-300">
                            #{index + 1}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(result.score)}`}>
                            {getScoreEmoji(result.score)} {result.score}점
                          </span>
                        </div>

                        {/* Job Title & Company */}
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {result.job.title}
                        </h3>
                        <p className="text-gray-600 mb-3">
                          {result.job.company} · {result.job.location}
                        </p>

                        {/* Tags */}
                        {result.job.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {result.job.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Summary */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <p className="text-sm font-medium text-blue-900 mb-2">
                            💡 AI 매칭 분석
                          </p>
                          <p className="text-sm text-blue-800">
                            {result.summary}
                          </p>
                        </div>

                        {/* Key Matches */}
                        <div className="flex flex-wrap gap-2">
                          {result.keyMatches.map((match, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200"
                            >
                              ✓ {match}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <a
                        href={result.job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        공고 보기 →
                      </a>
                      <span className="text-xs text-gray-400">
                        상세 분석은 원티드 회원 전용
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-center text-white">
              <h3 className="text-xl font-bold mb-2">
                더 정확한 매칭 분석이 필요하신가요?
              </h3>
              <p className="text-blue-100 mb-4">
                원티드 회원가입 시 상세 분석, 맞춤 추천, 이력서 피드백을 받을 수 있습니다.
              </p>
              <a
                href="https://www.wanted.co.kr/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                원티드 무료 가입하기
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>
            이 서비스는 원티드랩의 실험적 MVP입니다.
          </p>
          <p className="mt-1">
            문의: WantedLab PM Team
          </p>
        </footer>
      </div>
    </main>
  );
}
