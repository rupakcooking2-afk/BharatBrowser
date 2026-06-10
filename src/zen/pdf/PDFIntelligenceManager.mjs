/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsPDFTextExtractor } from "chrome://browser/content/PDFTextExtractor.mjs";
import { nsPDFContextBuilder } from "chrome://browser/content/PDFContextBuilder.mjs";
import { nsPDFSearchIndex } from "chrome://browser/content/PDFSearchIndex.mjs";
import { nsPDFSessionStore } from "chrome://browser/content/PDFSessionStore.mjs";

export class nsPDFIntelligenceManager extends nsZenDOMOperatedFeature {
  _sessionStore = new nsPDFSessionStore();
  _activeSession = null;
  _searchIndex = null;
  _isExtracting = false;

  async init() {
    await this._sessionStore.init();
    console.log("[Bharat PDF] Manager initialized");

    // Watch for tab selections to update UI state
    window.addEventListener("TabSelect", () => this.updateUIState());

    // Watch for page location progress to detect PDFs
    const progressListener = {
      onLocationChange: (aBrowser) => {
        if (aBrowser === gBrowser.selectedBrowser) {
          this.updateUIState();
        }
      }
    };
    gBrowser.addProgressListener(progressListener);

    // Workspace change handler
    window.addEventListener("bharat-workspace-changed", () => {
      this._activeSession = null;
      this._searchIndex = null;
      this.updateUIState();
    });

    // Listen to PDF extraction progress events bubbling from content processes
    window.addEventListener("bharat-pdf-progress", (e) => {
      this._onProgress(e);
    }, { capture: true, wantsUntrusted: true });
  }

  updateUIState() {
    const isPDF = gBrowser.selectedBrowser?.contentType === "application/pdf";
    
    // Toggle toolbar
    const toolbar = document.getElementById("bharat-ai-pdf-toolbar");
    if (toolbar) {
      toolbar.hidden = !isPDF;
    }

    // Toggle nav item in sidebar
    const navItem = document.getElementById("bharat-ai-nav-pdf");
    if (navItem) {
      navItem.hidden = !isPDF;
    }

    // Update session indicators
    if (isPDF) {
      const title = gBrowser.selectedTab?.label.replace(".pdf", "");
      const titleLabel = document.getElementById("bharat-pdf-title-label");
      if (titleLabel) {
        titleLabel.value = title || "PDF Document";
      }
      
      const url = gBrowser.selectedBrowser.currentURI.spec;
      const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
      
      // Auto-load session if cached
      this._sessionStore.getSessionByUrl(url, workspaceId).then(session => {
        if (session) {
          this._activeSession = session;
          this._searchIndex = new nsPDFSearchIndex(session.chunks, session.pages);
          this.toggleContextBadge(true);
        } else {
          this._activeSession = null;
          this._searchIndex = null;
          this.toggleContextBadge(false);
        }
      });
    } else {
      this.toggleContextBadge(false);
      // If the PDF tab panel is selected but we switched to a non-PDF tab, fallback to chat
      if (window.gBharatAISidebar?._currentTab === "pdf") {
        window.gBharatAISidebar.selectTab("chat");
      }
    }
  }

  _onProgress(e) {
    const { page, total, percent } = e.detail;
    const progressBox = document.getElementById("bharat-pdf-status-box");
    const progressBar = document.getElementById("bharat-pdf-progress-bar");
    const progressText = document.getElementById("bharat-pdf-status-text");

    if (progressBox && progressBar && progressText) {
      progressBox.hidden = false;
      progressBar.style.width = `${percent}%`;
      progressText.value = `Extracting page ${page} of ${total} (${percent}%)`;
    }
  }

  toggleContextBadge(active) {
    const badge = document.getElementById("bharat-pdf-context-badge");
    if (badge) {
      badge.hidden = !active;
    }
  }

  async getOrExtractPDF() {
    if (this._activeSession) return this._activeSession;
    if (this._isExtracting) throw new Error("PDF extraction already in progress.");

    this._isExtracting = true;
    const progressBox = document.getElementById("bharat-pdf-status-box");
    const progressBar = document.getElementById("bharat-pdf-progress-bar");
    if (progressBox) progressBox.hidden = false;
    if (progressBar) progressBar.style.width = "0%";

    try {
      const browser = gBrowser.selectedBrowser;
      const url = browser.currentURI.spec;
      const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";

      // Re-check cache
      const cached = await this._sessionStore.getSessionByUrl(url, workspaceId);
      if (cached) {
        this._activeSession = cached;
        this._searchIndex = new nsPDFSearchIndex(cached.chunks, cached.pages);
        this.toggleContextBadge(true);
        return cached;
      }

      // Execute extraction script
      const script = nsPDFTextExtractor.getExtractionScript();
      const result = await browser.browsingContext.currentWindowGlobal.executeInGlobal(script);

      if (result.error) {
        throw new Error(result.error);
      }

      const chunks = nsPDFContextBuilder.buildChunks(result.pages, result.outline);
      const session = {
        id: "pdf_" + crypto.randomUUID(),
        workspaceId,
        title: result.title || gBrowser.selectedTab?.label.replace(".pdf", "") || "PDF Document",
        sourceUrl: url,
        pageCount: result.pageCount,
        extractedAt: Date.now(),
        outline: result.outline || [],
        chunks: chunks,
        pages: result.pages,
        indexId: "index_" + crypto.randomUUID()
      };

      await this._sessionStore.saveSession(session);
      this._activeSession = session;
      this._searchIndex = new nsPDFSearchIndex(session.chunks, session.pages);
      this.toggleContextBadge(true);
      return session;
    } finally {
      this._isExtracting = false;
      if (progressBox) progressBox.hidden = true;
    }
  }

