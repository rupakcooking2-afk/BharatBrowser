/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";
import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";

export class nsBharatResearchExecutor {
  constructor(citationEngine) {
    this._citationEngine = citationEngine;
  }

  async executeSubtask(subtask) {
    console.log(`[Bharat Research] Executing: ${subtask.title}`);

    const query = subtask.searchQuery || subtask.title;

    await nsBrowserActionRegistry.execute("browser_action", {
      action: "search_web",
      query,
      description: `Research search: ${query}`,
    }, { skipApproval: false });

    await new Promise(r => setTimeout(r, 2500));

    let pageContent = "";
    try {
      const ctx = await gBrowserContextBus?.getTabContent();
      pageContent = ctx?.content?.substring(0, 6000) || "";
    } catch (e) {
      console.warn("[Bharat Research] Page extract failed:", e);
    }

    const sourceUrl = gBrowser.selectedBrowser?.currentURI?.spec || `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    this._citationEngine.addSource(subtask.title, sourceUrl, pageContent.substring(0, 500));

    let analysis = pageContent.substring(0, 1500) || `Research gathered for: ${subtask.title}`;

    if (pageContent.length > 200 && nsAIProviderManager.isConfigured()) {
      const approved = await nsBrowserActionApproval.requestDataExportApproval(
        "research page content",
        `Analyze extracted content for: ${subtask.title}`
      );
      if (approved) {
        try {
          const provider = nsAIProviderManager.getActiveProvider();
          analysis = await provider.generateText(
            `Summarize key findings for research subtask "${subtask.title}" from:\n${pageContent.substring(0, 8000)}`
          );
        } catch (e) {
          console.warn("[Bharat Research] AI analysis failed:", e);
        }
      }
    }

    return { title: subtask.title, content: analysis };
  }
}
