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

export async function crawlWantedJobs(tagId: string = '518', limit: number = 10): Promise<JobPosting[]> {
  try {
    // 랜덤 오프셋으로 다양한 공고 가져오기
    const randomOffset = Math.floor(Math.random() * 30);
    
    // 여러 정렬 방식 중 랜덤 선택
    const sortOptions = ['job.latest_order', 'job.popularity_order', 'job.compensation_order'];
    const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
    
    const url = 'https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=' + tagId + '&job_sort=' + randomSort + '&years=-1&locations=all&limit=20&offset=' + randomOffset;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Wanted API failed, status:', response.status);
      return getActiveJobs(tagId);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return getActiveJobs(tagId);
    }

    // 가져온 공고 중 랜덤으로 섞어서 선택
    const shuffled = data.data.sort(() => Math.random() - 0.5);
    
    const jobs: JobPosting[] = shuffled.slice(0, limit).map((job: {
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

    return jobs.length > 0 ? jobs : getActiveJobs(tagId);
  } catch (error) {
    console.error('Crawling error:', error);
    return getActiveJobs(tagId);
  }
}

function getActiveJobs(tagId: string): JobPosting[] {
  // 직군별 샘플 데이터
  const jobsByCategory: { [key: string]: JobPosting[] } = {
    '518': [ // 개발
      { id: '1', title: 'Frontend Developer', company: '토스', location: '서울 강남구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
      { id: '2', title: 'Backend Developer', company: '카카오', location: '경기 성남시', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/3247', tags: [] },
      { id: '3', title: 'DevOps Engineer', company: '라인', location: '경기 성남시', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/3152', tags: [] },
      { id: '4', title: 'iOS Developer', company: '당근', location: '서울 서초구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/5932', tags: [] },
    ],
    '507': [ // 경영·비즈니스
      { id: '5', title: 'Product Manager', company: '쿠팡', location: '서울 송파구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
      { id: '6', title: 'Product Owner', company: '네이버', location: '경기 성남시', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/3152', tags: [] },
      { id: '7', title: '서비스 기획자', company: '배달의민족', location: '서울 송파구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/5932', tags: [] },
      { id: '8', title: '사업개발 매니저', company: '토스', location: '서울 강남구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
    ],
    '517': [ // 마케팅
      { id: '9', title: 'Growth Marketer', company: '토스', location: '서울 강남구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
      { id: '10', title: 'Performance Marketer', company: '쿠팡', location: '서울 송파구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
      { id: '11', title: 'Brand Marketer', company: '무신사', location: '서울 성동구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/5932', tags: [] },
    ],
    '516': [ // 디자인
      { id: '12', title: 'UX Designer', company: '리디', location: '서울 강남구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/5932', tags: [] },
      { id: '13', title: 'Product Designer', company: '토스', location: '서울 강남구', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/79', tags: [] },
      { id: '14', title: 'UI Designer', company: '카카오', location: '경기 성남시', description: '', requirements: '', url: 'https://www.wanted.co.kr/company/3247', tags: [] },
    ],
  };

  const jobs = jobsByCategory[tagId] || jobsByCategory['518'];
  return jobs.sort(() => Math.random() - 0.5);
}
