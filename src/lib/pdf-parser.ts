import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const base64PDF = buffer.toString('base64');
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64PDF,
              },
            },
            {
              type: 'text',
              text: `이 PDF는 이력서입니다. 이력서의 모든 내용을 텍스트로 추출해주세요.

다음 정보를 포함해서 구조화된 형태로 정리해주세요:
- 이름
- 연락처 (이메일, 전화번호)
- 경력 사항 (회사명, 직책, 기간, 주요 업무)
- 학력
- 기술 스택 / 스킬
- 자격증
- 프로젝트 경험
- 기타 특이사항

원본 내용을 최대한 보존하면서 정리해주세요.`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return content.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('PDF 파일을 읽는 중 오류가 발생했습니다.');
  }
}
