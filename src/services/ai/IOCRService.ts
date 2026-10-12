// IOCRService.ts - Interface contract for Text Extraction (OCR) from images
export interface OCRResult {
  fullText: string;
  confidence?: number;
  lines: string[];
}

export interface IOCRService {
  /**
   * Extracts text from an image buffer and returns structured text.
   */
  extractText(imageBuffer: Buffer, mimeType: string): Promise<OCRResult>;
}
