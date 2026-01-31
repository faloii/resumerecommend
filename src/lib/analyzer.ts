import Anthropic from '@anthropic-ai/sdk';
import { JobPosting } from './crawler';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 이력서에서 추출한 후보자 정보
export interface CandidateProfile {
  experienceYears: number;           // 총 경력 연차
  jobCategory: string;               // 직군 (개발, 기획, 디자인 등)
  jobRoles: string[];                // 직무들 (프론트엔드, PM 등)
  skills: string[];                  // 보유 기술
  companies: CompanyHistory[];       // 이전 회사 이력
  education: EducationInfo | null;   // 학력 정보
  domains: string[];                 // 도메인 경험 (핀테크, 커머스 등)
}

export interface CompanyHistory {
  name: string;
  tier: 'big' | 'unicorn' | 'startup' | 'mid' | 'unknown';
  duration?: number; // 개월
}

export interface EducationInfo {
  level: 'high' | 'college' | 'bachelor' | 'master' | 'phd';
  major?: string;
  school?: string;
  tier?: 'top' | 'good' | 'normal';
}

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

// 유명 회사 리스트 (티어별)
const COMPANY_TIERS: { [tier: string]: string[] } = {
  big: ['삼성', '네이버', '카카오', 'lg', 'sk', '현대', 'kt', '포스코', 'cj', '롯데', 'naver', 'kakao', 'samsung', '구글', 'google', '아마존', 'amazon', '마이크로소프트', 'microsoft', '애플', 'apple', '메타', 'meta', 'facebook'],
  unicorn: ['토스', '쿠팡', '배달의민족', '당근마켓', '야놀자', '직방', '비바리퍼블리카', '우아한형제들', '무신사', '카카오뱅크', '카카오페이', '라인', 'line', '하이퍼커넥트', '크래프톤', 'krafton', '넥슨', 'nexon', 'nc소프트', 'ncsoft', '스마일게이트', '넷마블', 'netmarble'],
  startup: ['스타트업', '시리즈a', '시리즈b', '프리a', '씨드'],
};

// 대학교 티어
const UNIVERSITY_TIERS: { [tier: string]: string[] } = {
  top: ['서울대', '카이스트', 'kaist', '포항공대', 'postech', '연세대', '고려대', '서강대', '성균관대', '한양대', 'mit', 'stanford', 'harvard', 'berkeley', 'cmu', 'carnegie'],
  good: ['중앙대', '경희대', '한국외대', '서울시립대', '건국대', '동국대', '홍익대', '숙명여대', '이화여대', '아주대', '인하대', '부산대', '경북대', '전남대'],
};

// 이력서에서 후보자 프로필 추출
function extractCandidateProfile(resumeText: string): CandidateProfile {
  const lowerText = resumeText.toLowerCase();
  
  return {
    experienceYears: extractExperienceYears(resumeText),
    jobCategory: extractCandidateJobCategory(resumeText),
    jobRoles: extractCandidateJobRoles(resumeText),
    skills: extractSkills(resumeText),
    companies: extractCompanyHistory(resumeText),
    education: extractEducation(resumeText),
    domains: extractDomains(resumeText),
  };
}

