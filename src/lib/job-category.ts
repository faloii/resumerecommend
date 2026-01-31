interface JobCategory {
  tagId: string;
  name: string;
}

// 원티드 직군 태그 매핑
const CATEGORY_KEYWORDS: { [key: string]: { tagId: string; name: string; keywords: string[] } } = {
  development: {
    tagId: '518',
    name: '개발',
    keywords: [
      '개발', 'developer', 'engineer', '엔지니어', 'frontend', 'backend', 'fullstack',
      '프론트엔드', '백엔드', '풀스택', 'react', 'vue', 'angular', 'node', 'python',
      'java', 'kotlin', 'swift', 'ios', 'android', '앱개발', '웹개발', 'devops',
      'mlops', 'data engineer', '데이터 엔지니어', 'ai', 'ml', '머신러닝', '딥러닝',
      'software', '소프트웨어', 'qa', 'test', '테스트', 'security', '보안',
      'cloud', 'aws', 'gcp', 'azure', 'infrastructure', '인프라', 'sre',
      'typescript', 'javascript', 'go', 'rust', 'c++', 'c#', '.net'
    ]
  },
  business: {
    tagId: '507',
    name: '경영·비즈니스',
    keywords: [
      '경영', 'business', '사업', '전략', 'strategy', '기획', 'planning',
      'pm', 'po', 'product manager', 'product owner', '프로덕트', '프로젝트',
      '서비스 기획', '사업 개발', 'bd', 'biz', '운영', 'operation',
      '컨설팅', 'consulting', '애널리스트', 'analyst', 'ceo', 'coo', 'cfo'
    ]
  },
  marketing: {
    tagId: '517',
    name: '마케팅·광고',
    keywords: [
      '마케팅', 'marketing', '광고', 'advertisement', 'pr', '홍보',
      '브랜드', 'brand', 'growth', '그로스', 'performance', '퍼포먼스',
      'digital marketing', '디지털 마케팅', 'sns', '소셜미디어', 'content',
      '콘텐츠', 'seo', 'sem', 'crm', '캠페인', 'campaign'
    ]
  },
  design: {
    tagId: '516',
    name: '디자인',
    keywords: [
      '디자인', 'design', 'ux', 'ui', 'ux/ui', 'ui/ux', 'product design',
      '프로덕트 디자인', 'graphic', '그래픽', 'visual', '시각', 'figma',
      'sketch', 'adobe', '일러스트', 'illustrator', 'photoshop', '포토샵',
      'motion', '모션', '영상', 'video', '3d', 'branding', 'bx'
    ]
  },
  sales: {
    tagId: '510',
    name: '영업',
    keywords: [
      '영업', 'sales', 'account', '어카운트', 'b2b', 'b2c', '세일즈',
      '고객', 'client', '제휴', 'partnership', '파트너십'
    ]
  },
  hr: {
    tagId: '513',
    name: '인사',
    keywords: [
      '인사', 'hr', 'human resource', '채용', 'recruiting', 'recruiter',
      '리크루터', '조직문화', 'culture', 'people', '피플', 'talent',
      '교육', 'training', '보상', 'compensation', 'hrbp'
    ]
  },
  data: {
    tagId: '527',
    name: '데이터',
    keywords: [
      '데이터', 'data', 'analyst', '분석', 'analytics', 'bi',
      'data scientist', '데이터 사이언티스트', 'sql', 'tableau', 'python',
      '통계', 'statistics', 'visualization', '시각화'
    ]
  },
  finance: {
    tagId: '515',
    name: '금융',
    keywords: [
      '금융', 'finance', '회계', 'accounting', '재무', 'financial',
      'ir', '투자', 'investment', 'cpa', '세무', 'tax'
    ]
  }
};

export function extractJobCategory(resumeText: string): JobCategory {
  const lowerText = resumeText.toLowerCase();
  
  // 각 카테고리별 키워드 매칭 점수 계산
  const scores: { [key: string]: number } = {};
  
  for (const [category, info] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of info.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        // 긴 키워드일수록 가중치 높게
        score += keyword.length > 5 ? 2 : 1;
      }
    }
    scores[category] = score;
  }
  
  // 가장 높은 점수의 카테고리 찾기
  let maxCategory = 'development';
  let maxScore = 0;
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category;
    }
  }
  
  const result = CATEGORY_KEYWORDS[maxCategory];
  return {
    tagId: result.tagId,
    name: result.name
  };
}
