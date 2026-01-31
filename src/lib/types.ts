// 공통 타입 정의

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  address: string;
  region: string;
  description: string;
  requirements: string;
  url: string;
  tags: string[];
  jobCategory: string;
  jobRole: string;
  experienceLevel: string;
  requiredYears: { min: number; max: number };
}

export interface CandidateProfile {
  experienceYears: number;
  jobCategory: string;
  jobRoles: string[];
  skills: string[];
  companies: CompanyHistory[];
  education: EducationInfo | null;
  domains: string[];
}

export interface CompanyHistory {
  name: string;
  tier: 'big' | 'unicorn' | 'startup' | 'mid' | 'unknown';
  duration?: number;
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

// 직군 매핑 (parent_id → 직군명)
export const JOB_CATEGORY_MAP: Record<number, string> = {
  507: '기획',
  518: '개발',
  523: '디자인',
  527: '데이터',
  526: '마케팅',
  530: '영업',
  510: 'HR',
  525: '미디어',
  524: '고객서비스',
  896: '금융',
  10057: '게임',
};

// 유명 회사 티어
export const COMPANY_TIERS: Record<string, string[]> = {
  big: ['삼성', '네이버', '카카오', 'lg', 'sk', '현대', 'kt', '구글', 'google', '아마존', 'amazon', '마이크로소프트', 'microsoft', '애플', 'apple', '메타', 'meta'],
  unicorn: ['토스', '쿠팡', '배달의민족', '당근마켓', '야놀자', '직방', '우아한형제들', '무신사', '라인', '하이퍼커넥트', '크래프톤', '넥슨', '원티드'],
};

// 대학 티어
export const UNIVERSITY_TIERS: Record<string, string[]> = {
  top: ['서울대', '카이스트', 'kaist', '포항공대', '연세대', '고려대', '서강대', '성균관대', '한양대'],
  good: ['중앙대', '경희대', '한국외대', '서울시립대', '건국대', '동국대', '홍익대', '이화여대', '부산대', '경북대'],
};
