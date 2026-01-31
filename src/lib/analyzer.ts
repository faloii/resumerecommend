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
  const jobsContext = jobs.map((job, index) => `
[공고 ${index + 1}]
ID: ${job.id}
제목: ${job.title}
회사: ${job.company}
위치: ${job.location}
설명: ${job.description}
요구사항: ${job.requirements}
태그: ${job.tags.join(', ')}
`).join('\n---\n');

  const prompt = `당신은 채용 매칭 전문가입니다. 아래 이력서와 채용 공고들을 분석하여 매칭 결과를 JSON 형식으로 반환해주세요.

## 이력서
${resumeText}

## 채용 공고 목록
${jobsContext}

## 분석 기준
1. **기술 스택 매칭**: 이력서의 기술과 공고 요구사항의 일치도
2. **경력 수준 매칭**: 경력 연차와 요구 수준의 적합성
3. **도메인 경험**: 관련 산업/도메인 경험 여부
4. **역할 적합성**: 이전 역할과 공고 포지션의 연관성

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "matches": [
    {
      "jobIndex": 0,
      "score": 85,
      "summary": "3줄 이내의 간단한 적합성 요약",
      "keyMatches": ["매칭 포인트1", "매칭 포인트2", "매칭 포인트3"]
    }
  ]
}

- jobIndex: 공고 번호 (0부터 시작)
- score: 0-100 사이의 매칭 점수
- summary: 왜 이 후보자가 적합한지 3줄 이내로 설명
- keyMatches: 핵심 매칭 포인트 3개

상위 10개 매칭 결과만 score 내림차순으로 정렬하여 반환하세요.`;

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

    // JSON 파싱
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // 결과 매핑
    const matchResults: MatchResult[] = result.matches.map((match: {
      jobIndex: number;
      score: number;
      summary: string;
      keyMatches: string[];
    }) => ({
      job: jobs[match.jobIndex],
      score: match.score,
      summary: match.summary,
      keyMatches: match.keyMatches,
    }));

    // score 기준 내림차순 정렬 후 상위 10개 반환
    return matchResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('매칭 분석 중 오류가 발생했습니다.');
  }
}
