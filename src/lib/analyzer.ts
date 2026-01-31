import Anthropic from '@anthropic-ai/sdk';
import { JobPosting } from './crawler';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MatchResult {
  job: JobPosting;
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

function estimateSalaryRange(title: string, annualFrom: number, annualTo: number): { min: number; max: number } {
  const titleLower = title.toLowerCase();
  
  let level: 'executive' | 'lead' | 'senior' | 'mid' | 'junior' = 'mid';
  
  if (titleLower.includes('cto') || titleLower.includes('cpo') || titleLower.includes('vp') || 
      titleLower.includes('head') || titleLower.includes('이사') || titleLower.includes('본부장')) {
    level = 'executive';
  } else if (titleLower.includes('lead') || titleLower.includes('리드') || titleLower.includes('팀장') || 
             titleLower.includes('매니저') || titleLower.includes('manager')) {
    level = 'lead';
  } else if (titleLower.includes('senior') || titleLower.includes('시니어') || annualFrom >= 7) {
    level = 'senior';
  } else if (annualFrom >= 3) {
    level = 'mid';
  } else {
    level = 'junior';
  }
  
  const salaryTable: { [key: string]: { min: number; max: number } } = {
    'executive': { min: 12000, max: 20000 },
    'lead': { min: 8000, max: 12000 },
    'senior': { min: 6000, max: 9000 },
    'mid': { min: 4500, max: 6500 },
    'junior': { min: 3500, max: 5000 },
  };
  
  const base = salaryTable[level];
  const avgYears = (annualFrom + annualTo) / 2;
  
  let minAdjust = 0;
  let maxAdjust = 0;
  
  if (level === 'junior' && avgYears >= 2) {
    minAdjust = 300;
    maxAdjust = 500;
  } else if (level === 'mid') {
    minAdjust = (avgYears - 3) * 200;
    maxAdjust = (avgYears - 3) * 300;
  } else if (level === 'senior') {
    minAdjust = (avgYears - 7) * 150;
    maxAdjust = (avgYears - 7) * 250;
  }
  
  const finalMin = Math.round((base.min + Math.max(0, minAdjust)) / 100) * 100;
  const finalMax = Math.round((base.max + Math.max(0, maxAdjust)) / 100) * 100;
  
  return { min: finalMin, max: finalMax };
}

function formatSalaryRange(min: number, max: number): string {
  const formatNum = (n: number) => {
    if (n >= 10000) {
      const billions = Math.floor(n / 10000);
      const remainder = n % 10000;
      if (remainder === 0) {
        return billions + '억원';
      }
      return billions + '억 ' + remainder.toLocaleString() + '만원';
    }
    return n.toLocaleString() + '만원';
  };
  
  return formatNum(min) + ' ~ ' + formatNum(max);
}

function extractYearsFromResume(resumeText: string): number {
  const patterns = [
    /(\d{1,2})\s*년\s*(경력|차|이상)/,
    /경력\s*:?\s*(\d{1,2})\s*년/,
    /(\d{1,2})\s*years?\s*(of\s*)?(experience)?/i,
    /총\s*(\d{1,2})\s*년/,
  ];
  
  for (const pattern of patterns) {
    const match = resumeText.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  const yearRanges = resumeText.matchAll(/20(\d{2})\s*[-~]\s*20(\d{2})/g);
  let totalYears = 0;
  for (const range of yearRanges) {
    const start = parseInt(range[1], 10);
    const end = parseInt(range[2], 10);
    totalYears += (end - start);
  }
  if (totalYears > 0) return totalYears;
  
  return 5;
}

function calculateExperiencePenalty(userYears: number, jobFrom: number, jobTo: number): number {
  if (userYears >= jobFrom && userYears <= jobTo) {
    return 0;
  }
  
  if (userYears < jobFrom) {
    const diff = jobFrom - userYears;
    return Math.min(diff * 5, 20);
  }
  
  if (userYears > jobTo) {
    const diff = userYears - jobTo;
    return Math.min(diff * 3, 15);
  }
  
  return 0;
}

function getExperienceWarning(userYears: number, jobFrom: number, jobTo: number): { type: 'match' | 'slight' | 'significant'; message: string } | null {
  if (userYears >= jobFrom && userYears <= jobTo) {
    return null;
  }
  
  if (userYears < jobFrom) {
    const diff = jobFrom - userYears;
    if (diff <= 1) {
      return {
        type: 'slight',
        message: '요구 경력보다 ' + diff + '년 부족하지만, 역량이 충분하다면 도전해보세요!'
      };
    } else {
      return {
        type: 'significant',
        message: '요구 경력보다 ' + diff + '년 부족해요. 포지션 상세 정보를 확인하고 신중히 고려해보세요.'
      };
    }
  }
  
  if (userYears > jobTo) {
    const diff = userYears - jobTo;
    if (diff <= 1) {
      return {
        type: 'slight',
        message: '요구 경력보다 ' + diff + '년 많지만, 새로운 도전을 원한다면 시도해보세요!'
      };
    } else {
      return {
        type: 'significant',
        message: '요구 경력보다 ' + diff + '년 많아요. 시니어/리드급 포지션인지 확인해보세요.'
      };
    }
  }
  
  return null;
}

function sanitizeText(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/\uFFFD/g, '');
  cleaned = cleaned.replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s.,!?()~\-·:;%+]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function getExperienceMatchText(userYears: number, jobFrom: number, jobTo: number): string {
  if (userYears >= jobFrom && userYears <= jobTo) {
    return '회원님의 ' + userYears + '년 경력이 공고의 요구 경력(' + jobFrom + '~' + jobTo + '년)과 딱 맞아요';
  }
  if (userYears > jobTo) {
    return '회원님의 풍부한 경력(' + userYears + '년)으로 리더십을 발휘할 수 있어요';
  }
  return '도전적인 성장 기회가 될 수 있는 포지션이에요';
}

// 근무지 매칭 함수
function matchesLocation(jobLocation: string, preferredLocations: string[]): boolean {
  const jobLoc = jobLocation.toLowerCase();
  
  for (const preferred of preferredLocations) {
    const pref = preferred.toLowerCase();
    
    // 원격근무 체크
    if (pref === '원격' && (jobLoc.includes('원격') || jobLoc.includes('remote') || jobLoc.includes('재택'))) {
      return true;
    }
    
    // 지역 매칭
    if (jobLoc.includes(pref)) {
      return true;
    }
    
    // 서울 특별 처리
    if (pref === '서울' && (jobLoc.includes('서울') || jobLoc.includes('seoul'))) {
      return true;
    }
    
    // 경기 특별 처리 (성남, 분당, 판교 등)
    if (pref === '경기' && (jobLoc.includes('경기') || jobLoc.includes('성남') || jobLoc.includes('분당') || jobLoc.includes('판교') || jobLoc.includes('수원') || jobLoc.includes('용인'))) {
      return true;
    }
  }
  
  return false;
}

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[],
  currentSalary: number | null = null,
  preferredLocations: string[] | null = null
): Promise<MatchResult[]> {
  const userYears = extractYearsFromResume(resumeText);
  
  let filteredJobs = jobs;
  
  // 연봉 필터링
  if (currentSalary && currentSalary > 0) {
    filteredJobs = filteredJobs.filter(job => {
      const estimated = estimateSalaryRange(job.title, job.annualFrom, job.annualTo);
      return estimated.max >= currentSalary;
    });
  }
  
  // 근무지 필터링
  if (preferredLocations && preferredLocations.length > 0) {
    const locationFiltered = filteredJobs.filter(job => matchesLocation(job.location, preferredLocations));
    // 필터링 결과가 있으면 사용, 없으면 원본 유지
    if (locationFiltered.length > 0) {
      filteredJobs = locationFiltered;
    }
  }
  
  // 필터링 후 공고가 없으면 원본 사용
  if (filteredJobs.length === 0) {
    filteredJobs = jobs;
  }
  
  const jobList = filteredJobs.map((job, i) => {
    const expRange = job.annualFrom + '-' + job.annualTo + '년';
    return i + ': ' + job.title + ' @ ' + job.company + ' (경력 ' + expRange + ', 위치: ' + job.location + ')';
  }).join('\n');

  const prompt = '사용자 경력: 약 ' + userYears + '년\n\n이력서:\n' + resumeText.substring(0, 2000) + '\n\n채용공고 목록:\n' + jobList + '\n\n위 이력서와 가장 잘 맞는 공고 1개를 선택하세요.\n\n반드시 아래 JSON 형식으로만 응답하세요. 한국어로만 작성:\n{"jobIndex":0,"score":75,"skillMatch":"이력서의 어떤 스킬이 공고와 맞는지 1문장","fitReason":"왜 이 회사/포지션이 적합한지 1문장","keyMatches":["매칭포인트1","매칭포인트2","매칭포인트3"],"hookMessage":"20자 이내 한줄 메시지"}\n\n점수 기준 (엄격하게 평가하세요):\n- 90~100: 스킬, 경력, 직무가 완벽히 일치할 때만\n- 80~89: 대부분 일치하고 약간의 차이만 있을 때\n- 70~79: 주요 요소는 맞지만 일부 gap이 있을 때\n- 60~69: 기본 조건은 맞지만 gap이 있을 때\n- 50~59: 맞는 부분이 있지만 gap이 클 때\n\n대부분의 매칭은 70점대여야 합니다. 90점 이상은 정말 드문 경우입니다.\n\n주의: 모든 내용은 한국어로만, 친근한 말투(~해요, ~이에요)로 작성하세요.';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON');
    }

    const m = JSON.parse(jsonMatch[0]);
    
    if (!filteredJobs[m.jobIndex]) {
      throw new Error('Invalid job index');
    }

    const selectedJob = filteredJobs[m.jobIndex];
    
    const penalty = calculateExperiencePenalty(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    let adjustedScore = Math.max(m.score - penalty, 50);
    
    // AI가 너무 높은 점수를 주면 보정
    if (adjustedScore > 90) {
      adjustedScore = 85 + Math.floor(Math.random() * 5);
    } else if (adjustedScore > 85) {
      adjustedScore = adjustedScore - Math.floor(Math.random() * 3);
    }

    const cleanedKeyMatches = (m.keyMatches || []).map((match: string) => sanitizeText(match)).filter((match: string) => match.length > 0);

    const experienceText = getExperienceMatchText(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    const skillText = sanitizeText(m.skillMatch) || '보유 스킬이 공고 요구사항과 잘 맞아요';
    const fitText = sanitizeText(m.fitReason) || '회원님의 경험을 살릴 수 있는 포지션이에요';
    
    const experienceWarning = getExperienceWarning(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    
    const salaryEstimate = estimateSalaryRange(selectedJob.title, selectedJob.annualFrom, selectedJob.annualTo);
    const salaryRangeText = formatSalaryRange(salaryEstimate.min, salaryEstimate.max);

    return [{
      job: selectedJob,
      score: adjustedScore,
      summary: skillText,
      keyMatches: cleanedKeyMatches.length > 0 ? cleanedKeyMatches : ['경력 매칭', '직무 적합'],
      salaryRange: salaryRangeText,
      hookMessage: sanitizeText(m.hookMessage) || '당신에게 딱 맞는 자리',
      matchReasons: {
        experience: experienceText,
        skills: skillText,
        fit: fitText,
      },
      experienceWarning: experienceWarning,
    }];
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
