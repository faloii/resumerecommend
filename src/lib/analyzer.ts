import Anthropic from '@anthropic-ai/sdk';
import { JobPosting } from './crawler';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExperienceMatchInfo {
  status: 'ideal' | 'perfect' | 'good' | 'acceptable' | 'underqualified' | 'overqualified';
  message: string;
  icon: string;
  color: string;
}

export interface MatchResult {
  job: JobPosting;
  score: number;
  topPercent: number;
  summary: string;
  keyMatches: string[];
  experienceMatch: ExperienceMatchInfo;
  estimatedSalary: { min: number; max: number };
}

// 이력서에서 경력 연차 추출
function extractExperienceYears(resumeText: string): number {
  // 총 경력 패턴
  const totalPatterns = [
    /총\s*경력[:\s]*(\d+)\s*년/,
    /경력[:\s]*(\d+)\s*년/,
    /(\d+)\s*년\s*경력/,
    /(\d+)\s*years?\s*(?:of\s*)?experience/i,
  ];
  
  for (const pattern of totalPatterns) {
    const match = resumeText.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  // 개별 경력 기간 합산
  const periodPatterns = [
    /(\d{4})[.\-\/년]\s*(\d{1,2})?[월]?\s*[-~]\s*(\d{4})[.\-\/년]\s*(\d{1,2})?[월]?/g,
    /(\d{4})[.\-\/년]\s*(\d{1,2})?[월]?\s*[-~]\s*현재/g,
    /\((\d+)년\s*(\d+)?개월?\)/g,
  ];
  
  let totalMonths = 0;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // 기간 패턴 매칭
  const periodMatch = resumeText.matchAll(/(\d{4})[.\-\/년]\s*(\d{1,2})?[월]?\s*[-~]\s*((\d{4})|현재)/g);
  for (const match of periodMatch) {
    const startYear = parseInt(match[1]);
    const startMonth = match[2] ? parseInt(match[2]) : 1;
    const endYear = match[3] === '현재' ? currentYear : parseInt(match[3]);
    const endMonth = match[3] === '현재' ? currentMonth : (match[4] ? 12 : 12);
    
    const months = (endYear - startYear) * 12 + (endMonth - startMonth);
    if (months > 0 && months < 360) {
      totalMonths += months;
    }
  }
  
  if (totalMonths > 0) {
    return Math.round(totalMonths / 12);
  }
  
  return 0;
}

// 공고에서 요구 경력 추출
function extractRequiredExperience(job: JobPosting): { min: number; max: number } {
  const text = `${job.title} ${job.description} ${job.requirements}`;
  
  // 신입/인턴
  if (/신입|인턴|주니어|junior|entry|0년/i.test(text)) {
    return { min: 0, max: 2 };
  }
  
  // 경력 범위 패턴
  const rangePatterns = [
    /경력\s*(\d+)\s*[-~]\s*(\d+)\s*년/,
    /(\d+)\s*[-~]\s*(\d+)\s*년\s*(?:이상)?/,
    /(\d+)\s*to\s*(\d+)\s*years?/i,
  ];
  
  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
  }
  
  // 최소 경력 패턴
  const minPatterns = [
    /경력\s*(\d+)\s*년\s*이상/,
    /(\d+)\s*년\s*이상/,
    /(\d+)\+?\s*years?/i,
    /최소\s*(\d+)\s*년/,
  ];
  
  for (const pattern of minPatterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1]);
      return { min, max: min + 5 };
    }
  }
  
  // 시니어/리드 키워드
  if (/시니어|senior|lead|리드|팀장|매니저/i.test(text)) {
    return { min: 5, max: 15 };
  }
  
  // 기본값 (경력 무관)
  return { min: 0, max: 20 };
}