// 후보자 직군 추출 (가중치 기반)
function extractCandidateJobCategory(resumeText: string): string {
  const lower = resumeText.toLowerCase();
  const firstLine = resumeText.split('\n')[0].toLowerCase(); // 첫 줄 (보통 직함)
  
  // 1. 첫 줄에서 명시적 직군 확인 (가장 높은 우선순위)
  if (/pm|po|product|프로덕트|기획/.test(firstLine)) {
    return '기획';
  }
  if (/개발|developer|engineer|엔지니어/.test(firstLine) && !/pm|po|product|기획/.test(firstLine)) {
    return '개발';
  }
  if (/디자인|designer|ux|ui/.test(firstLine)) {
    return '디자인';
  }
  if (/데이터|data|analyst|scientist/.test(firstLine)) {
    return '데이터';
  }
  if (/마케팅|marketing|growth/.test(firstLine)) {
    return '마케팅';
  }
  
  // 2. 전체 텍스트에서 가중치 기반 추출
  const categoryScores: { [key: string]: number } = {
    '기획': 0,
    '개발': 0,
    '디자인': 0,
    '데이터': 0,
    '마케팅': 0,
  };
  
  // 기획 (PM/PO) - 높은 가중치
  const pmKeywords = [
    { pattern: /product\s*(manager|owner)/gi, weight: 10 },
    { pattern: /프로덕트\s*(매니저|오너|관리자)/gi, weight: 10 },
    { pattern: /\bpm\b/gi, weight: 8 },
    { pattern: /\bpo\b/gi, weight: 8 },
    { pattern: /서비스\s*기획/gi, weight: 7 },
    { pattern: /기획자/gi, weight: 6 },
    { pattern: /프로덕트/gi, weight: 5 },
    { pattern: /로드맵/gi, weight: 3 },
    { pattern: /백로그/gi, weight: 3 },
    { pattern: /PRD|기획서|요구사항/gi, weight: 3 },
    { pattern: /스프린트/gi, weight: 2 },
    { pattern: /agile|애자일|스크럼/gi, weight: 2 },
  ];
  
  for (const { pattern, weight } of pmKeywords) {
    const matches = lower.match(pattern);
    if (matches) categoryScores['기획'] += matches.length * weight;
  }
  
  // 개발 - 일반적인 가중치 (PM/PO 키워드가 있으면 가중치 감소)
  const devKeywords = [
    { pattern: /개발자/gi, weight: 5 },
    { pattern: /developer|engineer/gi, weight: 5 },
    { pattern: /엔지니어/gi, weight: 4 },
    { pattern: /backend|frontend|풀스택/gi, weight: 4 },
    { pattern: /코딩|프로그래밍/gi, weight: 3 },
  ];
  
  // PM/PO 관련 키워드가 많으면 개발 가중치 감소
  const hasPMContext = categoryScores['기획'] > 10;
  const devMultiplier = hasPMContext ? 0.3 : 1;
  
  for (const { pattern, weight } of devKeywords) {
    const matches = lower.match(pattern);
    if (matches) categoryScores['개발'] += matches.length * weight * devMultiplier;
  }
  
  // 디자인
  const designKeywords = [
    { pattern: /디자이너/gi, weight: 5 },
    { pattern: /ux\s*디자인/gi, weight: 5 },
    { pattern: /ui\s*디자인/gi, weight: 5 },
    { pattern: /figma|sketch/gi, weight: 3 },
  ];
  
  for (const { pattern, weight } of designKeywords) {
    const matches = lower.match(pattern);
    if (matches) categoryScores['디자인'] += matches.length * weight;
  }
  
  // 데이터
  const dataKeywords = [
    { pattern: /데이터\s*(분석|사이언)/gi, weight: 5 },
    { pattern: /data\s*(analyst|scientist|engineer)/gi, weight: 5 },
    { pattern: /머신러닝|ml|딥러닝/gi, weight: 4 },
  ];
  
  for (const { pattern, weight } of dataKeywords) {
    const matches = lower.match(pattern);
    if (matches) categoryScores['데이터'] += matches.length * weight;
  }
  
  // 마케팅
  const marketingKeywords = [
    { pattern: /마케터|마케팅/gi, weight: 5 },
    { pattern: /그로스|growth/gi, weight: 4 },
    { pattern: /퍼포먼스\s*마케팅/gi, weight: 5 },
  ];
  
  for (const { pattern, weight } of marketingKeywords) {
    const matches = lower.match(pattern);
    if (matches) categoryScores['마케팅'] += matches.length * weight;
  }
  
  // 최고 점수 카테고리 반환
  let maxScore = 0;
  let bestCategory = '기타';
  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  console.log('직군 점수:', categoryScores, '-> 결과:', bestCategory);
  return bestCategory;
}

// 후보자 직무 추출 (우선순위 기반)
function extractCandidateJobRoles(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  const firstLines = resumeText.split('\n').slice(0, 5).join(' ').toLowerCase(); // 상단 5줄
  
  const roles: string[] = [];
  
  // 1. 상단에서 명시적 직무 확인 (최우선)
  // PM/PO 우선 체크
  if (/product\s*(manager|owner)|프로덕트\s*(매니저|오너)|\bpm\b|\bpo\b/i.test(firstLines)) {
    if (/\bpo\b|product\s*owner|프로덕트\s*오너/i.test(firstLines)) {
      roles.push('PO');
    }
    if (/\bpm\b|product\s*manager|프로덕트\s*매니저/i.test(firstLines)) {
      roles.push('PM');
    }
  }
  
  // 서비스 기획 체크
  if (/서비스\s*기획|기획자/i.test(firstLines) && roles.length === 0) {
    roles.push('서비스기획');
  }
  
  // 2. PM/PO가 이미 발견되었으면 개발 직무는 추가하지 않음
  const isPMPO = roles.includes('PM') || roles.includes('PO') || roles.includes('서비스기획');
  
  // 3. 전체 텍스트에서 직무 추출
  const roleKeywords: { [key: string]: { patterns: RegExp[], priority: number } } = {
    'PM': { patterns: [/\bpm\b/i, /product\s*manager/i, /프로덕트\s*매니저/i], priority: 10 },
    'PO': { patterns: [/\bpo\b/i, /product\s*owner/i, /프로덕트\s*오너/i], priority: 10 },
    '서비스기획': { patterns: [/서비스\s*기획/i, /기획자/i], priority: 9 },
    '프론트엔드': { patterns: [/프론트엔드/i, /frontend/i, /front-end/i], priority: 5 },
    '백엔드': { patterns: [/백엔드/i, /backend/i, /back-end/i], priority: 5 },
    'iOS': { patterns: [/\bios\b/i, /\bswift\b/i], priority: 5 },
    'Android': { patterns: [/android/i, /안드로이드/i], priority: 5 },
    'DevOps': { patterns: [/devops/i, /sre\b/i, /인프라/i], priority: 5 },
    'UX디자인': { patterns: [/ux\s*디자인/i, /ux\s*designer/i], priority: 6 },
    'UI디자인': { patterns: [/ui\s*디자인/i, /ui\s*designer/i], priority: 6 },
    '데이터분석': { patterns: [/데이터\s*분석/i, /data\s*analyst/i], priority: 6 },
    'ML엔지니어': { patterns: [/ml\s*엔지니어/i, /머신러닝/i, /machine\s*learning/i], priority: 6 },
  };
  
  for (const [role, config] of Object.entries(roleKeywords)) {
    if (roles.includes(role)) continue;
    
    // PM/PO면 개발 직무 스킵
    if (isPMPO && config.priority <= 5) continue;
    
    for (const pattern of config.patterns) {
      if (pattern.test(lower)) {
        roles.push(role);
        break;
      }
    }
  }
  
  console.log('추출된 직무:', roles);
  return roles;
}

