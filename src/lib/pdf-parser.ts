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
              text: '이 PDF는 이력서입니다. 이력서의 모든 내용을 텍스트로 추출해주세요. 이름, 연락처, 경력사항, 학력, 기술스택, 자격증, 프로젝트 경험 등을 구조화된 형태로 정리해주세요.',
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
