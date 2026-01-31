import * as cheerio from 'cheerio';

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  url: string;
  tags: string[];
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

    return {
      id: jobId,
      title: title.split(' | ')[0].trim(),
      company: company.replace(/[^가-힣a-zA-Z0-9\s]/g, '').trim(),
      location: '서울', // 기본값
      description: description,
      requirements: bodyText.slice(0, 2000), // 본문 일부
      url: url,
      tags: tags.slice(0, 5),
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
      location: '서울',
      description: '토스 앱의 핵심 금융 서비스를 기획하고 성장시킬 PM을 찾습니다.',
      requirements: '5년 이상의 PM 경험, 데이터 기반 의사결정 능력, 금융/핀테크 도메인 이해',
      url: 'https://www.wanted.co.kr/wd/123456',
      tags: ['PM', '핀테크', '데이터분석'],
    },
    {
      id: 'sample-2',
      title: '백엔드 개발자 (Java/Kotlin)',
      company: '카카오',
      location: '판교',
      description: '카카오톡 플랫폼의 대규모 트래픽을 처리하는 백엔드 시스템 개발',
      requirements: 'Java/Kotlin 숙련, 대용량 트래픽 처리 경험, MSA 아키텍처 이해',
      url: 'https://www.wanted.co.kr/wd/234567',
      tags: ['Java', 'Kotlin', 'MSA'],
    },
    {
      id: 'sample-3',
      title: '프론트엔드 개발자',
      company: '네이버',
      location: '분당',
      description: '네이버 메인 서비스의 사용자 경험을 개선하는 프론트엔드 개발',
      requirements: 'React/Vue 경험, TypeScript 숙련, 웹 성능 최적화 경험',
      url: 'https://www.wanted.co.kr/wd/345678',
      tags: ['React', 'TypeScript', '프론트엔드'],
    },
    {
      id: 'sample-4',
      title: '데이터 사이언티스트',
      company: '쿠팡',
      location: '서울',
      description: '추천 시스템 및 개인화 알고리즘 개발',
      requirements: 'Python, ML/DL 프레임워크, 추천 시스템 경험',
      url: 'https://www.wanted.co.kr/wd/456789',
      tags: ['ML', 'Python', '추천시스템'],
    },
    {
      id: 'sample-5',
      title: 'UX 디자이너',
      company: '배달의민족',
      location: '서울',
      description: '배민 앱의 사용자 경험을 설계하고 개선',
      requirements: 'Figma 숙련, 사용자 리서치 경험, 프로토타이핑 능력',
      url: 'https://www.wanted.co.kr/wd/567890',
      tags: ['UX', 'Figma', '사용자리서치'],
    },
    {
      id: 'sample-6',
      title: '마케팅 매니저',
      company: '당근마켓',
      location: '서울',
      description: '그로스 마케팅 및 퍼포먼스 마케팅 전략 수립/실행',
      requirements: 'GA/Amplitude 활용 경험, 퍼포먼스 마케팅 3년 이상',
      url: 'https://www.wanted.co.kr/wd/678901',
      tags: ['마케팅', '그로스', '퍼포먼스'],
    },
    {
      id: 'sample-7',
      title: 'DevOps 엔지니어',
      company: '라인',
      location: '분당',
      description: 'CI/CD 파이프라인 구축 및 인프라 자동화',
      requirements: 'Kubernetes, Docker, AWS/GCP, Terraform',
      url: 'https://www.wanted.co.kr/wd/789012',
      tags: ['DevOps', 'Kubernetes', 'AWS'],
    },
    {
      id: 'sample-8',
      title: 'iOS 개발자',
      company: '야놀자',
      location: '서울',
      description: '야놀자 앱의 iOS 네이티브 개발',
      requirements: 'Swift 숙련, UIKit/SwiftUI, RxSwift 경험',
      url: 'https://www.wanted.co.kr/wd/890123',
      tags: ['iOS', 'Swift', 'SwiftUI'],
    },
    {
      id: 'sample-9',
      title: 'AI/ML 엔지니어',
      company: '하이퍼커넥트',
      location: '서울',
      description: '실시간 영상 처리 및 AI 모델 개발',
      requirements: 'PyTorch/TensorFlow, Computer Vision, 실시간 처리 경험',
      url: 'https://www.wanted.co.kr/wd/901234',
      tags: ['AI', 'ML', 'ComputerVision'],
    },
    {
      id: 'sample-10',
      title: '서비스 기획자',
      company: '원티드랩',
      location: '서울',
      description: 'AI 기반 채용 매칭 서비스 기획',
      requirements: '서비스 기획 3년 이상, SQL 활용 능력, AI/ML 이해',
      url: 'https://www.wanted.co.kr/wd/012345',
      tags: ['기획', 'AI', '채용'],
    },
    {
      id: 'sample-11',
      title: 'QA 엔지니어',
      company: '비바리퍼블리카',
      location: '서울',
      description: '토스 서비스의 품질 보증 및 테스트 자동화',
      requirements: '테스트 자동화 경험, Selenium/Appium, CI/CD 연동',
      url: 'https://www.wanted.co.kr/wd/112345',
      tags: ['QA', '테스트자동화', 'CI/CD'],
    },
    {
      id: 'sample-12',
      title: '보안 엔지니어',
      company: '삼성SDS',
      location: '서울',
      description: '클라우드 보안 아키텍처 설계 및 보안 취약점 분석',
      requirements: '정보보안 자격증, 클라우드 보안 경험, 취약점 분석 능력',
      url: 'https://www.wanted.co.kr/wd/122345',
      tags: ['보안', '클라우드', '취약점분석'],
    },
  ];
}
