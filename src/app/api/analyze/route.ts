import { NextRequest, NextResponse } from 'next/server';
import { crawlWantedJobs } from '@/lib/crawler';
import { analyzeMatches } from '@/lib/analyzer';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, currentSalary } = body;

    if (!resumeText || resumeText.trim().length < 30) {
      return NextResponse.json(
        { error: '이력서 내용을 30자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    // 원티드 공고 크롤링
    const jobs = await crawlWantedJobs('', 30);

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: '채용 공고를 불러오는 데 실패했습니다.' },
        { status: 500 }
      );
    }

    // Claude API로 매칭 분석
    const matches = await analyzeMatches(resumeText, jobs, [], currentSalary);

    return NextResponse.json({
      success: true,
      totalJobs: jobs.length,
      matches,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