// 스킬 추출
function extractSkills(resumeText: string): string[] {
  const skillKeywords = [
    // 프로그래밍 언어
    'java', 'python', 'javascript', 'typescript', 'kotlin', 'swift', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'scala',
    // 프레임워크
    'react', 'vue', 'angular', 'next.js', 'nuxt', 'spring', 'django', 'flask', 'fastapi', 'express', 'nestjs', 'rails',
    // 모바일
    'ios', 'android', 'flutter', 'react native', 'swiftui', 'uikit', 'jetpack compose',
    // 데이터/ML
    'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'spark', 'hadoop', 'airflow', 'kafka',
    // 인프라
    'aws', 'gcp', 'azure', 'kubernetes', 'docker', 'terraform', 'jenkins', 'github actions',
    // DB
    'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    // 기타
    'git', 'jira', 'figma', 'sketch', 'sql', 'graphql', 'rest api', 'grpc',
  ];
  
  const lower = resumeText.toLowerCase();
  const skills: string[] = [];
  
  for (const skill of skillKeywords) {
    if (lower.includes(skill) && !skills.includes(skill)) {
      skills.push(skill);
    }
  }
  
  return skills;
}

// 회사 경력 추출
function extractCompanyHistory(resumeText: string): CompanyHistory[] {
  const companies: CompanyHistory[] = [];
  
  // 회사명 패턴 찾기
  for (const [tier, names] of Object.entries(COMPANY_TIERS)) {
    for (const name of names) {
      if (resumeText.toLowerCase().includes(name.toLowerCase())) {
        companies.push({
          name: name,
          tier: tier as 'big' | 'unicorn' | 'startup',
        });
      }
    }
  }
  
  return companies;
}

// 학력 추출
function extractEducation(resumeText: string): EducationInfo | null {
  const lower = resumeText.toLowerCase();
  
  // 학위 레벨 추출
  let level: EducationInfo['level'] = 'bachelor';
  if (/박사|ph\.?d/i.test(resumeText)) level = 'phd';
  else if (/석사|master|mba/i.test(resumeText)) level = 'master';
  else if (/학사|bachelor|대학교|대학/i.test(resumeText)) level = 'bachelor';
  else if (/전문대|2년제/i.test(resumeText)) level = 'college';
  else if (/고등학교|고졸/i.test(resumeText)) level = 'high';
  
  // 대학 티어 추출
  let tier: EducationInfo['tier'] = 'normal';
  for (const [t, schools] of Object.entries(UNIVERSITY_TIERS)) {
    for (const school of schools) {
      if (lower.includes(school.toLowerCase())) {
        tier = t as 'top' | 'good';
        return { level, tier, school };
      }
    }
  }
  
  // 전공 추출
  const majorPatterns = [
    /컴퓨터\s*공학/i, /소프트웨어/i, /전산/i, /정보통신/i,
    /경영/i, /경제/i, /산업공학/i, /디자인/i, /통계/i, /수학/i, /물리/i,
  ];
  
  let major: string | undefined;
  for (const pattern of majorPatterns) {
    if (pattern.test(resumeText)) {
      major = resumeText.match(pattern)?.[0];
      break;
    }
  }
  
  return { level, tier, major };
}