// 이력서 품질 점수 계산 (원티드 합격 요소 기반)
function calculateResumeQualityScore(resumeText: string): {
  score: number;
  factors: {
    quantitativeResults: number;
    techStack: number;
    projectDetail: number;
    roleClarity: number;
    keyStrengths: number;
  };
} {
  const factors = {
    quantitativeResults: 0,
    techStack: 0,
    projectDetail: 0,
    roleClarity: 0,
    keyStrengths: 0,
  };

  // 1. 정량적 성과 (원티드 핵심 요소: 숫자로 표현된 성과)
  const quantPatterns = [
    /\d+%\s*(증가|감소|개선|향상|성장|절감|증대)/g,
    /(증가|감소|개선|향상|성장|절감|증대)\s*\d+%/g,
    /\d+배\s*(증가|성장|향상)/g,
    /MAU|DAU|WAU\s*\d+/gi,
    /매출\s*\d+/g,
    /\d+(만|억|천만)\s*원/g,
    /사용자\s*\d+/g,
    /트래픽\s*\d+/g,
  ];
  
  let quantCount = 0;
  for (const pattern of quantPatterns) {
    const matches = resumeText.match(pattern);
    if (matches) quantCount += matches.length;
  }
  factors.quantitativeResults = Math.min(quantCount * 5, 25);

  // 2. 기술 스택 명시 (사용기술: 형태로 명시)
  const techPatterns = [
    /사용\s*기술[:\s]*/gi,
    /기술\s*스택[:\s]*/gi,
    /Tech\s*Stack[:\s]*/gi,
    /Skills?[:\s]*/gi,
  ];
  
  let techMentions = 0;
  for (const pattern of techPatterns) {
    const matches = resumeText.match(pattern);
    if (matches) techMentions += matches.length;
  }
  factors.techStack = Math.min(techMentions * 4, 20);

  // 3. 프로젝트 상세 (기간, 역할, 결과 포함)
  const projectPatterns = [
    /\d{4}[.\-\/]\d{1,2}\s*[-~]\s*(\d{4}[.\-\/]\d{1,2}|현재)/g,
    /프로젝트|Project/gi,
  ];
  
  let projectCount = 0;
  for (const pattern of projectPatterns) {
    const matches = resumeText.match(pattern);
    if (matches) projectCount += matches.length;
  }
  factors.projectDetail = Math.min(projectCount * 3, 20);

  // 4. 역할 명확성 (담당, 주도, 리드, 설계 등)
  const rolePatterns = [
    /담당|주도|리드|설계|개발|운영|기획|관리/g,
    /기여도\s*\d+%/g,
    /메인|핵심|주요/g,
  ];
  
  let roleCount = 0;
  for (const pattern of rolePatterns) {
    const matches = resumeText.match(pattern);
    if (matches) roleCount += matches.length;
  }
  factors.roleClarity = Math.min(roleCount * 2, 20);

  // 5. 핵심역량 요약 (간단소개, 핵심역량 섹션)
  const strengthPatterns = [
    /핵심\s*역량/gi,
    /간단\s*소개/gi,
    /자기\s*소개/gi,
    /경험\s*보유/g,
    /능숙|숙련|전문/g,
  ];
  
  let strengthCount = 0;
  for (const pattern of strengthPatterns) {
    const matches = resumeText.match(pattern);
    if (matches) strengthCount += matches.length;
  }
  factors.keyStrengths = Math.min(strengthCount * 3, 15);

  const totalScore = Object.values(factors).reduce((a, b) => a + b, 0);
  
  return { score: totalScore, factors };
}

// 직급/레벨 기반 연봉 추정
function estimateSalaryRange(job: JobPosting, experienceYears: number): { min: number; max: number } {
  const text = `${job.title} ${job.description} ${job.requirements}`;
  
  // 레벨별 연봉 테이블 (2024 한국 IT 시장 기준, 만원 단위)
  const salaryTable = {
    executive: { min: 12000, max: 20000 },  // CTO, VP, Head, 임원
    lead: { min: 8000, max: 12000 },        // Lead, 팀장, 매니저
    senior: { min: 6000, max: 9000 },       // Senior, 시니어
    mid: { min: 4500, max: 6500 },          // 중니어 (3-6년)
    junior: { min: 3500, max: 5000 },       // Junior, 주니어 (0-2년)
  };

  // 직급 키워드 기반 판단
  if (/CTO|CPO|VP|Head|이사|본부장|임원/i.test(text)) {
    return salaryTable.executive;
  }
  if (/Lead|리드|팀장|매니저|Manager/i.test(text)) {
    return salaryTable.lead;
  }
  if (/Senior|시니어|선임/i.test(text)) {
    return salaryTable.senior;
  }
  if (/Junior|주니어|신입|인턴/i.test(text)) {
    return salaryTable.junior;
  }

  // 요구 경력 기반 추정
  const reqExp = extractRequiredExperience(job);
  const avgReqExp = (reqExp.min + reqExp.max) / 2;
  
  if (avgReqExp >= 10) return salaryTable.lead;
  if (avgReqExp >= 7) return salaryTable.senior;
  if (avgReqExp >= 3) return salaryTable.mid;
  return salaryTable.junior;
}

