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

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[]
): Promise<MatchResult[]> {
  const jobList = jobs.map((job, i) => i + ": " + job.title + " @ " + job.company).join("\n");

  const prompt = "Resume:\n" + resumeText.substring(0, 2000) + "\n\nJobs:\n" + jobList + "\n\nPick the ONE best matching job. Return JSON only: {\"jobIndex\":0,\"score\":85,\"summary\":\"2 sentence reason in Korean\",\"keyMatches\":[\"match1\",\"match2\",\"match3\"],\"salaryRange\":\"8,000만원 ~ 1억원\",\"hookMessage\":\"당신의 OO 경험이 빛날 자리\"}\n\nsalaryRange: estimate based on job title and Korean market (format: X,000만원 ~ X,000만원)\nhookMessage: personalized one-liner in Korean highlighting user's key strength for this job (max 20 chars)";

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

    return [{
      job: jobs[m.jobIndex],
      score: m.score,
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