// 도메인 경험 추출
function extractDomains(resumeText: string): string[] {
  const domainKeywords: { [key: string]: string[] } = {
    '핀테크': ['핀테크', 'fintech', '금융', '뱅킹', '결제', '페이', '증권', '보험'],
    '커머스': ['커머스', 'commerce', '이커머스', 'e-commerce', '쇼핑', '리테일'],
    '모빌리티': ['모빌리티', '자동차', '배달', '물류', '택시'],
    '헬스케어': ['헬스케어', '의료', '병원', '건강'],
    '에듀테크': ['에듀테크', '교육', '학습', '이러닝'],
    '게임': ['게임', 'game', '엔터테인먼트'],
    'B2B': ['b2b', 'saas', '엔터프라이즈', 'enterprise'],
    '소셜': ['소셜', 'social', 'sns', '커뮤니티'],
  };
  
  const lower = resumeText.toLowerCase();
  const domains: string[] = [];
  
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        if (!domains.includes(domain)) domains.push(domain);
        break;
      }
    }
  }
  
  return domains;
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

// 근무지 필터링 - 공고의 region 필드 기반 매칭
function matchesLocation(job: JobPosting, preferredLocations: string[]): boolean {
  if (!preferredLocations || preferredLocations.length === 0) return true;
  
  // 공고에 region 필드가 있으면 사용, 없으면 location에서 추론
  const jobRegion = (job as JobPosting & { region?: string }).region || normalizeLocationToRegion(job.location);
  
  // 원격근무 선택 시
  if (preferredLocations.includes('원격')) {
    const isRemote = /원격|리모트|remote|재택|wfh|work from home/i.test(job.location);
    if (isRemote) return true;
  }
  
  // 지역 매칭
  for (const preferred of preferredLocations) {
    if (preferred === '원격') continue; // 위에서 처리
    if (jobRegion === preferred) return true;
    
    // 서울/경기 확장 매칭
    if (preferred === '서울' && jobRegion === '서울') return true;
    if (preferred === '경기' && (jobRegion === '경기' || jobRegion === '판교' || jobRegion === '분당')) return true;
  }
  
  return false;
}

