import Anthropic from '@anthropic-ai/sdk';
import { JobPosting } from './crawler';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MatchResult {
  job: JobPosting;
  score: number;
  summary: string;
  keyMatches: string[];
  salaryRange: string;
  hookMessage: string;
}

function extractYearsFromResume(resumeText: string): number {
  const patterns = [
    /(\d{1,2})\s*년\s*(경력|차|이상)/,
    /경력\s*:?\s*(\d{1,2})\s*년/,
    /(\d{1,2})\s*years?\s*(of\s*)?(experience)?/i,
    /총\s*(\d{1,2})\s*년/,
  ];
  
  for (const pattern of patterns) {
    const match = resumeText.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  const yearRanges = resumeText.matchAll(/20(\d{2})\s*[-~]\s*20(\d{2})/g);
  let totalYears = 0;
  for (const range of yearRanges) {
    const start = parseInt(range[1], 10);
    const end = parseInt(range[2], 10);
    totalYears += (end - start);
  }
  if (totalYears > 0) return totalYears;
  
  return 5;
}

function calculateExperiencePenalty(userYears: number, jobFrom: number, jobTo: number): number {
  if (userYears >= jobFrom && userYears <= jobTo) {
    return 0;
  }
  
  if (userYears < jobFrom) {
    const diff = jobFrom - userYears;
    return Math.min(diff * 3, 15);
  }
  
  if (userYears > jobTo) {
    const diff = userYears - jobTo;
    return Math.min(diff * 2, 10);
  }
  
  return 0;
}

// 깨진 문자 및 비한국어/영어 문자 제거
function sanitizeText(text: string): string {
  if (!text) return '';
  
  // 깨진 유니코드 문자 제거 (replacement character, 잘못된 인코딩 등)
  let cleaned = text.replace(/\uFFFD/g, '');
  
  // 일본어, 중국어 등 비한국어 문자 제거 (한글, 영어, 숫자, 기본 문장부호만 허용)
  cleaned = cleaned.replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s.,!?()~\-·:;%+]/g, '');
  
  // 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[]
): Promise<MatchResult[]> {
  const userYears = extractYearsFromResume(resumeText);
  
  const jobList = jobs.map((job, i) => {
    const expRange = job.annualFrom + '-' + job.annualTo + '년';
    return i + ': ' + job.title + ' @ ' + job.company + ' (경력 ' + expRange + ')';
  }).join('\n');

  const prompt = '사용자 경력: 약 ' + userYears + '년\n\n이력서:\n' + resumeText.substring(0, 2000) + '\n\n채용공고 목록:\n' + jobList + '\n\n위 이력서와 가장 잘 맞는 공고 1개를 선택하세요. 스킬과 경력 연차를 모두 고려하세요.\n\n반드시 아래 JSON 형식으로만 응답하세요. 한국어로만 작성하고, 일본어나 중국어는 절대 사용하지 마세요:\n{"jobIndex":0,"score":85,"summary":"추천 이유 2문장 (한국어)","keyMatches":["매칭포인트1","매칭포인트2","매칭포인트3"],"salaryRange":"8,000만원 ~ 1억원","hookMessage":"20자 이내 한줄 메시지"}\n\n주의: summary와 keyMatches, hookMessage는 반드시 한국어로만 작성하세요.';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON');
    }

    const m = JSON.parse(jsonMatch[0]);
    
    if (!jobs[m.jobIndex]) {
      throw new Error('Invalid job index');
    }

    const selectedJob = jobs[m.jobIndex];
    
    const penalty = calculateExperiencePenalty(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    const adjustedScore = Math.max(m.score - penalty, 50);

    // 모든 텍스트 필드에 대해 깨진 문자 제거
    const cleanedKeyMatches = (m.keyMatches || []).map((match: string) => sanitizeText(match)).filter((match: string) => match.length > 0);

    return [{
      job: selectedJob,
      score: adjustedScore,
      summary: sanitizeText(m.summary) || '이력서와 공고가 잘 매칭됩니다.',
      keyMatches: cleanedKeyMatches.length > 0 ? cleanedKeyMatches : ['경력 매칭', '직무 적합'],
      salaryRange: m.salaryRange || '6,000만원 ~ 8,000만원',
      hookMessage: sanitizeText(m.hookMessage) || '당신에게 딱 맞는 자리',
    }];
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
