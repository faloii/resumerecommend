import { NextRequest, NextResponse } from 'next/server';
import { crawlWantedJobs } from '@/lib/crawler';
import { analyzeMatches } from '@/lib/analyzer';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, currentSalary, preferredLocations } = body;

    if (!resumeText || resumeText.trim().length < 30) {
      return NextResponse.json(
        { error: '이력서 내용을 30자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    // 원티드 공고 크롤링
    let jobs;
    try {
      jobs = await crawlWantedJobs(30);
    } catch (crawlError) {
      console.error('Crawl error:', crawlError);
      return NextResponse.json(
        { 
          error: '채용 공고를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.',
          retryable: true 
        },
        { status: 503 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { 
          error: '현재 매칭 가능한 공고가 없습니다. 잠시 후 다시 시도해주세요.',
          retryable: true 
        },
        { status: 503 }
      );
    }

    // Claude API로 매칭 분석
    const matches = await analyzeMatches(
      resumeText, 
      jobs, 
      preferredLocations || [], 
      currentSalary
    );

    return NextResponse.json({
      success: true,
      totalJobs: jobs.length,
      matches,
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // 에러 유형별 메시지
    const errorMessage = error instanceof Error ? error.message : '';
    
    if (errorMessage.includes('CRAWLING_FAILED') || errorMessage.includes('NO_JOBS_FOUND')) {
      return NextResponse.json(
        { 
          error: '채용 공고를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.',
          retryable: true 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
