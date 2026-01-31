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
  const jobsContext = jobs.map((job, index) => 
    `[공고 ${index + 1}] ID: ${job.id} | 제목: ${job.title} | 회사: ${job.company} | 위치: ${job.location} | 설명: ${job.description} | 요구사항: ${job.requirements} | 태그: ${job.tags.join(', ')}`
  ).join('
');

  const prompt = `당신은 채용 매칭 전문가입니다. 아래 이력서와 채용 공고들을 분석하여 매칭 결과를 JSON 형식으로 반환해주세요.

이력서:
${resumeText}

채용 공고 목록:
${jobsContext}

분석 기준:
1. 기술 스택 매칭
2. 경력 수준 매칭
3. 도메인 경험
4. 역할 적합성

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

{"matches":[{"jobIndex":0,"score":85,"summary":"적합성 요약 문장","keyMatches":["포인트1","포인트2","포인트3"]}]}

상위 10개 매칭 결과를 score 내림차순으로 반환하세요.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Raw response:', content.text);
      throw new Error('Failed to parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    const matchResults: MatchResult[] = result.matches
      .filter((match: { jobIndex: number }) => jobs[match.jobIndex])
      .map((match: { jobIndex: number; score: number; summary: string; keyMatches: string[] }) => ({
        job: jobs[match.jobIndex],
        score: match.score,
        summary: match.summary,
        keyMatches: match.keyMatches || [],
      }));

    return matchResults.sort((a, b) => b.score - a.score).slice(0, 10);

  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
