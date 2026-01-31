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
1. 기술 스택 매칭: 이력서의 기술과 공고 요구사항의 일치도
2. 경력 수준 매칭: 경력 연차와 요구 수준의 적합성
3. 도메인 경험: 관련 산업/도메인 경험 여부
4. 역할 적합성: 이전 역할과 공고 포지션의 연관성

## 중요: 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.
마크다운 코드 블록(\`\`\`)도 사용하지 마세요. 순
