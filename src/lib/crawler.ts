import * as cheerio from 'cheerio';

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;           // 원본 위치 텍스트
  address: string;            // 상세 주소
  region: string;             // 정규화된 지역 (서울, 경기, 부산 등)
  description: string;
  requirements: string;
  url: string;
  tags: string[];
  // 추가 메타데이터
  jobCategory: string;        // 직군 (개발, 기획, 디자인 등)
  jobRole: string;            // 직무 (프론트엔드, 백엔드, PM 등)
  experienceLevel: string;    // 경력 레벨 (신입, 주니어, 시니어 등)
  requiredYears: { min: number; max: number }; // 요구 경력
}

export async function crawlWantedJobs(keyword: string = '', limit: number = 50): Promise<JobPosting[]> {
  console.log('원티드 공고 크롤링 시작...');
  
  try {
    // 원티드 API로 실제 공고 가져오기
    const apiJobs = await fetchRealJobsFromAPI();
    
    if (apiJobs.length === 0) {
      throw new Error('NO_JOBS_FOUND');
    }
    
    console.log(`원티드 API에서 ${apiJobs.length}개 공고 로드 성공`);
    return apiJobs;
    
  } catch (error) {
    console.error('Crawling error:', error);
    throw new Error('CRAWLING_FAILED');
  }
}

// 지역 정규화 함수
function normalizeRegion(address: string): string {
  const regionMap: { [key: string]: string[] } = {
    '서울': ['서울', 'seoul', '강남', '강북', '강서', '강동', '마포', '영등포', '송파', '서초', '종로', '중구', '용산', '성동', '광진', '동대문', '중랑', '성북', '도봉', '노원', '은평', '서대문', '양천', '구로', '금천', '동작', '관악', '서남'],
    '경기': ['경기', '성남', '분당', '판교', '수원', '용인', '안양', '부천', '광명', '평택', '시흥', '안산', '고양', '의왕', '군포', '하남', '파주', '이천', '화성', '광주시', '김포', '동탄'],
    '인천': ['인천', '송도', '청라'],
    '부산': ['부산', 'busan'],
    '대구': ['대구', 'daegu'],
    '대전': ['대전', 'daejeon'],
    '광주': ['광주', 'gwangju'],
    '세종': ['세종'],
    '울산': ['울산'],
    '강원': ['강원', '춘천', '원주', '강릉'],
    '충북': ['충북', '충청북', '청주', '충주'],
    '충남': ['충남', '충청남', '천안', '아산'],
    '전북': ['전북', '전라북', '전주', '익산'],
    '전남': ['전남', '전라남', '여수', '순천', '목포'],
    '경북': ['경북', '경상북', '포항', '경주', '구미'],
    '경남': ['경남', '경상남', '창원', '김해', '양산'],
    '제주': ['제주'],
    '원격': ['원격', '리모트', 'remote', '재택', 'wfh', 'work from home'],
  };
  
  const lowerAddress = address.toLowerCase();
  
  for (const [region, keywords] of Object.entries(regionMap)) {
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword.toLowerCase())) {
        return region;
      }
    }
  }
  
  return '서울'; // 기본값
}

