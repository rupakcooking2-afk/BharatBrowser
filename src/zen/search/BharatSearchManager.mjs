/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";
import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";
import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";

export class nsBharatSearchManager extends nsZenDOMOperatedFeature {
  _history = [];
  _currentQuery = "";
  _isSearching = false;

  static PREF_HISTORY = "bharat.search.history";
  static HISTORY_LIMIT = 50;

  init() {
    this.loadHistory();
  }

  loadHistory() {
    try {
      const historyStr = Services.prefs.getStringPref(nsBharatSearchManager.PREF_HISTORY, "[]");
      this._history = JSON.parse(historyStr);
    } catch (e) {
      this._history = [];
    }
  }

  saveHistory() {
    Services.prefs.setStringPref(nsBharatSearchManager.PREF_HISTORY, JSON.stringify(this._history));
  }

  addToHistory(query) {
    const entry = { query, timestamp: Date.now() };
    this._history.unshift(entry);
    if (this._history.length > nsBharatSearchManager.HISTORY_LIMIT) {
      this._history.pop();
    }
    this.saveHistory();
  }

  async search(query) {
    return this.startSearch(query);
  }

  async startSearch(query) {
    if (!query) return;
    this._currentQuery = query;
    this._isSearching = true;
    this.addToHistory(query);

    gBharatAISidebar?.selectTab("search");
    this._setResultsLoading(query);

    const localSources = [];

    const historyHits = await gBrowserContextBus?.searchLocalHistory(query, 5) || [];
    historyHits.forEach(h => localSources.push({ title: h.title, url: h.url, type: "history" }));

    const bookmarkHits = await gBrowserContextBus?.searchBookmarks(query, 5) || [];
    bookmarkHits.forEach(b => localSources.push({ title: b.title, url: b.url, type: "bookmark" }));

    const notes = window.gBharatNotesManager ? await gBharatNotesManager.getNotes() : [];
    notes.filter(n => (n.title + n.content).toLowerCase().includes(query.toLowerCase())).slice(0, 3)
      .forEach(n => localSources.push({ title: n.title, url: `bharat://note/${n.id}`, type: "note" }));

    this._renderCitations(localSources);

    await nsBrowserActionRegistry.execute("browser_action", {
      action: "search_web",
      query,
      description: `Bharat Search: ${query}`,
    });

    let answer = `Local results for "${query}": ${localSources.length} match(es) from history, bookmarks, and notes.`;

    if (nsAIProviderManager.isConfigured()) {
      const approved = await nsBrowserActionApproval.requestDataExportApproval(
        "search synthesis",
        `Combine local results and web context for: ${query}`
      );

      if (approved) {
        try {
          let webContext = "";
          await new Promise(r => setTimeout(r, 2000));
          const tabCtx = await gBrowserContextBus?.getTabContent();
          webContext = tabCtx?.content?.substring(0, 6000) || "";

          const provider = nsAIProviderManager.getActiveProvider();
          answer = await provider.generateText(
            `Answer this query using local sources and web page content.\nQuery: ${query}\n\nLocal:\n${JSON.stringify(localSources)}\n\nWeb:\n${webContext}`
          );
        } catch (e) {
          answer += `\n\n(AI synthesis unavailable: ${e.message})`;
        }
      }
    }

    this._renderAnswer(answer);
    this._renderRelated(query);
    this._isSearching = false;
    return answer;
  }

  _setResultsLoading(query) {
    const resultsArea = document.getElementById("bharat-search-results-content");
    if (resultsArea) {
      resultsArea.textContent = `Searching locally and on the web for "${query}"...`;
    }
  }

  _renderCitations(sources) {
    const citationsArea = document.getElementById("bharat-search-citations-content");
    if (!citationsArea) return;
    citationsArea.innerHTML = "";

    if (!sources.length) {
      citationsArea.textContent = "No local sources found.";
      return;
    }

    for (const src of sources) {
      const card = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      card.className = "bharat-citation-card";
      card.innerHTML = `
        <div class="bharat-citation-info">
          <span class="bharat-citation-title">${src.title} (${src.type})</span>
          <span class="bharat-citation-url">${src.url}</span>
        </div>`;
      card.addEventListener("click", () => {
        if (src.url.startsWith("http")) openTrustedLinkIn(src.url, "tab");
      });
      citationsArea.appendChild(card);
    }
  }

  _renderAnswer(text) {
    const resultsArea = document.getElementById("bharat-search-results-content");
    if (resultsArea) resultsArea.textContent = text;
  }

  _renderRelated(query) {
    const relatedArea = document.getElementById("bharat-search-related-content");
    if (!relatedArea) return;
    relatedArea.innerHTML = "";

    const related = [
      `How does ${query} work?`,
      `Latest news about ${query}`,
      `${query} vs alternatives`,
      `Save ${query} to memory`,
    ];

    related.forEach(q => {
      const btn = document.createElementNS("http://www.w3.org/1999/xhtml", "html:button");
      btn.className = "bharat-related-item";
      btn.textContent = q;
      btn.addEventListener("click", () => this.startSearch(q));
      relatedArea.appendChild(btn);
    });
  }
}

window.gBharatSearchManager = new nsBharatSearchManager();
