/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatResearchMemoryBridge {
  async saveToMemory(query, report, sources) {
    if (!window.gBharatMemoryManager) return;

    await gBharatMemoryManager.createMemory(
      `Research: ${query}`,
      `Topic: ${query}\nSummary: Research completed with ${sources.length} sources.\n\n${report.substring(0, 500)}...`,
      "research",
      ["deep-research", query],
      8,
      "research-agent"
    );
  }

  async getRelevantPDFData(query) {
    if (!window.gBharatMemoryManager) return [];
    const memories = await gBharatMemoryManager.getRelevantMemories(query);
    return memories.filter(
      m => m.type === "pdf-summary" || m.type === "pdf-fact" || m.type === "pdf-quote"
    );
  }
}
