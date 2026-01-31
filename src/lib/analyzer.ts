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
  const lowerText = resumeText.toLowerCase();
  
  // "14년 경력", "경력 14년", "14년차" 등의 패턴
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
  
  // 회사 경력 합산 시도 (2019~2023 형태)
  const yearRanges = resumeText.matchAll(/20(\d{2})\s*[-~]\s*20(\d{2})/g);
  let totalYears = 0;
  for (const range of yearRanges) {
    const start = parseInt(range[1], 10);
    const end = parseInt(range[2], 10);
    totalYears += (end - start);
  }
  if (totalYears > 0) return totalYears;
  
  // 기본값
  return 5;
}

function calculateExperiencePenalty(userYears: number, jobFrom: number, jobTo: number): number {
  // 경력이 범위 내면 패널티 없음
  if (userYears >= jobFrom && userYears <= jobTo) {
    return 0;
  }
  
  // 경력 부족 또는 초과 시 차이만큼 패널티
  if (userYears < jobFrom) {
    const diff = jobFrom - userYears;
    return Math.min(diff * 3, 15); // 최대 15점 감점
  }
  
  if (userYears > jobTo) {
    const diff = userYears - jobTo;
    return Math.min(diff * 2, 10); // 오버스펙은 좀 덜 감점, 최대 10점
  }
  
  return 0;
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

  const prompt = 'Resume (user has about ' + userYears + ' years experience):\n' + resumeText.substring(0, 2000) + '\n\nJobs:\n' + jobList + '\n\nPick the ONE best matching job considering skills AND experience level fit. Return JSON only: {"jobIndex":0,"score":85,"summary":"2 sentence reason in Korean","keyMatches":["match1","match2","match3"],"salaryRange":"8,000만원 ~ 1억원","hookMessage":"당신의 OO 경험이 빛날 자리"}\n\nConsider experience match: if user experience is far outside job range, lower the score.\nsalaryRange: estimate based on job title and Korean market\nhookMessage: personalized one-liner in Korean (max 20 chars)';

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
    
    // 경력 차이에 따른 추가 패널티 적용
    const penalty = calculateExperiencePenalty(userYears, selectedJob.annualFrom, selectedJob.annualTo);
    const adjustedScore = Math.max(m.score - penalty, 50);

    return [{
      job: selectedJob,
      score: adjustedScore,
      summary: m.summary,
      keyMatches: m.keyMatches || [],
      salaryRange: m.salaryRange || '6,000만원 ~ 8,000만원',
      hookMessage: m.hookMessage || '당신에게 딱 맞는 자리',
    }];
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
