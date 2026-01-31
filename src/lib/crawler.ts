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

// 원티드 API에서 실제 공고 가져오기
export async function crawlWantedJobs(keyword: string = '', limit: number = 50): Promise<JobPosting[]> {
  console.log('원티드 API 호출 시작...');
  
  const jobs: JobPosting[] = [];
  
  // 전체 직군별 tag_type_ids
  const categories = [
    { tagId: 507, category: '기획' },
    { tagId: 518, category: '개발' },
    { tagId: 523, category: '디자인' },
    { tagId: 527, category: '데이터' },
    { tagId: 526, category: '마케팅' },
  ];
  
  for (const cat of categories) {
    try {
      const response = await fetch(
        `https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=${cat.tagId}&job_sort=job.latest_order&locations=all&years=-1&limit=10`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.error(`API 호출 실패 (${cat.category}): ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const apiJobs = data.data || [];
      
      for (const job of apiJobs) {
        const title = job.position || '';
        const reqYears = parseExperience(title);
        const location = job.address?.full_location || '서울';
        
        jobs.push({
          id: String(job.id),
          title: title,
          company: job.company?.name || 'Unknown',
          location: location,
          address: location,
          region: normalizeRegion(location),
          description: title,
          requirements: `경력 ${reqYears.min}년 이상`,
          url: `https://www.wanted.co.kr/wd/${job.id}`,
          tags: [],
          jobCategory: cat.category,
          jobRole: extractJobRole(title, cat.category),
          experienceLevel: reqYears.min >= 7 ? '시니어' : reqYears.min >= 3 ? '미들' : '주니어',
          requiredYears: reqYears,
        });
      }
      
      console.log(`${cat.category}: ${apiJobs.length}개 로드`);
      
    } catch (e) {
      console.error(`API 호출 에러 (${cat.category}):`, e);
    }
  }
  
  if (jobs.length === 0) {
    throw new Error('NO_JOBS_FOUND');
  }
  
  console.log(`총 ${jobs.length}개 공고 로드 완료`);
  return jobs;
}

// 경력 파싱
function parseExperience(title: string): { min: number; max: number } {
  // 신입/인턴
  if (/신입|인턴|junior|주니어/i.test(title)) {
    return { min: 0, max: 2 };
  }
  
  // N년 이상
  const minMatch = title.match(/(\d+)년\s*이상/);
  if (minMatch) {
    const min = parseInt(minMatch[1]);
    return { min, max: min + 7 };
  }
  
  // N~M년, N-M년
  const rangeMatch = title.match(/(\d+)\s*[~\-]\s*(\d+)년/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  }
  
  // N년차
  const yearMatch = title.match(/(\d+)년/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    return { min: Math.max(0, year - 1), max: year + 2 };
  }
  
  // 시니어/리드/팀장
  if (/시니어|senior|리드|lead|팀장|head/i.test(title)) {
    return { min: 7, max: 15 };
  }
  
  // 기본값
  return { min: 0, max: 99 };
}

// 지역 정규화
function normalizeRegion(address: string): string {
  const lower = address.toLowerCase();
  
  if (/서울|seoul|강남|강북|강서|강동|마포|영등포|송파|서초|종로|용산|성동|광진/.test(lower)) return '서울';
  if (/경기|성남|분당|판교|수원|용인|안양|부천|고양|화성|김포|동탄/.test(lower)) return '경기';
  if (/인천|송도|청라/.test(lower)) return '인천';
  if (/부산|해운대/.test(lower)) return '부산';
  if (/대구/.test(lower)) return '대구';
  if (/대전|유성/.test(lower)) return '대전';
  if (/광주/.test(lower)) return '광주';
  if (/세종/.test(lower)) return '세종';
  if (/울산/.test(lower)) return '울산';
  if (/강원|춘천|원주/.test(lower)) return '강원';
  if (/충북|청주/.test(lower)) return '충북';
  if (/충남|천안/.test(lower)) return '충남';
  if (/전북|전주/.test(lower)) return '전북';
  if (/전남|여수/.test(lower)) return '전남';
  if (/경북|포항/.test(lower)) return '경북';
  if (/경남|창원/.test(lower)) return '경남';
  if (/제주/.test(lower)) return '제주';
  if (/원격|리모트|remote|재택/.test(lower)) return '원격';
  
  return '서울';
}

// 직무 추출
function extractJobRole(title: string, category: string): string {
  const lower = title.toLowerCase();
  
  if (category === '기획') {
    if (/\bpo\b|product\s*owner|프로덕트\s*오너/i.test(lower)) return 'PO';
    if (/\bpm\b|product\s*manager|프로덕트\s*매니저/i.test(lower)) return 'PM';
    if (/사업\s*기획|사업개발/i.test(lower)) return '사업기획';
    return '서비스기획';
  }
  
  if (category === '개발') {
    if (/프론트|frontend|front-end|react|vue|next/i.test(lower)) return '프론트엔드';
    if (/백엔드|backend|back-end|서버|java|spring|node/i.test(lower)) return '백엔드';
    if (/풀스택|fullstack|full-stack/i.test(lower)) return '풀스택';
    if (/ios|swift/i.test(lower)) return 'iOS';
    if (/android|안드로이드|kotlin/i.test(lower)) return 'Android';
    if (/devops|sre|인프라|mlops/i.test(lower)) return 'DevOps';
    if (/보안|security/i.test(lower)) return '보안';
    if (/qa|test|테스트/i.test(lower)) return 'QA';
    return '개발';
  }
  
  if (category === '디자인') {
    if (/ux/i.test(lower)) return 'UX디자인';
    if (/ui/i.test(lower)) return 'UI디자인';
    if (/그래픽|graphic|bi|브랜드/i.test(lower)) return '그래픽디자인';
    if (/영상|motion|모션/i.test(lower)) return '영상디자인';
    return '디자인';
  }
  
  if (category === '데이터') {
    if (/ml|머신러닝|딥러닝|ai\b/i.test(lower)) return 'ML엔지니어';
    if (/엔지니어|engineer/i.test(lower)) return '데이터엔지니어';
    return '데이터분석';
  }
  
  if (category === '마케팅') {
    if (/그로스|growth/i.test(lower)) return '그로스마케팅';
    if (/퍼포먼스|performance/i.test(lower)) return '퍼포먼스마케팅';
    if (/콘텐츠|content|콘텐트/i.test(lower)) return '콘텐츠마케팅';
    if (/브랜드|brand/i.test(lower)) return '브랜드마케팅';
    return '마케팅';
  }
  
  return '기타';
}