// 경력 매칭 결과 타입
interface ExperienceMatchResult {
  status: 'ideal' | 'perfect' | 'good' | 'acceptable' | 'underqualified' | 'overqualified';
  message: string;
  icon: string;
  color: string;
}

// 경력 매칭 상태 판단 (더 세분화된 버전)
function getExperienceMatch(
  candidateYears: number, 
  required: { min: number; max: number }
): ExperienceMatchResult {
  // max가 비현실적으로 큰 경우 (경력 무관 또는 ~이상) 보정
  const effectiveMax = required.max > 20 ? required.min + 10 : required.max;
  const midPoint = (required.min + effectiveMax) / 2;
  
  // 신입/인턴 공고 처리
  if (required.min === 0 && required.max <= 2) {
    if (candidateYears === 0) {
      return { status: 'ideal', message: '신입 채용에 딱 맞아요', icon: '🎯', color: 'bg-purple-100 text-purple-700' };
    }
    if (candidateYears <= 2) {
      return { status: 'perfect', message: `${candidateYears}년 경력도 지원 가능해요`, icon: '✓', color: 'bg-green-100 text-green-700' };
    }
    return { status: 'overqualified', message: `신입 채용이라 ${candidateYears}년 경력은 과할 수 있어요`, icon: '△', color: 'bg-orange-100 text-orange-700' };
  }
  
  // 경력 무관 공고 (min 0, max가 큰 경우)
  if (required.min === 0 && required.max >= 20) {
    if (candidateYears <= 3) {
      return { status: 'good', message: '경력 무관 공고, 주니어로 지원 가능', icon: '○', color: 'bg-blue-100 text-blue-700' };
    }
    return { status: 'perfect', message: '경력 무관 공고, 경험이 강점이 될 수 있어요', icon: '✓', color: 'bg-green-100 text-green-700' };
  }
  
  // 최소 경력만 명시된 경우 (예: 3년 이상)
  if (required.max >= 20) {
    const gap = candidateYears - required.min;
    if (gap < 0) {
      return { status: 'underqualified', message: `요구 경력 ${required.min}년에 ${Math.abs(gap)}년 부족해요`, icon: '△', color: 'bg-yellow-100 text-yellow-700' };
    }
    if (gap === 0) {
      return { status: 'good', message: `요구 경력 ${required.min}년 이상, 딱 맞아요`, icon: '✓', color: 'bg-green-100 text-green-700' };
    }
    if (gap <= 3) {
      return { status: 'perfect', message: `요구 경력 ${required.min}년 이상, ${candidateYears}년 경력이 적합해요`, icon: '✓', color: 'bg-green-100 text-green-700' };
    }
    if (gap <= 7) {
      return { status: 'ideal', message: `${required.min}년+ 공고에 ${candidateYears}년 경력이면 시니어급으로 강점`, icon: '🎯', color: 'bg-purple-100 text-purple-700' };
    }
    return { status: 'overqualified', message: `${required.min}년+ 공고에 ${candidateYears}년은 오버스펙일 수 있어요`, icon: '▽', color: 'bg-orange-100 text-orange-700' };
  }
  
  // 경력 범위가 명시된 경우 (예: 3~7년)
  if (candidateYears < required.min) {
    const gap = required.min - candidateYears;
    if (gap === 1) {
      return { status: 'acceptable', message: `요구 경력보다 1년 부족하지만 지원 가능해요`, icon: '○', color: 'bg-blue-100 text-blue-700' };
    }
    return { status: 'underqualified', message: `요구 경력 ${required.min}~${effectiveMax}년에 ${gap}년 부족해요`, icon: '△', color: 'bg-yellow-100 text-yellow-700' };
  }
  
  if (candidateYears > effectiveMax) {
    const gap = candidateYears - effectiveMax;
    if (gap <= 2) {
      return { status: 'acceptable', message: `요구 경력보다 ${gap}년 많지만 지원 가능해요`, icon: '○', color: 'bg-blue-100 text-blue-700' };
    }
    return { status: 'overqualified', message: `요구 경력 ${required.min}~${effectiveMax}년 대비 ${candidateYears}년은 시니어급`, icon: '▽', color: 'bg-orange-100 text-orange-700' };
  }
  
  // 범위 내에 있는 경우 - 위치에 따라 세분화
  if (Math.abs(candidateYears - midPoint) <= 1) {
    return { status: 'ideal', message: `요구 경력 ${required.min}~${effectiveMax}년의 정중앙, 최적의 매칭`, icon: '🎯', color: 'bg-purple-100 text-purple-700' };
  }
  if (candidateYears >= required.min && candidateYears <= required.min + 1) {
    return { status: 'good', message: `요구 경력 범위 내 (${candidateYears}년)`, icon: '✓', color: 'bg-green-100 text-green-700' };
  }
  return { status: 'perfect', message: `요구 경력 ${required.min}~${effectiveMax}년에 ${candidateYears}년으로 적합`, icon: '✓', color: 'bg-green-100 text-green-700' };
}

