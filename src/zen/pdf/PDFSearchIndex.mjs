/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "arent", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "cant", "cannot", "could", "couldnt",
  "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt",
  "have", "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres",
  "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill",
  "im", "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself", "lets",
  "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
  "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should",
  "shouldnt", "so", "some", "such", "than", "that", "thats", "the", "their",
  "theirs", "them", "themselves", "then", "there", "theres", "these", "they",
  "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were",
  "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which",
  "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would",
  "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours",
  "yourself", "yourselves"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

export class nsPDFSearchIndex {
  _chunks = [];
  _pages = [];

  constructor(chunks = [], pages = []) {
    this._chunks = chunks;
    this._pages = pages;
  }

  /**
   * Search through PDF pages and semantic chunks.
   * @param {string} query
   * @param {number} limit
   * @returns {object} { chunks, pages }
   */
  search(query, limit = 5) {
    if (!query) return { chunks: [], pages: [] };

    const tokens = tokenize(query);
    if (tokens.length === 0) return { chunks: [], pages: [] };

    const scoredChunks = this._chunks.map((chunk, idx) => {
      const score = this._scoreContent(chunk.content, chunk.heading, tokens);
      return { chunk, index: idx, score };
    });

    const scoredPages = this._pages.map((page) => {
      const score = this._scoreContent(page.text, `Page ${page.pageNumber}`, tokens);
      return { page, score };
    });

    const matchedChunks = scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const matchedPages = scoredPages
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      chunks: matchedChunks,
      pages: matchedPages
    };
  }

  _scoreContent(content, heading, tokens) {
    let score = 0;
    const contentLower = (content || "").toLowerCase();
    const headingLower = (heading || "").toLowerCase();

    tokens.forEach(token => {
      // 1. Heading boost
      if (headingLower.includes(token)) {
        score += 15;
      }
      
      // 2. Frequency score
      let pos = contentLower.indexOf(token);
      let count = 0;
      while (pos !== -1) {
        count++;
        pos = contentLower.indexOf(token, pos + 1);
      }
      score += count * 2;
    });

    return score;
  }
}
