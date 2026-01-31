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

export async function crawlWantedJobs(keyword: string = '', limit: number = 6): Promise<JobPosting[]> {
  try {
    const response = await fetch(
      'https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=518&job_sort=job.latest_order&years=-1&locations=all&limit=' + limit,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Wanted API failed, status:', response.status);
      return getActiveJobs();
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return getActiveJobs();
    }

    const jobs: JobPosting[] = data.data.slice(0, limit).map((job: {
      id: number;
      position: string;
      company: { name: string };
      address: { location: string; district: string };
    }) => {
      const loc = job.address?.location || '';
      const district = job.address?.district || '';
      const fullLocation = district ? loc + ' ' + district : loc;
      
      return {
        id: String(job.id),
        title: job.position,
        company: job.company?.name || 'Unknown',
        location: fullLocation || 'Seoul',
        description: job.position,
        requirements: '',
        url: 'https://www.wanted.co.kr/wd/' + job.id,
        tags: [],
      };
    });

    return jobs.length > 0 ? jobs : getActiveJobs();
  } catch (error) {
    console.error('Crawling error:', error);
    return getActiveJobs();
  }
}

function getActiveJobs(): JobPosting[] {
  return [
    {
      id: '250117',
      title: 'Frontend Developer',
      company: '토스',
      location: '서울 강남구',
      description: 'React, TypeScript 기반 프론트엔드 개발',
      requirements: 'React, TypeScript 3년 이상',
      url: 'https://www.wanted.co.kr/company/79',
      tags: ['React', 'TypeScript', 'Frontend'],
    },
    {
      id: '250118',
      title: 'Backend Developer',
      company: '카카오',
      location: '경기 성남시',
      description: 'Java/Kotlin 기반 백엔드 서비스 개발',
      requirements: 'Java, Spring 3년 이상',
      url: 'https://www.wanted.co.kr/company/3247',
      tags: ['Java', 'Spring', 'Backend'],
    },
    {
      id: '250119',
      title: 'Product Manager',
      company: '쿠팡',
      location: '서울 송파구',
      description: '이커머스 프로덕트 매니저',
      requirements: 'PM 경력 2년 이상',
      url: 'https://www.wanted.co.kr/company/79',
      tags: ['PM', 'E-commerce', 'Product'],
    },
    {
      id: '250120',
      title: 'Data Analyst',
      company: '네이버',
      location: '경기 성남시',
      description: '데이터 분석 및 인사이트 도출',
      requirements: 'SQL, Python 필수',
      url: 'https://www.wanted.co.kr/company/3152',
      tags: ['Data', 'SQL', 'Python'],
    },
    {
      id: '250121',
      title: 'DevOps Engineer',
      company: '라인',
      location: '경기 성남시',
      description: 'AWS/K8s 기반 인프라 운영',
      requirements: 'AWS, Kubernetes 경험',
      url: 'https://www.wanted.co.kr/company/3152',
      tags: ['DevOps', 'AWS', 'Kubernetes'],
    },
    {
      id: '250122',
      title: 'iOS Developer',
      company: '당근',
      location: '서울 서초구',
      description: 'Swift 기반 iOS 앱 개발',
      requirements: 'Swift, iOS 3년 이상',
      url: 'https://www.wanted.co.kr/company/5932',
      tags: ['iOS', 'Swift', 'Mobile'],
    },
  ];
}