// 점수 → 상위 % 변환
function scoreToTopPercent(score: number): number {
  if (score >= 88) return 5;
  if (score >= 83) return 10;
  if (score >= 78) return 15;
  if (score >= 73) return 20;
  if (score >= 68) return 25;
  if (score >= 63) return 30;
  if (score >= 58) return 35;
  return 40;
}

// 근무지 필터링
function matchesLocation(job: JobPosting, preferredLocations: string[]): boolean {
  if (!preferredLocations || preferredLocations.length === 0) return true;
  
  const jobLocation = job.location.toLowerCase();
  
  const locationMap: Record<string, string[]> = {
    '서울': ['서울', 'seoul'],
    '경기': ['경기', '성남', '분당', '판교', '수원', '용인', '안양', '고양', '화성'],
    '인천': ['인천', 'incheon'],
    '부산': ['부산', 'busan'],
    '대구': ['대구', 'daegu'],
    '대전': ['대전', 'daejeon'],
    '광주': ['광주', 'gwangju'],
    '세종': ['세종', 'sejong'],
    '울산': ['울산', 'ulsan'],
    '강원': ['강원', 'gangwon'],
    '충북': ['충북', '충청북도'],
    '충남': ['충남', '충청남도'],
    '전북': ['전북', '전라북도'],
    '전남': ['전남', '전라남도'],
    '경북': ['경북', '경상북도'],
    '경남': ['경남', '경상남도'],
    '제주': ['제주', 'jeju'],
    '원격근무': ['원격', 'remote', '재택', '리모트'],
  };

  for (const preferred of preferredLocations) {
    const keywords = locationMap[preferred] || [preferred.toLowerCase()];
    for (const keyword of keywords) {
      if (jobLocation.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

// 연봉 매칭 점수 계산
function calculateSalaryMatchScore(job: JobPosting, currentSalary: number | null): number {
  if (!currentSalary) return 0;
  
  // job에 연봉 정보가 있는 경우 (annualFrom, annualTo)
  const jobMinSalary = (job as JobPosting & { annualFrom?: number }).annualFrom;
  const jobMaxSalary = (job as JobPosting & { annualTo?: number }).annualTo;
  
  if (!jobMinSalary && !jobMaxSalary) return 0;
  
  const jobAvgSalary = jobMaxSalary ? (jobMinSalary || 0 + jobMaxSalary) / 2 : jobMinSalary || 0;
  
  // 현재 연봉 대비 공고 연봉 비율
  const ratio = jobAvgSalary / currentSalary;
  
  // 10~30% 인상 범위면 보너스
  if (ratio >= 1.1 && ratio <= 1.3) return 5;
  // 현재와 비슷하면 약간의 보너스
  if (ratio >= 0.95 && ratio < 1.1) return 2;
  // 30% 이상 인상이면 약간의 보너스 (도전적)
  if (ratio > 1.3 && ratio <= 1.5) return 3;
  // 현재보다 낮으면 페널티
  if (ratio < 0.95) return -3;
  
  return 0;
}

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[],
  preferredLocations?: string[],
  currentSalary?: number | null
): Promise<MatchResult[]> {
  // 근무지 필터링 적용
  let filteredJobs = jobs;
  if (preferredLocations && preferredLocations.length > 0) {
    filteredJobs = jobs.filter(job => matchesLocation(job, preferredLocations));
    if (filteredJobs.length === 0) {
      filteredJobs = jobs; // 필터링 결과 없으면 전체 사용
    }
  }

  // 이력서 품질 분석
  const resumeQuality = calculateResumeQualityScore(resumeText);
  const candidateExperience = extractExperienceYears(resumeText);

  const jobsContext = filteredJobs.map((job, index) => `
[공고 ${index + 1}]
ID: ${job.id}
제목: ${job.title}
회사: ${job.company}
위치: ${job.location}
설명: ${job.description}
요구사항: ${job.requirements}
태그: ${job.tags.join(', ')}
`).join('\n---\n');

  const prompt = `당신은 원티드 채용 매칭 전문가입니다. 아래 이력서와 채용 공고들을 분석하여 **서류 합격 가능성**이 높은 순서로 매칭 결과를 JSON 형식으로 반환해주세요.

## 이력서
${resumeText}

## 이력서 품질 분석 결과
- 정량적 성과 점수: ${resumeQuality.factors.quantitativeResults}/25
- 기술 스택 명시: ${resumeQuality.factors.techStack}/20
- 프로젝트 상세도: ${resumeQuality.factors.projectDetail}/20
- 역할 명확성: ${resumeQuality.factors.roleClarity}/20
- 핵심역량 요약: ${resumeQuality.factors.keyStrengths}/15
- 추정 경력 연차: ${candidateExperience}년

## 채용 공고 목록
${jobsContext}

## 원티드 합격 이력서 기준 (중요!)
서류 합격 가능성을 높이는 핵심 요소:
1. **정량적 성과**: "매출 30% 증가", "MAU 10만 달성" 등 수치화된 성과
2. **직무기술서 키워드 일치도**: 공고의 요구사항과 이력서 내용의 키워드 매칭
3. **프로젝트 경험 상세도**: 기간, 역할, 사용기술, 결과가 명확히 기술
4. **경력 수준 적합성**: 공고의 요구 경력과 후보자 경력의 일치
5. **도메인/산업 경험**: 관련 산업 경험 보유 여부

## 점수 기준 (현실적으로 평가)
- 90~100점: 완벽한 매칭 (매우 드문 경우, 모든 요소가 정확히 일치)
- 80~89점: 대부분 일치하며 약간의 차이만 있음
- 70~79점: 주요 요소는 맞지만 일부 gap 존재
- 60~69점: 기본 조건은 맞지만 눈에 띄는 gap 있음
- 50~59점: 맞는 부분이 있지만 gap이 큼

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "matches": [
    {
      "jobIndex": 0,
      "score": 75,
      "summary": "서류 합격 가능성과 그 이유를 3줄 이내로 설명",
      "keyMatches": ["매칭 포인트1", "매칭 포인트2", "매칭 포인트3"],
      "improvementTips": "이 공고에 합격 가능성을 높이려면 어떤 점을 보완하면 좋을지"
    }
  ]
}

상위 10개 매칭 결과만 score 내림차순으로 정렬하여 반환하세요.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // JSON 파싱
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // 결과 매핑 및 후처리
    const matchResults: MatchResult[] = result.matches.map((match: {
      jobIndex: number;
      score: number;
      summary: string;
      keyMatches: string[];
      improvementTips?: string;
    }) => {
      const job = filteredJobs[match.jobIndex];
      const reqExp = extractRequiredExperience(job);
      const expMatch = getExperienceMatch(candidateExperience, reqExp);
      
      // 점수 보정
      let adjustedScore = match.score;
      
      // 90점 초과 시 85~89로 제한
      if (adjustedScore > 90) {
        adjustedScore = 85 + Math.floor(Math.random() * 5);
      } else if (adjustedScore > 85) {
        adjustedScore -= Math.floor(Math.random() * 3);
      }
      
      // 경력 미스매치 페널티 (expMatch.status 사용)
      if (expMatch.status === 'underqualified') {
        const gap = reqExp.min - candidateExperience;
        adjustedScore -= Math.min(gap * 5, 20);
      } else if (expMatch.status === 'overqualified') {
        const effectiveMax = reqExp.max > 20 ? reqExp.min + 10 : reqExp.max;
        const gap = candidateExperience - effectiveMax;
        adjustedScore -= Math.min(gap * 3, 15);
      }
      
      // 이력서 품질 보너스 (정량적 성과가 많으면 +2~5점)
      if (resumeQuality.factors.quantitativeResults >= 15) {
        adjustedScore += Math.min(Math.floor(resumeQuality.factors.quantitativeResults / 5), 5);
      }
      
      // 연봉 매칭 보너스/페널티
      if (currentSalary) {
        adjustedScore += calculateSalaryMatchScore(job, currentSalary);
      }
      
      // 점수 범위 제한
      adjustedScore = Math.max(40, Math.min(89, adjustedScore));
      
      return {
        job,
        score: adjustedScore,
        topPercent: scoreToTopPercent(adjustedScore),
        summary: match.summary,
        keyMatches: match.keyMatches,
        experienceMatch: expMatch,
        estimatedSalary: estimateSalaryRange(job, candidateExperience),
      };
    });

    // score 기준 내림차순 정렬 후 상위 10개 반환
    return matchResults
      .filter(r => r.job) // 유효한 job만 필터링
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