// location 문자열에서 region 추론
function normalizeLocationToRegion(location: string): string {
  const lower = location.toLowerCase();
  
  const regionPatterns: { [key: string]: RegExp } = {
    '서울': /서울|seoul|강남|강북|강서|강동|마포|영등포|송파|서초|종로|중구|용산|성동|광진|동대문|중랑|성북|도봉|노원|은평|서대문|양천|구로|금천|동작|관악/i,
    '경기': /경기|성남|분당|판교|수원|용인|안양|부천|광명|평택|시흥|안산|고양|의왕|군포|하남|파주|이천|화성|김포|동탄/i,
    '인천': /인천|송도|청라/i,
    '부산': /부산|busan|해운대|서면/i,
    '대구': /대구|daegu/i,
    '대전': /대전|daejeon|유성/i,
    '광주': /광주|gwangju/i,
    '세종': /세종/i,
    '울산': /울산/i,
    '강원': /강원|춘천|원주|강릉/i,
    '충북': /충북|충청북|청주|충주/i,
    '충남': /충남|충청남|천안|아산/i,
    '전북': /전북|전라북|전주|익산/i,
    '전남': /전남|전라남|여수|순천|목포/i,
    '경북': /경북|경상북|포항|경주|구미/i,
    '경남': /경남|경상남|창원|김해|양산/i,
    '제주': /제주/i,
    '원격': /원격|리모트|remote|재택|wfh|work from home/i,
  };
  
  for (const [region, pattern] of Object.entries(regionPatterns)) {
    if (pattern.test(lower)) {
      return region;
    }
  }
  
  return '서울'; // 기본값
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

// 다차원 매칭 점수 계산
interface MultiDimensionalScore {
  total: number;
  breakdown: {
    jobCategory: { score: number; reason: string };
    jobRole: { score: number; reason: string };
    experience: { score: number; reason: string };
    company: { score: number; reason: string };
    education: { score: number; reason: string };
    skills: { score: number; reason: string };
  };
}

function calculateMultiDimensionalScore(
  profile: CandidateProfile,
  job: JobPosting
): MultiDimensionalScore {
  const breakdown = {
    jobCategory: { score: 0, reason: '' },
    jobRole: { score: 0, reason: '' },
    experience: { score: 0, reason: '' },
    company: { score: 0, reason: '' },
    education: { score: 0, reason: '' },
    skills: { score: 0, reason: '' },
  };
  
  // 1. 직군 매칭 (25점 만점)
  const jobCategory = (job as JobPosting & { jobCategory?: string }).jobCategory || '기타';
  if (profile.jobCategory === jobCategory) {
    breakdown.jobCategory = { score: 25, reason: `${profile.jobCategory} 직군 완벽 매칭` };
  } else if (profile.jobCategory !== '기타' && jobCategory !== '기타') {
    // 관련 직군 매칭 (개발-데이터, 기획-마케팅 등)
    const relatedCategories: Record<string, string[]> = {
      '개발': ['데이터'],
      '데이터': ['개발'],
      '기획': ['마케팅', '디자인'],
      '마케팅': ['기획'],
      '디자인': ['기획'],
    };
    if (relatedCategories[profile.jobCategory]?.includes(jobCategory)) {
      breakdown.jobCategory = { score: 15, reason: `${profile.jobCategory}와 ${jobCategory}은 연관 직군` };
    } else {
      // 직군 불일치 - 더 강한 감점 (기획자에게 개발 추천 방지)
      breakdown.jobCategory = { score: 0, reason: `직군 불일치 (${profile.jobCategory} ≠ ${jobCategory})` };
    }
  } else {
    breakdown.jobCategory = { score: 10, reason: '직군 정보 불명확' };
  }
  
  // 2. 직무 매칭 (25점 만점)
  const jobRole = (job as JobPosting & { jobRole?: string }).jobRole || '기타';
  
  // PM/PO와 개발 직무 간 매칭 체크
  const isPMPOCandidate = profile.jobRoles.some(r => ['PM', 'PO', '서비스기획'].includes(r));
  const isDevJob = ['프론트엔드', '백엔드', 'iOS', 'Android', 'DevOps', 'QA', '풀스택'].includes(jobRole);
  const isPMPOJob = ['PM', 'PO', '서비스기획'].includes(jobRole);
  const isDevCandidate = profile.jobRoles.some(r => ['프론트엔드', '백엔드', 'iOS', 'Android', 'DevOps'].includes(r));
  
  // PM/PO 후보자에게 개발 공고 추천 방지
  if (isPMPOCandidate && isDevJob) {
    breakdown.jobRole = { score: 0, reason: `직무 불일치 (${profile.jobRoles[0]} → ${jobRole} 개발직)` };
  } 
  // 개발자에게 PM/PO 공고 추천 방지
  else if (isDevCandidate && !isPMPOCandidate && isPMPOJob) {
    breakdown.jobRole = { score: 0, reason: `직무 불일치 (${profile.jobRoles[0]} 개발 → ${jobRole} 기획)` };
  }
  // 정상 매칭 체크
  else {
    const roleMatched = profile.jobRoles.some(r => 
      r.toLowerCase() === jobRole.toLowerCase() || 
      jobRole.toLowerCase().includes(r.toLowerCase()) ||
      r.toLowerCase().includes(jobRole.toLowerCase())
    );
    
    if (roleMatched) {
      breakdown.jobRole = { score: 25, reason: `${jobRole} 직무 경험 보유` };
    } else if (profile.jobRoles.length > 0) {
      // 관련 직무 체크
      const relatedRoles: Record<string, string[]> = {
        '프론트엔드': ['풀스택', 'UI디자인'],
        '백엔드': ['풀스택', 'DevOps'],
        '풀스택': ['프론트엔드', '백엔드'],
        'PM': ['PO', '서비스기획'],
        'PO': ['PM', '서비스기획'],
        '서비스기획': ['PM', 'PO'],
        'UX디자인': ['UI디자인', '프론트엔드'],
        'UI디자인': ['UX디자인'],
        '데이터분석': ['ML엔지니어', '데이터엔지니어'],
        'ML엔지니어': ['데이터분석', '데이터엔지니어'],
      };
      
      const hasRelated = profile.jobRoles.some(r => 
        relatedRoles[r]?.includes(jobRole) || relatedRoles[jobRole]?.includes(r)
      );
      
      if (hasRelated) {
        breakdown.jobRole = { score: 15, reason: `관련 직무 경험 (${profile.jobRoles[0]} → ${jobRole})` };
      } else {
        breakdown.jobRole = { score: 3, reason: `직무 전환 필요 (${profile.jobRoles[0] || '미상'} → ${jobRole})` };
      }
    } else {
      breakdown.jobRole = { score: 10, reason: '직무 정보 불명확' };
    }
  }
  
  // 3. 경력 매칭 (20점 만점)
  const reqYears = (job as JobPosting & { requiredYears?: { min: number; max: number } }).requiredYears 
    || extractRequiredExperience(job);
  const expDiff = profile.experienceYears - reqYears.min;
  const effectiveMax = reqYears.max > 20 ? reqYears.min + 7 : reqYears.max;
  
  if (profile.experienceYears >= reqYears.min && profile.experienceYears <= effectiveMax) {
    breakdown.experience = { score: 20, reason: `요구 경력 ${reqYears.min}~${effectiveMax}년에 ${profile.experienceYears}년 경력 적합` };
  } else if (expDiff >= -1 && expDiff <= 2) {
    breakdown.experience = { score: 15, reason: `경력 범위에 근접 (${profile.experienceYears}년)` };
  } else if (expDiff < -1) {
    const gap = Math.abs(expDiff);
    breakdown.experience = { score: Math.max(5, 15 - gap * 3), reason: `요구 경력 대비 ${gap}년 부족` };
  } else {
    breakdown.experience = { score: 10, reason: `경력 과다 (요구 ${reqYears.min}~${effectiveMax}년 vs ${profile.experienceYears}년)` };
  }
  
  // 4. 회사 경력 매칭 (15점 만점)
  const hasBigCompany = profile.companies.some(c => c.tier === 'big');
  const hasUnicorn = profile.companies.some(c => c.tier === 'unicorn');
  
  if (hasBigCompany || hasUnicorn) {
    const companyNames = profile.companies.filter(c => c.tier === 'big' || c.tier === 'unicorn').map(c => c.name);
    breakdown.company = { 
      score: 15, 
      reason: `주요 기업 경력 보유 (${companyNames.slice(0, 2).join(', ')})`
    };
  } else if (profile.companies.length > 0) {
    breakdown.company = { score: 10, reason: '실무 경력 보유' };
  } else {
    breakdown.company = { score: 5, reason: '회사 경력 정보 부족' };
  }
  
  // 5. 학력 매칭 (10점 만점)
  if (profile.education) {
    if (profile.education.tier === 'top') {
      breakdown.education = { score: 10, reason: `명문대 출신 (${profile.education.school || ''})` };
    } else if (profile.education.tier === 'good') {
      breakdown.education = { score: 8, reason: `우수 대학 출신` };
    } else if (profile.education.level === 'master' || profile.education.level === 'phd') {
      breakdown.education = { score: 9, reason: `${profile.education.level === 'phd' ? '박사' : '석사'} 학위 보유` };
    } else if (profile.education.major && /컴퓨터|소프트웨어|전산|정보/i.test(profile.education.major)) {
      breakdown.education = { score: 7, reason: `관련 전공 (${profile.education.major})` };
    } else {
      breakdown.education = { score: 5, reason: '학력 정보 확인' };
    }
  } else {
    breakdown.education = { score: 5, reason: '학력 정보 불명확' };
  }
  
  // 6. 스킬 매칭 (5점 만점)
  const jobText = `${job.title} ${job.description} ${job.requirements} ${job.tags.join(' ')}`.toLowerCase();
  const matchedSkills = profile.skills.filter(skill => jobText.includes(skill.toLowerCase()));
  
  if (matchedSkills.length >= 5) {
    breakdown.skills = { score: 5, reason: `핵심 스킬 다수 보유 (${matchedSkills.slice(0, 3).join(', ')} 등)` };
  } else if (matchedSkills.length >= 3) {
    breakdown.skills = { score: 4, reason: `주요 스킬 보유 (${matchedSkills.join(', ')})` };
  } else if (matchedSkills.length >= 1) {
    breakdown.skills = { score: 3, reason: `일부 스킬 매칭 (${matchedSkills.join(', ')})` };
  } else {
    breakdown.skills = { score: 2, reason: '스킬 정보 확인 필요' };
  }
  
  const total = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
  
  return { total, breakdown };
}

// 상세 추천 이유 생성
function generateDetailedReasons(
  profile: CandidateProfile,
  job: JobPosting,
  multiScore: MultiDimensionalScore
): { experience: string; skills: string; fit: string } {
  // 점수 높은 순으로 정렬하여 상위 3개 선택
  const sortedBreakdown = Object.entries(multiScore.breakdown)
    .sort((a, b) => b[1].score - a[1].score);
  
  const topReasons = sortedBreakdown.slice(0, 3).map(([key, value]) => value.reason);
  
  return {
    experience: topReasons[0] || '경력 조건이 잘 맞아요',
    skills: topReasons[1] || '보유 스킬이 공고와 잘 맞아요',
    fit: topReasons[2] || '회원님의 경험을 살릴 수 있는 포지션이에요',
  };
}

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[],
  preferredLocations?: string[],
  currentSalary?: number | null
): Promise<MatchResult[]> {
  // 후보자 프로필 추출
  const candidateProfile = extractCandidateProfile(resumeText);
  console.log('추출된 후보자 프로필:', JSON.stringify(candidateProfile, null, 2));
  
  // 근무지 필터링 적용
  let filteredJobs = jobs;
  if (preferredLocations && preferredLocations.length > 0) {
    filteredJobs = jobs.filter(job => matchesLocation(job, preferredLocations));
    console.log(`근무지 필터 적용: ${jobs.length}개 → ${filteredJobs.length}개 (선택: ${preferredLocations.join(', ')})`);
    if (filteredJobs.length === 0) {
      filteredJobs = jobs; // 필터링 결과 없으면 전체 사용
    }
  }

  // 이력서 품질 분석
  const resumeQuality = calculateResumeQualityScore(resumeText);
  const candidateExperience = candidateProfile.experienceYears;

  // 다차원 매칭 점수로 1차 필터링 (상위 15개)
  const preScored = filteredJobs.map(job => {
    const multiScore = calculateMultiDimensionalScore(candidateProfile, job);
    const reqYears = (job as JobPosting & { requiredYears?: { min: number; max: number } }).requiredYears 
      || extractRequiredExperience(job);
    
    // 심각한 오버스펙 체크 (경력 차이 5년 이상이면 매칭 제외)
    const effectiveMax = reqYears.max > 20 ? reqYears.min + 7 : reqYears.max;
    const isOverqualified = candidateProfile.experienceYears > effectiveMax + 5;
    
    // 심각한 언더스펙 체크 (요구 경력 대비 5년 이상 부족하면 매칭 제외)
    const isUnderqualified = candidateProfile.experienceYears < reqYears.min - 3;
    
    return {
      job,
      multiScore,
      isExcluded: isOverqualified || isUnderqualified,
      exclusionReason: isOverqualified 
        ? `경력 과다 (${candidateProfile.experienceYears}년 vs 요구 ${reqYears.min}~${effectiveMax}년)`
        : isUnderqualified 
          ? `경력 부족 (${candidateProfile.experienceYears}년 vs 요구 ${reqYears.min}년+)`
          : null,
    };
  })
  .filter(item => !item.isExcluded) // 심각한 미스매치 제외
  .sort((a, b) => b.multiScore.total - a.multiScore.total);
  
  console.log(`경력 필터링 적용: ${filteredJobs.length}개 → ${preScored.length}개`);
  
  // 필터링 후 공고가 없으면 필터 완화
  let topJobs = preScored.slice(0, 15);
  if (topJobs.length === 0) {
    console.log('경력 필터 완화: 모든 공고 포함');
    topJobs = filteredJobs.map(job => ({
      job,
      multiScore: calculateMultiDimensionalScore(candidateProfile, job),
      isExcluded: false,
      exclusionReason: null,
    })).sort((a, b) => b.multiScore.total - a.multiScore.total).slice(0, 15);
  }
  
  const jobsContext = topJobs.map((item, index) => `
[공고 ${index + 1}]
ID: ${item.job.id}
제목: ${item.job.title}
회사: ${item.job.company}
위치: ${item.job.location}
설명: ${item.job.description}
요구사항: ${item.job.requirements}
태그: ${item.job.tags.join(', ')}
사전매칭점수: ${item.multiScore.total}/100
`).join('\n---\n');

  const prompt = `당신은 원티드 채용 매칭 전문가입니다. 아래 이력서와 채용 공고들을 분석하여 **서류 합격 가능성**이 높은 순서로 매칭 결과를 JSON 형식으로 반환해주세요.

## 이력서
${resumeText}

## 후보자 프로필 분석 결과
- 직군: ${candidateProfile.jobCategory}
- 직무: ${candidateProfile.jobRoles.join(', ') || '미상'}
- 경력 연차: ${candidateExperience}년
- 보유 스킬: ${candidateProfile.skills.slice(0, 10).join(', ') || '미상'}
- 주요 회사 경력: ${candidateProfile.companies.map(c => c.name).join(', ') || '미상'}
- 학력: ${candidateProfile.education ? `${candidateProfile.education.level} (${candidateProfile.education.tier || ''})` : '미상'}
- 도메인 경험: ${candidateProfile.domains.join(', ') || '미상'}

## 이력서 품질 분석 결과
- 정량적 성과 점수: ${resumeQuality.factors.quantitativeResults}/25
- 기술 스택 명시: ${resumeQuality.factors.techStack}/20
- 프로젝트 상세도: ${resumeQuality.factors.projectDetail}/20
- 역할 명확성: ${resumeQuality.factors.roleClarity}/20
- 핵심역량 요약: ${resumeQuality.factors.keyStrengths}/15

## 채용 공고 목록
${jobsContext}

## 원티드 합격 이력서 기준 (중요!)
서류 합격 가능성을 높이는 핵심 요소:
1. **직군/직무 일치**: 후보자의 직군/직무와 공고의 직군/직무가 일치하는지
2. **경력 수준 적합성**: 요구 경력과 후보자 경력의 일치도
3. **정량적 성과**: "매출 30% 증가", "MAU 10만 달성" 등 수치화된 성과
4. **회사 경력**: 유명 기업 또는 관련 도메인 경력 보유
5. **스킬 매칭**: 공고의 요구 스킬과 보유 스킬 일치도

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
      // topJobs에서 공고 찾기 (인덱스가 topJobs 기준)
      const jobItem = topJobs[match.jobIndex];
      if (!jobItem) return null;
      
      const job = jobItem.job;
      const multiScore = jobItem.multiScore;
      const reqExp = extractRequiredExperience(job);
      const expMatch = getExperienceMatch(candidateExperience, reqExp);
      
      // 다차원 점수 기반 보정
      let adjustedScore = match.score;
      
      // 다차원 매칭 점수 반영 (가중치 30%)
      adjustedScore = Math.round(adjustedScore * 0.7 + multiScore.total * 0.3);
      
      // 90점 초과 시 85~89로 제한
      if (adjustedScore > 90) {
        adjustedScore = 85 + Math.floor(Math.random() * 5);
      } else if (adjustedScore > 85) {
        adjustedScore -= Math.floor(Math.random() * 3);
      }
      
      // 경력 미스매치 페널티
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
      
      // 연봉 범위를 문자열로 변환 (salaryTable은 만원 단위)
      const salary = estimateSalaryRange(job, candidateExperience);
      
      // 훅 메시지 생성
      const hookMessages = [
        `${job.company}에서 당신을 기다리고 있어요`,
        `이 포지션, 딱 맞는 것 같아요`,
        `당신의 경험이 빛날 자리예요`,
        `지금 바로 지원해보세요`,
        `좋은 기회를 놓치지 마세요`,
      ];
      const hookMessage = hookMessages[Math.floor(Math.random() * hookMessages.length)];
      
      // 경력 경고 변환
      let experienceWarning = null;
      if (expMatch.status === 'underqualified') {
        experienceWarning = {
          type: 'significant' as const,
          message: expMatch.message,
        };
      } else if (expMatch.status === 'overqualified') {
        experienceWarning = {
          type: 'slight' as const,
          message: expMatch.message,
        };
      }
      
      // 매칭 이유 생성 - 다차원 점수 기반
      const detailedReasons = generateDetailedReasons(candidateProfile, job, multiScore);
      const matchReasons = {
        experience: detailedReasons.experience,
        skills: detailedReasons.skills,
        fit: detailedReasons.fit,
      };
      
      return {
        job,
        score: adjustedScore,
        topPercent: scoreToTopPercent(adjustedScore),
        summary: match.summary,
        keyMatches: match.keyMatches,
        experienceMatch: expMatch,
        estimatedSalary: salary,
        // 프론트엔드용 추가 필드 (salary는 만원 단위)
        salaryRange: `${salary.min}만 ~ ${salary.max}만원`,
        hookMessage,
        matchReasons,
        experienceWarning,
      };
    }).filter((r: MatchResult | null): r is MatchResult => r !== null);

    // score 기준 내림차순 정렬 후 상위 10개 반환
    return matchResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

  } catch (error) {
    console.error('Analysis error:', error);
    
    // API 호출 실패 시 다차원 점수 기반 폴백 결과 반환
    console.log('API 실패, 다차원 점수 기반 폴백 결과 생성');
    
    const fallbackResults: MatchResult[] = topJobs.slice(0, 10).map(item => {
      const job = item.job;
      const multiScore = item.multiScore;
      const reqExp = extractRequiredExperience(job);
      const expMatch = getExperienceMatch(candidateExperience, reqExp);
      const salary = estimateSalaryRange(job, candidateExperience);
      
      // 다차원 점수를 100점 만점 기준으로 변환
      const adjustedScore = Math.max(50, Math.min(89, Math.round(multiScore.total * 0.9)));
      
      const hookMessages = [
        `${job.company}에서 당신을 기다리고 있어요`,
        `이 포지션, 딱 맞는 것 같아요`,
        `당신의 경험이 빛날 자리예요`,
      ];
      const hookMessage = hookMessages[Math.floor(Math.random() * hookMessages.length)];
      
      let experienceWarning = null;
      if (expMatch.status === 'underqualified') {
        experienceWarning = { type: 'significant' as const, message: expMatch.message };
      } else if (expMatch.status === 'overqualified') {
        experienceWarning = { type: 'slight' as const, message: expMatch.message };
      }
      
      const detailedReasons = generateDetailedReasons(candidateProfile, job, multiScore);
      
      return {
        job,
        score: adjustedScore,
        topPercent: scoreToTopPercent(adjustedScore),
        summary: `${job.company}의 ${job.title} 포지션입니다.`,
        keyMatches: Object.values(multiScore.breakdown)
          .filter(b => b.score >= 15)
          .map(b => b.reason)
          .slice(0, 3),
        experienceMatch: expMatch,
        estimatedSalary: salary,
        salaryRange: `${salary.min}만 ~ ${salary.max}만원`,
        hookMessage,
        matchReasons: detailedReasons,
        experienceWarning,
      };
    });
    
    return fallbackResults.sort((a, b) => b.score - a.score);
  }
}
