import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdf-parser';
import { crawlWantedJobs } from '@/lib/crawler';
import { analyzeMatches } from '@/lib/analyzer';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: '이력서 파일이 필요합니다.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'PDF 파일만 지원합니다.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resumeText = await extractTextFromPDF(buffer);

    if (!resumeText || resumeText.trim().length < 50) {
      return NextResponse.json({ error: '이력서에서 텍스트를 추출할 수 없습니다.' }, { status: 400 });
    }

    const jobs = await crawlWantedJobs('', 6);

    if (jobs.length === 0) {
      return NextResponse.json({ error: '채용 공고를 불러오는 데 실패했습니다.' }, { status: 500 });
    }

    const matches = await analyzeMatches(resumeText, jobs);

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
