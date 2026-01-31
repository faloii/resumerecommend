import PDFParser from 'pdf2json';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        // PDF에서 텍스트 추출
        const text = pdfData.Pages.map((page: { Texts: Array<{ R: Array<{ T: string }> }> }) => 
          page.Texts.map((textItem: { R: Array<{ T: string }> }) => 
            textItem.R.map((r: { T: string }) => decodeURIComponent(r.T)).join('')
          ).join(' ')
        ).join('\n');
        
        resolve(text.trim());
      } catch (error) {
        reject(new Error('PDF 텍스트 추출 중 오류가 발생했습니다.'));
      }
    });
    
    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error('PDF parsing error:', errData);
      reject(new Error('PDF 파일을 읽는 중 오류가 발생했습니다.'));
    });
    
    pdfParser.parseBuffer(buffer);
  });
}
