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
}

export async function analyzeMatches(
  resumeText: string,
  jobs: JobPosting[]
): Promise<MatchResult[]> {
  const jobList = jobs.map((job, i) => {
    return i + ": " + job.title + " @ " + job.company;
  }).join("\n");

  const prompt = "Resume:\n" + resumeText.substring(0, 3000) + "\n\nJobs:\n" + jobList + "\n\nReturn JSON only: {\"matches\":[{\"jobIndex\":0,\"score\":85,\"summary\":\"why good fit\",\"keyMatches\":[\"skill1\",\"skill2\",\"skill3\"]}]} Top 5 by score desc.";

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    const matchResults: MatchResult[] = result.matches
      .filter((m: { jobIndex: number }) => jobs[m.jobIndex])
      .map((m: { jobIndex: number; score: number; summary: string; keyMatches: string[] }) => ({
        job: jobs[m.jobIndex],
        score: m.score,
        summary: m.summary,
        keyMatches: m.keyMatches || [],
      }));

    return matchResults.sort((a, b) => b.score - a.score).slice(0, 5);
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
