# WantedFit - AI 기반 채용 공고 매칭 서비스

PDF 이력서를 업로드하면 AI가 원티드 채용 공고 중 가장 적합한 Top 10 공고를 매칭해주는 MVP 서비스입니다.

## 주요 기능

- **PDF 이력서 업로드**: 드래그 앤 드롭 또는 클릭으로 간편 업로드
- **AI 매칭 분석**: Claude API를 활용한 이력서-공고 적합성 분석
- **Top 10 추천**: 매칭 점수와 함께 간단한 적합성 요약 제공
- **회원가입 유도**: 상세 분석은 원티드 회원 전용

## 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Claude API (Anthropic)
- **PDF 처리**: pdf-parse
- **웹 크롤링**: cheerio
- **배포**: Vercel

## 로컬 실행 방법

1. 의존성 설치
```bash
npm install
```

2. 환경변수 설정
```bash
# .env.local 파일에 ANTHROPIC_API_KEY 설정
ANTHROPIC_API_KEY=your_api_key_here
```

3. 개발 서버 실행
```bash
npm run dev
```

4. http://localhost:3000 접속

## Vercel 배포 방법

1. [Vercel](https://vercel.com)에 GitHub 저장소 연결
2. Environment Variables에 `ANTHROPIC_API_KEY` 추가
3. Deploy

## 환경변수

| 변수명 | 설명 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 (필수) |

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts    # 매칭 분석 API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # 메인 페이지
└── lib/
    ├── analyzer.ts         # Claude API 매칭 분석
    ├── crawler.ts          # 원티드 공고 크롤링
    └── pdf-parser.ts       # PDF 텍스트 추출
```

## 라이선스

원티드랩 내부 프로젝트
