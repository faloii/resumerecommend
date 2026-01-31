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
    return "[" + i + "] " + job.title + " at " + job.company + " - " + job.description;
  }).join("\n");

  const prompt = "당신은 채용 매칭 전문가입니다. 아래 이력서와 채용 공고들을 분석하여 매칭 결과를 JSON 형식으로 반환해주세요.\n\n이력서:\n" + resumeText + "\n\n채용 공고 목록:\n" + jobList + "\n\n분석 기준: 기술 스택 매칭, 경력 수준 매칭, 도메인 경험, 역할 적합성\n\n반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.\n{\"matches\":[{\"jobIndex\":0,\"score\":85,\"summary\":\"적합성 요약\",\"keyMatches\":[\"포인트1\",\"포인트2\",\"포인트3\"]}]}\n\n상위 10개 매칭 결과를 score 내림차순으로 반환하세요.";

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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

    return matchResults.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
