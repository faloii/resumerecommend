import { JobPosting, JOB_CATEGORY_MAP } from './types';

// 원티드 API에서 채용 공고 가져오기
export async function crawlWantedJobs(limit: number = 50): Promise<JobPosting[]> {
  console.log('원티드 API 호출...');
  
  const response = await fetch(
    `https://www.wanted.co.kr/api/v4/jobs?country=kr&job_sort=job.latest_order&years=-1&limit=${limit}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // 5분 캐싱
    }
  );
  
  if (!response.ok) {
    throw new Error('API_CALL_FAILED');
  }
  
  const data = await response.json();
  const apiJobs = data.data || [];
  
  if (apiJobs.length === 0) {
    throw new Error('NO_JOBS_FOUND');
  }
  
  const jobs = apiJobs.map((job: any) => {
    const title = job.position || '';
    const reqYears = parseExperience(title);
    const location = job.address?.full_location || '서울';
    const parentId = job.category_tags?.[0]?.parent_id;
    const category = getCategory(parentId, title);
    
    return {
      id: String(job.id),
      title,
      company: job.company?.name || 'Unknown',
      location,
      address: location,
      region: normalizeRegion(location),
      description: title,
      requirements: `경력 ${reqYears.min}년 이상`,
      url: `https://www.wanted.co.kr/wd/${job.id}`,
      tags: [],
      jobCategory: category,
      jobRole: extractJobRole(title, category),
      experienceLevel: reqYears.min >= 7 ? '시니어' : reqYears.min >= 3 ? '미들' : '주니어',
      requiredYears: reqYears,
    };
  });
  
  console.log(`${jobs.length}개 공고 로드`);
  return jobs;
}

// 경력 파싱
function parseExperience(title: string): { min: number; max: number } {
  if (/신입|인턴|junior|주니어/i.test(title)) return { min: 0, max: 2 };
  
  const minMatch = title.match(/(\d+)년\s*이상/);
  if (minMatch) return { min: parseInt(minMatch[1]), max: parseInt(minMatch[1]) + 7 };
  
  const rangeMatch = title.match(/(\d+)\s*[~\-]\s*(\d+)년/);
  if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  
  if (/시니어|senior|리드|lead|팀장|head/i.test(title)) return { min: 7, max: 15 };
  
  return { min: 0, max: 99 };
}

// 직군 분류
function getCategory(parentId: number | undefined, title: string): string {
  if (parentId && JOB_CATEGORY_MAP[parentId]) {
    return JOB_CATEGORY_MAP[parentId];
  }
  
  const t = title.toLowerCase();
  if (/개발|developer|engineer|프론트|백엔드|ios|android/i.test(t)) return '개발';
  if (/기획|pm|po|product|플래너/i.test(t)) return '기획';
  if (/디자인|designer|ux|ui/i.test(t)) return '디자인';
  if (/데이터|data|ml|ai|분석/i.test(t)) return '데이터';
  if (/마케팅|marketing|그로스/i.test(t)) return '마케팅';
  if (/영업|sales|세일즈/i.test(t)) return '영업';
  if (/인사|hr|채용/i.test(t)) return 'HR';
  
  return '기타';
}

// 지역 정규화
function normalizeRegion(addr: string): string {
  const a = addr.toLowerCase();
  if (/서울|강남|강북|송파|서초|마포|영등포/.test(a)) return '서울';
  if (/경기|성남|분당|판교|수원|용인/.test(a)) return '경기';
  if (/인천|송도/.test(a)) return '인천';
  if (/부산/.test(a)) return '부산';
  if (/대구/.test(a)) return '대구';
  if (/대전/.test(a)) return '대전';
  if (/광주/.test(a)) return '광주';
  if (/원격|리모트|remote|재택/.test(a)) return '원격';
  return '서울';
}

// 직무 추출
function extractJobRole(title: string, category: string): string {
  const t = title.toLowerCase();
  
  const roleMap: Record<string, Record<string, RegExp>> = {
    '기획': { 'PO': /\bpo\b|product\s*owner/i, 'PM': /\bpm\b|product\s*manager/i, '사업기획': /사업|bd\b/i },
    '개발': { '프론트엔드': /프론트|frontend|react|vue/i, '백엔드': /백엔드|backend|서버|java|spring/i, 'iOS': /ios|swift/i, 'Android': /android|kotlin/i, 'DevOps': /devops|sre|인프라|mlops/i },
    '디자인': { 'UX디자인': /ux/i, 'UI디자인': /ui/i, '그래픽디자인': /그래픽|brand/i },
    '데이터': { 'ML엔지니어': /ml|머신러닝|ai\b/i, '데이터엔지니어': /엔지니어/i },
    '마케팅': { '그로스마케팅': /그로스|growth/i, '퍼포먼스마케팅': /퍼포먼스/i, '콘텐츠마케팅': /콘텐츠/i },
  };
  
  const roles = roleMap[category];
  if (roles) {
    for (const [role, regex] of Object.entries(roles)) {
      if (regex.test(t)) return role;
    }
  }
  
  return category || '기타';
}

export type { JobPosting };
