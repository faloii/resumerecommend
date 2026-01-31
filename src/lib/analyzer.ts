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

// 직무/경력별 예상 연봉 테이블 (만원 단위)
function estimateSalaryRange(title: string, annualFrom: number, annualTo: number): { min: number; max: number } {
  const avgYears = (annualFrom + annualTo) / 2;
  
  // 기본 연봉 (신입 기준 4000만원)
  let baseSalary = 4000;
  
  // 직무별 가중치
  const titleLower = title.toLowerCase();
  if (titleLower.includes('cto') || titleLower.includes('vp') || titleLower.includes('head')) {
    baseSalary = 8000;
  } else if (titleLower.includes('lead') || titleLower.includes('리드') || titleLower.includes('팀장')) {
    baseSalary = 6000;
  } else if (titleLower.includes('senior') || titleLower.includes('시니어')) {
    baseSalary = 5500;
  } else if (titleLower.includes('mlops') || titleLower.includes('ai') || titleLower.includes('ml')) {
    baseSalary = 5000;
  } else if (titleLower.includes('backend') || titleLower.includes('백엔드') || titleLower.includes('frontend') || titleLower.includes('프론트')) {
    baseSalary = 4500;
  }
  
  // 경력에 따른 연봉 증가 (연 5~8% 가정)
  const yearlyIncrease = baseSalary * 0.07;
  const minSalary = Math.round(baseSalary + (annualFrom * yearlyIncrease));
  const maxSalary = Math.round(baseSalary + (annualTo * yearlyIncrease));
  
  return { min: minSalary, max: maxSalary };
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
    return Math.min(diff * 3, 15);
  }
  
  if (userYears > jobTo) {
    const diff = userYears - jobTo;
    return Math.min(diff * 2, 10);
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

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[],
  currentSalary: number | null = null
): Promise<MatchResult[]> {
  const userYears = extractYearsFromResume(resumeText);
  
  // 연봉 필터링: 현재 연봉보다 낮은 포지션 제외
  let filteredJobs = jobs;
  if (currentSalary && currentSalary > 0) {
    filteredJobs = jobs.filter(job => {
      const estimated = estimateSalaryRange(job.title, job.annualFrom, job.annualTo);
      // 예상 최대 연봉이 현재 연봉보다 높은 경우만 포함
      return estimated.max >= currentSalary;
    });
    
    // 필터링 후 공고가 없으면 원본 사용
    if (filteredJobs.length === 0) {
      filteredJobs = jobs;
    }
  }
  
  const jobList = filteredJobs.map((job, i) => {
    const expRange = job.annualFrom + '-' + job.annualTo + '년';
    return i + ': ' + job.title + ' @ ' + job.company + ' (경력 ' + expRange + ')';
  }).join('\n');

  const prompt = '사용자 경력: 약 ' + userYears + '년\n\n이력서:\n' + resumeText.substring(0, 2000) + '\n\n채용공고 목록:\n' + jobList + '\n\n위 이력서와 가장 잘 맞는 공고 1개를 선택하세요.\n\n반드시 아래 JSON 형식으로만 응답하세요. 한국어로만 작성:\n{"jobIndex":0,"score":85,"skillMatch":"이력서의 어떤 스킬이 공고와 맞는지 1문장","fitReason":"왜 이 회사/포지션이 적합한지 1문장","keyMatches":["매칭포인트1","매칭포인트2","매칭포인트3"],"hookMessage":"20자 이내 한줄 메시지"}\n\n주의: 모든 내용은 한국어로만, 친근한 말투(~해요, ~이에요)로 작성하세요.';

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
    const adjustedScore = Math.max(m.score - penalty, 50);

    const cleanedKeyMatches = (m.keyMatches || []).map((match: string) => sanitizeText(match)).filter((match: string) => match.length > 0);

    const experienceText = getExperienceMatchText(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    const skillText = sanitizeText(m.skillMatch) || '보유 스킬이 공고 요구사항과 잘 맞아요';
    const fitText = sanitizeText(m.fitReason) || '회원님의 경험을 살릴 수 있는 포지션이에요';
    
    const experienceWarning = getExperienceWarning(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    
    // 예상 연봉 계산
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