  async summarizePDF() {
    try {
      const session = await this.getOrExtractPDF();
      const context = nsPDFContextBuilder.buildContext("summary", session);
      
      gBharatAISidebar.selectTab("chat");
      await gBharatChatManager.sendContextualMessage("Summarize PDF", {
        title: session.title,
        url: session.sourceUrl,
        content: context
      });

      // Async save to memory
      setTimeout(() => this.saveToMemory("pdf-summary", "PDF Summary: " + session.title), 2000);
    } catch (e) {
      console.error("[Bharat PDF] Summarization failed:", e);
    }
  }

  async explainPDF(style = "beginner") {
    try {
      const session = await this.getOrExtractPDF();
      const context = nsPDFContextBuilder.buildContext("explain", session, "", { style });

      gBharatAISidebar.selectTab("chat");
      await gBharatChatManager.sendContextualMessage(`Explain PDF (${style} mode)`, {
        title: session.title,
        url: session.sourceUrl,
        content: context
      });
    } catch (e) {
      console.error("[Bharat PDF] Explanation failed:", e);
    }
  }

  async extractKeyFacts() {
    try {
      const session = await this.getOrExtractPDF();
      const context = nsPDFContextBuilder.buildContext("facts", session);

      gBharatAISidebar.selectTab("chat");
      await gBharatChatManager.sendContextualMessage("Extract Key Facts", {
        title: session.title,
        url: session.sourceUrl,
        content: context
      });

      setTimeout(() => this.saveToMemory("pdf-fact", "PDF Facts: " + session.title), 2000);
    } catch (e) {
      console.error("[Bharat PDF] Facts extraction failed:", e);
    }
  }

  async generateTimeline() {
    try {
      const session = await this.getOrExtractPDF();
      const context = nsPDFContextBuilder.buildContext("timeline", session);

      gBharatAISidebar.selectTab("chat");
      await gBharatChatManager.sendContextualMessage("Generate PDF Timeline", {
        title: session.title,
        url: session.sourceUrl,
        content: context
      });
    } catch (e) {
      console.error("[Bharat PDF] Timeline generation failed:", e);
    }
  }

  async askPDF(query) {
    if (!query) return;
    try {
      const session = await this.getOrExtractPDF();
      
      const matches = this._searchIndex.search(query, 5);
      const context = nsPDFContextBuilder.buildContext("ask", session, query, { matches });

      const input = document.getElementById("bharat-pdf-ask-input");
      if (input) input.value = "";

      gBharatAISidebar.selectTab("chat");
      await gBharatChatManager.sendContextualMessage(query, {
        title: session.title,
        url: session.sourceUrl,
        content: context
      });

      setTimeout(() => this.saveToMemory("pdf-quote", `PDF QA: "${query}"`), 2000);
    } catch (e) {
      console.error("[Bharat PDF] Question failed:", e);
    }
  }

  async getLastAssistantMessage() {
    if (!gBharatChatManager._activeSessionId) return null;
    const messages = await gBharatChatManager.getMessages(gBharatChatManager._activeSessionId);
    const assistantMessages = messages.filter(m => m.role === "assistant");
    return assistantMessages[assistantMessages.length - 1]?.content || null;
  }

  async saveResultToNotes(type = "analysis") {
    if (!this._activeSession) return;
    const lastMsg = await this.getLastAssistantMessage();
    if (!lastMsg) return;

    let titlePrefix = "Analysis";
    if (lastMsg.includes("Summary")) titlePrefix = "Summary";
    if (lastMsg.includes("Facts")) titlePrefix = "Facts";
    if (lastMsg.includes("Timeline")) titlePrefix = "Timeline";

    await gBharatNotesManager.createNote(
      `${titlePrefix}: ${this._activeSession.title}`,
      lastMsg,
      "pdf-" + type,
      this._activeSession.sourceUrl
    );
    gBharatAISidebar.selectTab("notes");
  }

  async saveToMemory(type, title) {
    if (!this._activeSession) return;
    const lastMsg = await this.getLastAssistantMessage();
    if (!lastMsg) return;

    await gBharatMemoryManager.createMemory(
      title,
      lastMsg.substring(0, 800) + "...",
      type,
      ["pdf", this._activeSession.title],
      6,
      "pdf-intelligence"
    );
  }
}

window.gPDFIntelligenceManager = new nsPDFIntelligenceManager();
