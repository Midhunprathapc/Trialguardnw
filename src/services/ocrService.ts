import { createWorker } from 'tesseract.js';

export interface OCRResult {
  serviceName?: string;
  startDate?: string;
  durationDays?: number;
  rawText: string;
}

export interface OCRConfig {
  langs?: string;
  psm?: number; // Page Segmentation Mode
  onProgress?: (progress: number) => void;
}

const COMMON_SERVICES = [
  'Netflix', 'Spotify', 'Hulu', 'Disney+', 'Amazon Prime', 'YouTube Premium',
  'Apple Music', 'Apple TV+', 'Paramount+', 'Peacock', 'HBO Max', 'Crunchyroll',
  'Adobe', 'Canva', 'Microsoft 365', 'Xbox Game Pass', 'PlayStation Plus'
];

export async function processImage(
  imageSource: string | File, 
  config: OCRConfig = {}
): Promise<OCRResult> {
  const { langs = 'eng', psm = 3, onProgress } = config;
  
  const worker = await createWorker(langs, 1, {
    logger: m => {
      if (m.status === 'recognizing' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  await worker.setParameters({
    tessedit_pageseg_mode: psm.toString() as any,
  });
  
  try {
    const { data: { text } } = await worker.recognize(imageSource);
    await worker.terminate();

    return {
      rawText: text,
      serviceName: detectService(text),
      durationDays: detectDuration(text),
      startDate: new Date().toISOString().split('T')[0]
    };
  } catch (error: any) {
    console.error('OCR Error:', error);
    await worker.terminate();
    
    let message = 'Failed to analyze image. Please ensure the text is clear.';
    if (error.message?.includes('Network Error')) {
      message = 'Network error: Could not load OCR engine. Check your connection.';
    } else if (error.message?.includes('Worker destroyed')) {
      message = 'Analysis was interrupted. Please try again.';
    }
    
    throw new Error(message);
  }
}

function detectService(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  return COMMON_SERVICES.find(service => 
    lowerText.includes(service.toLowerCase())
  );
}

function detectDuration(text: string): number | undefined {
  const patterns = [
    /(\d+)\s*-?\s*day/i,
    /(\d+)\s*-?\s*month/i,
    /7\s*day/i,
    /14\s*day/i,
    /30\s*day/i,
    /one\s*month/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('month')) return 30;
      return parseInt(match[1]) || (text.toLowerCase().includes('7') ? 7 : 30);
    }
  }
  return 7; // Default fallback
}
