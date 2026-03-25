/**
 * INPUT: raw text string
 * OUTPUT: tokenized terms for BM25 indexing
 * POSITION: Utility for Chinese/English text segmentation
 */

const EN_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'if', 'than', 'too', 'very', 'just', 'about', 'up',
  'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my',
  'his', 'her', 'our', 'your', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'no', 'only', 'own', 'same', 'such', 'here', 'there',
]);

const ZH_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
  '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
  '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它',
  '们', '那', '些', '把', '让', '从', '被', '对', '等', '用',
]);

/** Check if char is CJK */
function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x4E00 && code <= 0x9FFF) ||
         (code >= 0x3400 && code <= 0x4DBF) ||
         (code >= 0x3040 && code <= 0x30FF) ||
         (code >= 0xAC00 && code <= 0xD7AF);
}

/** Tokenize text into terms (Chinese + English) */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];

  // Try Intl.Segmenter for Chinese word segmentation
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
      for (const { segment, isWordLike } of segmenter.segment(lower)) {
        if (isWordLike && segment.trim().length >= 1) {
          tokens.push(segment.trim());
        }
      }
      return removeStopWords(tokens);
    } catch {
      // Fallback below
    }
  }

  // Fallback: simple split for English + unigram/bigram for CJK
  let buf = '';
  const cjkChars: string[] = [];

  for (const char of lower) {
    if (isCJK(char)) {
      if (buf.trim()) {
        tokens.push(...buf.trim().split(/[\s\p{P}]+/u).filter(Boolean));
        buf = '';
      }
      cjkChars.push(char);
    } else {
      // Flush CJK buffer as unigrams + bigrams
      if (cjkChars.length > 0) {
        for (const c of cjkChars) tokens.push(c);
        for (let i = 0; i < cjkChars.length - 1; i++) {
          tokens.push(cjkChars[i] + cjkChars[i + 1]);
        }
        cjkChars.length = 0;
      }
      buf += char;
    }
  }

  // Flush remaining
  if (cjkChars.length > 0) {
    for (const c of cjkChars) tokens.push(c);
    for (let i = 0; i < cjkChars.length - 1; i++) {
      tokens.push(cjkChars[i] + cjkChars[i + 1]);
    }
  }
  if (buf.trim()) {
    tokens.push(...buf.trim().split(/[\s\p{P}]+/u).filter(Boolean));
  }

  return removeStopWords(tokens);
}

/** Remove stop words and short tokens */
function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(t => {
    if (t.length < 2 && !isCJK(t.charAt(0))) return false;
    return !EN_STOP_WORDS.has(t) && !ZH_STOP_WORDS.has(t);
  });
}
