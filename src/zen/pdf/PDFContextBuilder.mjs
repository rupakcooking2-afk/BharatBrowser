/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function flattenOutline(outline) {
  const result = [];
  function traverse(nodes) {
    for (const node of nodes) {
      let pageNumber = null;
      if (Array.isArray(node.dest)) {
        // PDF.js destinations: first item is page ref/index, check if there is an index integer
        const pageIdx = node.dest.find(x => typeof x === "number");
        if (pageIdx !== undefined) {
          pageNumber = pageIdx + 1;
        }
      }
      result.push({
        title: node.title,
        pageNumber: pageNumber || 1
      });
      if (node.items && node.items.length > 0) {
        traverse(node.items);
      }
    }
  }
  if (outline && outline.length > 0) {
    traverse(outline);
  }
  return result.sort((a, b) => a.pageNumber - b.pageNumber);
}

export class nsPDFContextBuilder {
  /**
   * Semantically chunks the PDF pages based on outlines, page bounds, and headings.
   * @param {Array} pages
   * @param {Array} outline
   * @returns {Array} List of chunks
   */
  static buildChunks(pages, outline = []) {
    const flatOutline = flattenOutline(outline);
    const chunks = [];

    if (flatOutline.length > 0) {
      for (let i = 0; i < flatOutline.length; i++) {
        const heading = flatOutline[i].title;
        const startPage = flatOutline[i].pageNumber;
        const nextHeading = flatOutline[i + 1];
        const endPage = nextHeading ? Math.min(nextHeading.pageNumber - 1, pages.length) : pages.length;

        let content = "";
        for (let p = startPage; p <= endPage; p++) {
          const page = pages.find(pg => pg.pageNumber === p);
          if (page) content += page.text + "\n\n";
        }

        chunks.push({
          heading,
          startPage,
          endPage,
          content: content.trim()
        });
      }
    } else {
      pages.forEach(page => {
        const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
        const heading = lines[0] ? lines[0].substring(0, 80) : `Page ${page.pageNumber}`;
        
        chunks.push({
          heading,
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          content: page.text
        });
      });
    }

    return chunks;
  }

  /**
   * Constructs the Gemini prompt context package based on the query, matches, and mode.
   * @param {string} mode
   * @param {object} session
   * @param {string} query
   * @param {object} additionalOptions
   * @returns {string} Prompt text
   */
  static buildContext(mode, session, query = "", additionalOptions = {}) {
    const outlineStr = session.outline && session.outline.length > 0
      ? JSON.stringify(session.outline.map(o => ({ title: o.title, dest: o.dest })), null, 2)
      : "No Outline Available";

    let contextText = `Document Title: ${session.title}\nSource URL: ${session.sourceUrl}\nPage Count: ${session.pageCount}\n\nOutline:\n${outlineStr}\n\n`;

    if (mode === "ask") {
      const matches = additionalOptions.matches || { chunks: [], pages: [] };
      contextText += `=== Relevant Document Content ===\n\n`;
      matches.chunks.forEach(({ chunk }) => {
        contextText += `[Heading: ${chunk.heading} (Pages ${chunk.startPage}-${chunk.endPage})]\n${chunk.content}\n\n`;
      });
    } else {
      contextText += `=== Document Content (Truncated if large) ===\n\n`;
      let size = 0;
      const MAX_CONTENT_LENGTH = 60000;
      
      for (const chunk of session.chunks) {
        const textToAdd = `[Heading: ${chunk.heading} (Pages ${chunk.startPage}-${chunk.endPage})]\n${chunk.content}\n\n`;
        if (size + textToAdd.length > MAX_CONTENT_LENGTH) {
          contextText += `... [Content Truncated for length] ...\n`;
          break;
        }
        contextText += textToAdd;
        size += textToAdd.length;
      }
    }

    let prompt = "";
    switch (mode) {
      case "summary":
        prompt = `${contextText}\n\nYou are analyzing a PDF document. Please generate:\n1. **Executive Summary** (A clear overview of the document)\n2. **Key Findings** (Bullet points of main takeaways)\n3. **Main Topics** (Core subject areas covered)\n4. **Important Quotes** (Direct relevant quotes with page numbers)`;
        break;
      case "explain":
        const style = additionalOptions.style || "beginner";
        prompt = `${contextText}\n\nYou are analyzing a PDF document. Please explain this document's content using a **${style}** style.\n\n` +
                 (style === "beginner" 
                   ? "Make it simple, clear, and easy to understand for someone with no background knowledge. Avoid jargon." 
                   : "Keep it detailed, precise, and use professional/technical terms where appropriate. Focus on technical architecture, methodology, or equations.");
        break;
      case "ask":
        prompt = `${contextText}\n\nAnswer the following question about this PDF document:\n\n"${query}"\n\n**IMPORTANT**: Your answer must include source citations referring to specific page numbers (e.g. "Page 12" or "Pages 15-16") based on the text. Only state facts directly supported by the context.`;
        break;
      case "timeline":
        prompt = `${contextText}\n\nYou are analyzing a PDF document. Please extract and generate a chronological **Timeline of Events** described in the document. For each event listed, include a concise description and reference the page number(s) (e.g. "Page 42") where it is mentioned.`;
        break;
      case "facts":
        prompt = `${contextText}\n\nYou are analyzing a PDF document. Please extract and list the following details in structured sections:\n1. **Dates** (Chronological order if possible)\n2. **Names & Organizations** (Key entities involved)\n3. **Statistics & Metrics** (Numbers, percentages, ratios, or costs)\n4. **Important Figures** (Key data points or major facts)\n\nInclude page numbers in parentheses for all facts.`;
        break;
    }

    return prompt;
  }
}
