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
  const jobs: JobPosting[] = [];
  
  try {
    // 원티드 채용 공고 목록 페이지 크롤링
    const searchUrl = keyword 
      ? `https://www.wanted.co.kr/search?query=${encodeURIComponent(keyword)}&tab=position`
      : `https://www.wanted.co.kr/wdlist/518?country=kr&job_sort=job.latest_order&years=-1&locations=all`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch wanted jobs list');
      return getSampleJobs();
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 공고 카드에서 ID 추출
    const jobIds: string[] = [];
    $('a[href*="/wd/"]').each((_, el) => {
      const href = $(el).attr('href');
      const match = href?.match(/\/wd\/(\d+)/);
      if (match && match[1] && !jobIds.includes(match[1])) {
        jobIds.push(match[1]);
      }
    });

    // 각 공고 상세 페이지 크롤링 (최대 limit개)
    const limitedIds = jobIds.slice(0, Math.min(limit, jobIds.length));
    
    for (const jobId of limitedIds) {
      try {
        const job = await crawlJobDetail(jobId);
        if (job) {
          jobs.push(job);
        }
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to crawl job ${jobId}:`, error);
      }
    }

    // 크롤링 결과가 부족하면 샘플 데이터로 보충
    if (jobs.length < 10) {
      const sampleJobs = getSampleJobs();
      return [...jobs, ...sampleJobs.slice(0, 10 - jobs.length)];
    }

    return jobs;
  } catch (error) {
    console.error('Crawling error:', error);
    return getSampleJobs();
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

// 크롤링 실패 시 사용할 샘플 데이터
function getSampleJobs(): JobPosting[] {
  return [
    {
      id: 'sample-1',
      title: '시니어 프로덕트 매니저',
      company: '토스',
      location: '서울시 강남구 테헤란로',
      address: '서울시 강남구 테헤란로 142',
      region: '서울',
      description: '토스 앱의 핵심 금융 서비스를 기획하고 성장시킬 PM을 찾습니다.',
      requirements: '5년 이상의 PM 경험, 데이터 기반 의사결정 능력, 금융/핀테크 도메인 이해',
      url: 'https://www.wanted.co.kr/wd/123456',
      tags: ['PM', '핀테크', '데이터분석'],
      jobCategory: '기획',
      jobRole: 'PM',
      experienceLevel: '시니어',
      requiredYears: { min: 5, max: 10 },
    },
    {
      id: 'sample-2',
      title: '백엔드 개발자 (Java/Kotlin)',
      company: '카카오',
      location: '경기도 성남시 분당구 판교역로',
      address: '경기도 성남시 분당구 판교역로 166',
      region: '경기',
      description: '카카오톡 플랫폼의 대규모 트래픽을 처리하는 백엔드 시스템 개발',
      requirements: 'Java/Kotlin 숙련, 대용량 트래픽 처리 경험, MSA 아키텍처 이해. 경력 3년 이상',
      url: 'https://www.wanted.co.kr/wd/234567',
      tags: ['Java', 'Kotlin', 'MSA'],
      jobCategory: '개발',
      jobRole: '백엔드',
      experienceLevel: '미들',
      requiredYears: { min: 3, max: 7 },
    },
    {
      id: 'sample-3',
      title: '프론트엔드 개발자',
      company: '네이버',
      location: '경기도 성남시 분당구',
      address: '경기도 성남시 분당구 정자일로 95',
      region: '경기',
      description: '네이버 메인 서비스의 사용자 경험을 개선하는 프론트엔드 개발',
      requirements: 'React/Vue 경험, TypeScript 숙련, 웹 성능 최적화 경험. 경력 2~5년',
      url: 'https://www.wanted.co.kr/wd/345678',
      tags: ['React', 'TypeScript', '프론트엔드'],
      jobCategory: '개발',
      jobRole: '프론트엔드',
      experienceLevel: '주니어',
      requiredYears: { min: 2, max: 5 },
    },
    {
      id: 'sample-4',
      title: '데이터 사이언티스트',
      company: '쿠팡',
      location: '서울시 송파구',
      address: '서울시 송파구 송파대로 570',
      region: '서울',
      description: '추천 시스템 및 개인화 알고리즘 개발',
      requirements: 'Python, ML/DL 프레임워크, 추천 시스템 경험. 경력 3년 이상',
      url: 'https://www.wanted.co.kr/wd/456789',
      tags: ['ML', 'Python', '추천시스템'],
      jobCategory: '데이터',
      jobRole: 'ML엔지니어',
      experienceLevel: '미들',
      requiredYears: { min: 3, max: 8 },
    },
    {
      id: 'sample-5',
      title: 'UX 디자이너',
      company: '배달의민족',
      location: '서울시 송파구',
      address: '서울시 송파구 위례성대로 2',
      region: '서울',
      description: '배민 앱의 사용자 경험을 설계하고 개선',
      requirements: 'Figma 숙련, 사용자 리서치 경험, 프로토타이핑 능력. 경력 3~7년',
      url: 'https://www.wanted.co.kr/wd/567890',
      tags: ['UX', 'Figma', '사용자리서치'],
      jobCategory: '디자인',
      jobRole: 'UX디자인',
      experienceLevel: '미들',
      requiredYears: { min: 3, max: 7 },
    },
    {
      id: 'sample-6',
      title: '마케팅 매니저',
      company: '당근마켓',
      location: '서울시 서초구',
      address: '서울시 서초구 강남대로 465',
      region: '서울',
      description: '그로스 마케팅 및 퍼포먼스 마케팅 전략 수립/실행',
      requirements: 'GA/Amplitude 활용 경험, 퍼포먼스 마케팅 3년 이상',
      url: 'https://www.wanted.co.kr/wd/678901',
      tags: ['마케팅', '그로스', '퍼포먼스'],
      jobCategory: '마케팅',
      jobRole: '마케팅',
      experienceLevel: '미들',
      requiredYears: { min: 3, max: 7 },
    },
    {
      id: 'sample-7',
      title: 'DevOps 엔지니어',
      company: '라인',
      location: '경기도 성남시 분당구',
      address: '경기도 성남시 분당구 정자일로 95',
      region: '경기',
      description: 'CI/CD 파이프라인 구축 및 인프라 자동화',
      requirements: 'Kubernetes, Docker, AWS/GCP, Terraform. 경력 4년 이상',
      url: 'https://www.wanted.co.kr/wd/789012',
      tags: ['DevOps', 'Kubernetes', 'AWS'],
      jobCategory: '개발',
      jobRole: 'DevOps',
      experienceLevel: '미들',
      requiredYears: { min: 4, max: 10 },
    },
    {
      id: 'sample-8',
      title: 'iOS 개발자 (신입/주니어)',
      company: '야놀자',
      location: '서울시 강남구',
      address: '서울시 강남구 테헤란로 108길 42',
      region: '서울',
      description: '야놀자 앱의 iOS 네이티브 개발',
      requirements: 'Swift 숙련, UIKit/SwiftUI. 신입~2년차',
      url: 'https://www.wanted.co.kr/wd/890123',
      tags: ['iOS', 'Swift', 'SwiftUI'],
      jobCategory: '개발',
      jobRole: 'iOS',
      experienceLevel: '주니어',
      requiredYears: { min: 0, max: 2 },
    },
    {
      id: 'sample-9',
      title: 'AI/ML 엔지니어',
      company: '하이퍼커넥트',
      location: '서울시 서초구',
      address: '서울시 서초구 강남대로 311',
      region: '서울',
      description: '실시간 영상 처리 및 AI 모델 개발',
      requirements: 'PyTorch/TensorFlow, Computer Vision, 실시간 처리 경험. 경력 5년 이상',
      url: 'https://www.wanted.co.kr/wd/901234',
      tags: ['AI', 'ML', 'ComputerVision'],
      jobCategory: '데이터',
      jobRole: 'ML엔지니어',
      experienceLevel: '시니어',
      requiredYears: { min: 5, max: 12 },
    },
    {
      id: 'sample-10',
      title: 'Head of Product (PM리드)',
      company: '원티드랩',
      location: '서울시 송파구',
      address: '서울시 송파구 올림픽로 300',
      region: '서울',
      description: 'AI 기반 채용 매칭 플랫폼의 프로덕트 총괄. 프로덕트 전략 수립, 팀 리딩, 로드맵 관리',
      requirements: 'PM/PO 경험 10년 이상, 팀 리딩 경험 필수, AI/ML 도메인 이해, 데이터 기반 의사결정',
      url: 'https://www.wanted.co.kr/wd/012345',
      tags: ['PM', 'AI', '리드', '채용플랫폼'],
      jobCategory: '기획',
      jobRole: 'PM',
      experienceLevel: '시니어',
      requiredYears: { min: 10, max: 20 },
    },
    {
      id: 'sample-16',
      title: '시니어 프로덕트 오너 (채용 도메인)',
      company: '사람인',
      location: '서울시 구로구',
      address: '서울시 구로구 디지털로 300',
      region: '서울',
      description: '채용 플랫폼의 핵심 기능 기획 및 서비스 고도화',
      requirements: 'PM/PO 경력 7년 이상, 채용/HR 도메인 경험 우대, 데이터 분석 역량',
      url: 'https://www.wanted.co.kr/wd/162345',
      tags: ['PO', '채용', '기획', 'HR테크'],
      jobCategory: '기획',
      jobRole: 'PO',
      experienceLevel: '시니어',
      requiredYears: { min: 7, max: 15 },
    },
    {
      id: 'sample-17',
      title: '프로덕트 매니저 (Growth)',
      company: '당근마켓',
      location: '서울시 서초구',
      address: '서울시 서초구 강남대로 465',
      region: '서울',
      description: '당근마켓 그로스 팀에서 전환율 최적화 및 리텐션 개선 담당',
      requirements: 'PM 경력 8년 이상, Growth 전략 수립 경험, A/B 테스트 설계 및 분석 역량',
      url: 'https://www.wanted.co.kr/wd/172345',
      tags: ['PM', 'Growth', 'A/B테스트', '전환율'],
      jobCategory: '기획',
      jobRole: 'PM',
      experienceLevel: '시니어',
      requiredYears: { min: 8, max: 15 },
    },
    {
      id: 'sample-11',
      title: 'QA 엔지니어',
      company: '비바리퍼블리카',
      location: '서울시 강남구',
      address: '서울시 강남구 테헤란로 142',
      region: '서울',
      description: '토스 서비스의 품질 보증 및 테스트 자동화',
      requirements: '테스트 자동화 경험, Selenium/Appium, CI/CD 연동. 경력 2~5년',
      url: 'https://www.wanted.co.kr/wd/112345',
      tags: ['QA', '테스트자동화', 'CI/CD'],
      jobCategory: '개발',
      jobRole: 'QA',
      experienceLevel: '주니어',
      requiredYears: { min: 2, max: 5 },
    },
    {
      id: 'sample-12',
      title: '보안 엔지니어',
      company: '삼성SDS',
      location: '서울시 송파구',
      address: '서울시 송파구 올림픽로 35길 125',
      region: '서울',
      description: '클라우드 보안 아키텍처 설계 및 보안 취약점 분석',
      requirements: '정보보안 자격증, 클라우드 보안 경험, 취약점 분석 능력. 경력 5년 이상',
      url: 'https://www.wanted.co.kr/wd/122345',
      tags: ['보안', '클라우드', '취약점분석'],
      jobCategory: '개발',
      jobRole: '보안',
      experienceLevel: '시니어',
      requiredYears: { min: 5, max: 12 },
    },
    {
      id: 'sample-13',
      title: '프론트엔드 개발자 (부산)',
      company: '부산IT기업',
      location: '부산시 해운대구',
      address: '부산시 해운대구 센텀동로 99',
      region: '부산',
      description: '부산 기반 스타트업의 웹 프론트엔드 개발',
      requirements: 'React, TypeScript 경험. 경력 1~3년',
      url: 'https://www.wanted.co.kr/wd/132345',
      tags: ['React', 'TypeScript', '부산'],
      jobCategory: '개발',
      jobRole: '프론트엔드',
      experienceLevel: '주니어',
      requiredYears: { min: 1, max: 3 },
    },
    {
      id: 'sample-14',
      title: '리모트 백엔드 개발자',
      company: '스타트업A',
      location: '원격근무',
      address: '원격근무 (전국 가능)',
      region: '원격',
      description: '100% 원격 근무 기반의 백엔드 개발',
      requirements: 'Node.js/Python 경험, AWS 활용 능력. 경력 2년 이상',
      url: 'https://www.wanted.co.kr/wd/142345',
      tags: ['Node.js', 'AWS', '원격근무'],
      jobCategory: '개발',
      jobRole: '백엔드',
      experienceLevel: '주니어',
      requiredYears: { min: 2, max: 5 },
    },
    {
      id: 'sample-15',
      title: '대전 데이터 분석가',
      company: '대전연구소',
      location: '대전시 유성구',
      address: '대전시 유성구 대학로 99',
      region: '대전',
      description: '연구 데이터 분석 및 시각화',
      requirements: 'Python, SQL, 데이터 시각화 경험. 경력 1~3년',
      url: 'https://www.wanted.co.kr/wd/152345',
      tags: ['데이터분석', 'Python', '대전'],
      jobCategory: '데이터',
      jobRole: '데이터분석',
      experienceLevel: '주니어',
      requiredYears: { min: 1, max: 3 },
    },
  ];
}