// 직군 추출 함수
function extractJobCategory(title: string, tags: string[]): string {
  const categoryMap: { [key: string]: string[] } = {
    '개발': ['개발', 'developer', 'engineer', '엔지니어', 'backend', 'frontend', 'fullstack', 'ios', 'android', 'devops', 'sre', 'qa', '프로그래머'],
    '기획': ['기획', 'pm', 'po', 'product', '프로덕트', '서비스기획', 'planner'],
    '디자인': ['디자인', 'design', 'ux', 'ui', 'uxui', 'graphic', '그래픽', 'visual'],
    '데이터': ['데이터', 'data', 'ml', 'ai', '머신러닝', '인공지능', 'analyst', '분석'],
    '마케팅': ['마케팅', 'marketing', '그로스', 'growth', '퍼포먼스', 'performance', 'crm'],
    '영업': ['영업', 'sales', 'bd', 'business development', '사업개발'],
    '인사': ['인사', 'hr', 'people', '채용', 'recruiter', 'talent'],
    '재무': ['재무', 'finance', '회계', 'accounting', 'cfo'],
    '운영': ['운영', 'operation', 'cs', '고객', 'support'],
  };
  
  const combined = `${title} ${tags.join(' ')}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return '기타';
}

// 직무 추출 함수
function extractJobRole(title: string, description: string): string {
  const roleMap: { [key: string]: string[] } = {
    '프론트엔드': ['프론트엔드', 'frontend', 'front-end', 'react', 'vue', 'angular', '웹개발'],
    '백엔드': ['백엔드', 'backend', 'back-end', 'server', '서버', 'api'],
    '풀스택': ['풀스택', 'fullstack', 'full-stack', 'full stack'],
    'iOS': ['ios', 'swift', 'objective-c', '아이폰'],
    'Android': ['android', '안드로이드', 'kotlin'],
    '앱개발': ['앱', 'app', 'mobile', '모바일'],
    'DevOps': ['devops', 'sre', 'infrastructure', '인프라', 'platform'],
    'QA': ['qa', 'quality', 'test', '테스트', '품질'],
    'DBA': ['dba', 'database', '데이터베이스'],
    '보안': ['보안', 'security', '시큐리티'],
    'PM': ['pm', 'product manager', '프로덕트 매니저', '프로덕트매니저'],
    'PO': ['po', 'product owner', '프로덕트 오너'],
    '서비스기획': ['서비스 기획', '서비스기획', 'service planner'],
    'UX디자인': ['ux', 'ux디자인', 'ux design', '사용자경험'],
    'UI디자인': ['ui', 'ui디자인', 'ui design', '인터페이스'],
    '그래픽디자인': ['그래픽', 'graphic', 'visual', '시각'],
    '데이터분석': ['데이터 분석', '데이터분석', 'data analyst', 'analyst'],
    '데이터엔지니어': ['데이터 엔지니어', '데이터엔지니어', 'data engineer'],
    'ML엔지니어': ['ml', 'machine learning', '머신러닝', 'ai', '인공지능'],
  };
  
  const combined = `${title} ${description}`.toLowerCase();
  
  for (const [role, keywords] of Object.entries(roleMap)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return role;
      }
    }
  }
  
  return '기타';
}

// 경력 레벨 추출 함수
function extractExperienceLevel(title: string, requirements: string): { level: string; years: { min: number; max: number } } {
  const combined = `${title} ${requirements}`.toLowerCase();
  
  // 신입/인턴
  if (/신입|인턴|junior|entry|졸업예정|0년/.test(combined)) {
    return { level: '신입', years: { min: 0, max: 2 } };
  }
  
  // 시니어/리드
  if (/시니어|senior|lead|리드|팀장|head|수석|책임/.test(combined)) {
    return { level: '시니어', years: { min: 7, max: 99 } };
  }
  
  // 경력 범위 추출
  const rangeMatch = combined.match(/(\d+)\s*[-~]\s*(\d+)\s*년/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    if (min >= 5) return { level: '시니어', years: { min, max } };
    if (min >= 3) return { level: '미들', years: { min, max } };
    return { level: '주니어', years: { min, max } };
  }
  
  // 최소 경력 추출
  const minMatch = combined.match(/(\d+)\s*년\s*이상/);
  if (minMatch) {
    const min = parseInt(minMatch[1]);
    if (min >= 7) return { level: '시니어', years: { min, max: 99 } };
    if (min >= 4) return { level: '미들', years: { min, max: min + 5 } };
    return { level: '주니어', years: { min, max: min + 3 } };
  }
  
  return { level: '경력무관', years: { min: 0, max: 99 } };
}

async function crawlJobDetail(jobId: string): Promise<JobPosting | null> {
  try {
    const url = `https://www.wanted.co.kr/wd/${jobId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // 메타 태그와 본문에서 정보 추출
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Unknown Position';
    
    const description = $('meta[property="og:description"]').attr('content') || '';
    
    // 회사명 추출
    const company = $('a[href*="/company/"]').first().text().trim() ||
                    title.split(' - ')[1] || 
                    'Unknown Company';
    
    // 본문 텍스트 추출
    const bodyText = $('section').text() || $('main').text() || '';
    
    // 태그 추출
    const tags: string[] = [];
    $('a[href*="/tag/"]').each((_, el) => {
      const tag = $(el).text().trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    // 주소 추출 시도 (여러 셀렉터 시도)
    let address = '';
    const addressSelectors = [
      'span:contains("위치")',
      'div:contains("근무지")',
      '[class*="location"]',
      '[class*="address"]',
    ];
    
    for (const selector of addressSelectors) {
      const found = $(selector).parent().text();
      if (found && found.length > 5 && found.length < 200) {
        address = found;
        break;
      }
    }
    
    // 본문에서 주소 패턴 찾기
    if (!address) {
      const addressPattern = bodyText.match(/(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{5,50}/);
      if (addressPattern) {
        address = addressPattern[0];
      }
    }
    
    const region = normalizeRegion(address || bodyText);
    const jobCategory = extractJobCategory(title, tags);
    const jobRole = extractJobRole(title, bodyText);
    const expInfo = extractExperienceLevel(title, bodyText);

    return {
      id: jobId,
      title: title.split(' | ')[0].trim(),
      company: company.replace(/[^가-힣a-zA-Z0-9\s]/g, '').trim(),
      location: address || region,
      address: address,
      region: region,
      description: description,
      requirements: bodyText.slice(0, 2000),
      url: url,
      tags: tags.slice(0, 5),
      jobCategory: jobCategory,
      jobRole: jobRole,
      experienceLevel: expInfo.level,
      requiredYears: expInfo.years,
    };
  } catch (error) {
    console.error(`Error crawling job ${jobId}:`, error);
    return null;
  }
}

// 원티드 API에서 실제 공고 가져오기 (전체 직군)
async function fetchRealJobsFromAPI(): Promise<JobPosting[]> {
  const jobs: JobPosting[] = [];
  
  // 전체 직군별 tag_type_ids
  const categories = [
    { tagId: 507, category: '기획', roles: ['PM', 'PO', '서비스기획'] },
    { tagId: 518, category: '개발', roles: ['백엔드', '프론트엔드', '풀스택'] },
    { tagId: 523, category: '디자인', roles: ['UX디자인', 'UI디자인'] },
    { tagId: 527, category: '데이터', roles: ['데이터분석', 'ML엔지니어'] },
    { tagId: 526, category: '마케팅', roles: ['마케팅'] },
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
      
      if (response.ok) {
        const data = await response.json();
        const apiJobs = data.data || [];
        
        for (const job of apiJobs.slice(0, 5)) {
          // 경력 요구사항 파싱
          const expText = job.position || '';
          let reqYears = { min: 0, max: 99 };
          
          const expMatch = expText.match(/(\d+)년\s*(이상|~|-)?\s*(\d+)?년?/);
          if (expMatch) {
            reqYears.min = parseInt(expMatch[1]) || 0;
            reqYears.max = expMatch[3] ? parseInt(expMatch[3]) : reqYears.min + 5;
          }
          
          // 신입/주니어 체크
          if (/신입|인턴|junior/i.test(expText)) {
            reqYears = { min: 0, max: 2 };
          }
          // 시니어 체크
          if (/시니어|senior|팀장|리드|head/i.test(expText)) {
            reqYears.min = Math.max(reqYears.min, 7);
          }
          
          const location = job.address?.full_location || '서울';
          
          jobs.push({
            id: String(job.id),
            title: job.position || 'Unknown',
            company: job.company?.name || 'Unknown',
            location: location,
            address: location,
            region: normalizeRegion(location),
            description: job.position || '',
            requirements: `경력 ${reqYears.min}년 이상`,
            url: `https://www.wanted.co.kr/wd/${job.id}`,
            tags: [],
            jobCategory: cat.category,
            jobRole: extractJobRoleFromAPI(job.position || '', cat.category),
            experienceLevel: reqYears.min >= 7 ? '시니어' : reqYears.min >= 3 ? '미들' : '주니어',
            requiredYears: reqYears,
          });
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${cat.category} jobs:`, e);
    }
  }
  
  return jobs;
}

// 직무 추출 헬퍼 (API 결과용)
function extractJobRoleFromAPI(title: string, category: string): string {
  const lower = title.toLowerCase();
  
  if (category === '기획') {
    if (/\bpo\b|product\s*owner|프로덕트\s*오너/i.test(lower)) return 'PO';
    if (/\bpm\b|product\s*manager|프로덕트\s*매니저/i.test(lower)) return 'PM';
    return '서비스기획';
  }
  
  if (category === '개발') {
    if (/프론트|frontend|front-end|react|vue/i.test(lower)) return '프론트엔드';
    if (/백엔드|backend|back-end|서버|java|python|node/i.test(lower)) return '백엔드';
    if (/풀스택|fullstack|full-stack/i.test(lower)) return '풀스택';
    if (/ios|swift/i.test(lower)) return 'iOS';
    if (/android|안드로이드|kotlin/i.test(lower)) return 'Android';
    if (/devops|sre|인프라/i.test(lower)) return 'DevOps';
    if (/ml|ai|머신러닝|데이터/i.test(lower)) return 'ML엔지니어';
    return '백엔드';
  }
  
  if (category === '디자인') {
    if (/ux/i.test(lower)) return 'UX디자인';
    if (/ui/i.test(lower)) return 'UI디자인';
    if (/그래픽|graphic/i.test(lower)) return '그래픽디자인';
    return 'UX디자인';
  }
  
  if (category === '데이터') {
    if (/ml|머신러닝|딥러닝|ai/i.test(lower)) return 'ML엔지니어';
    if (/엔지니어|engineer/i.test(lower)) return '데이터엔지니어';
    return '데이터분석';
  }
  
  if (category === '마케팅') {
    if (/그로스|growth/i.test(lower)) return '그로스마케팅';
    if (/퍼포먼스|performance/i.test(lower)) return '퍼포먼스마케팅';
    if (/콘텐츠|content/i.test(lower)) return '콘텐츠마케팅';
    return '마케팅';
  }
  
  return '기타';
}

// 폴백용 최소 샘플 데이터 (API 실패 시에만 사용)
