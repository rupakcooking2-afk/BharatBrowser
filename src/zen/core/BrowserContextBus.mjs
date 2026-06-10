/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Unified local browser context — tabs, history, bookmarks, workspace data.
 * Data stays on-device until explicitly approved for external AI calls.
 */
export class nsBrowserContextBus {
  getCurrentTabSnapshot() {
    const tab = gBrowser.selectedTab;
    if (!tab) return null;
    return this._tabToSnapshot(tab, true);
  }

  getAllTabSnapshots(includeContent = false) {
    return gBrowser.tabs.map(tab => this._tabToSnapshot(tab, includeContent));
  }

  getSelectedTabSnapshots(tabIds = null, includeContent = false) {
    const tabs = tabIds?.length
      ? gBrowser.tabs.filter(t => tabIds.includes(t.linkedBrowser?.browsingContext?.id))
      : [gBrowser.selectedTab];
    return tabs.filter(Boolean).map(tab => this._tabToSnapshot(tab, includeContent));
  }

  _tabToSnapshot(tab, includeContent) {
    const browser = tab.linkedBrowser;
    const url = browser?.currentURI?.spec || "";
    const snapshot = {
      tabId: tab.linkedBrowser?.browsingContext?.id,
      title: tab.label || browser?.contentTitle || "Untitled",
      url,
      pinned: tab.pinned,
      isPDF: url.endsWith(".pdf") || browser?.contentType === "application/pdf",
      isYouTube: /youtube\.com\/watch/.test(url),
    };

    if (includeContent && !snapshot.isPDF) {
      snapshot.contentPreview = null;
    }

    return snapshot;
  }

  async getTabContent(tab = gBrowser.selectedTab) {
    if (!tab) return null;
    const browser = tab.linkedBrowser;
    const url = browser?.currentURI?.spec || "";

    if (url.endsWith(".pdf") || browser?.contentType === "application/pdf") {
      const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
      let session = await gPDFIntelligenceManager?._sessionStore?.getSessionByUrl(url, workspaceId);
      if (!session && tab === gBrowser.selectedTab) {
        try {
          session = await gPDFIntelligenceManager?.getOrExtractPDF();
        } catch (e) {
          console.warn("[Bharat Context] PDF extract failed:", e);
        }
      }
      const fullText = session?.chunks?.map(c => c.text).join("\n") || session?.pages?.map(p => p.text).join("\n") || "";
      return {
        title: session?.title || tab.label,
        url,
        content: fullText.substring(0, 20000),
        type: "pdf",
      };
    }

    if (/youtube\.com\/watch/.test(url)) {
      const videoId = new URL(url).searchParams.get("v");
      let transcript = "";
      if (videoId && window.gYouTubeIntelligenceManager?._provider) {
        try {
          transcript = await gYouTubeIntelligenceManager._provider.getTranscript(videoId) || "";
        } catch (e) {}
      }
      return {
        title: tab.label.replace(" - YouTube", ""),
        url,
        content: transcript.substring(0, 20000),
        type: "youtube",
      };
    }

    if (window.gPageIntelligenceManager) {
      const prev = gBrowser.selectedTab;
      if (tab !== prev) gBrowser.selectedTab = tab;
      try {
        const ctx = await gPageIntelligenceManager.getCurrentPageContext();
        if (tab !== prev) gBrowser.selectedTab = prev;
        return ctx ? { ...ctx, type: "webpage" } : null;
      } catch (e) {
        if (tab !== prev) gBrowser.selectedTab = prev;
      }
    }
    return { title: tab.label, url, content: "", type: "webpage" };
  }

  async getMultiTabContent(tabs = null) {
    const targetTabs = tabs || gBrowser.tabs;
    const results = [];
    for (const tab of targetTabs) {
      try {
        const content = await this.getTabContent(tab);
        if (content) results.push(content);
      } catch (e) {
        console.warn("[Bharat Context] Tab content failed:", tab.label, e);
      }
    }
    return results;
  }

  async searchLocalHistory(query, limit = 20) {
    const results = [];
    try {
      const entries = await PlacesUtils.history.search({
        query,
        maxResults: limit,
      });
      for (const entry of entries) {
        results.push({
          title: entry.title || entry.url,
          url: entry.url,
          lastVisit: entry.lastVisit,
        });
      }
    } catch (e) {
      console.warn("[Bharat Context] History search failed:", e);
    }
    return results;
  }

  async searchBookmarks(query, limit = 20) {
    const results = [];
    try {
      const bookmarks = await PlacesUtils.bookmarks.search({ query, limit });
      for (const bm of bookmarks) {
        results.push({ title: bm.title || bm.url, url: bm.url, id: bm.guid });
      }
    } catch (e) {
      console.warn("[Bharat Context] Bookmark search failed:", e);
    }
    return results;
  }

  getDownloadsSnapshot(limit = 10) {
    try {
      return DownloadList.getAll().slice(0, limit).map(d => ({
        name: d.displayName,
        url: d.source?.spec,
        state: d.state,
        progress: d.percentComplete,
      }));
    } catch (e) {
      return [];
    }
  }

  async getWorkspaceContext() {
    const wsId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
    const ws = window.gBharatWorkspaceManager?.workspaces?.find(w => w.id === wsId);

    const notes = window.gBharatNotesManager
      ? await gBharatNotesManager.getNotes()
      : [];
    const memories = window.gBharatMemoryManager
      ? await gBharatMemoryManager.getMemories()
      : [];
    const research = window.gBharatResearchManager?._history || [];
    const chatSessions = window.gBharatChatManager?._sessions || [];

    return {
      workspaceId: wsId,
      workspaceName: ws?.name || "Personal",
      notes: notes.slice(0, 10).map(n => ({ id: n.id, title: n.title, preview: (n.content || "").substring(0, 200) })),
      memories: memories.slice(0, 10).map(m => ({ id: m.id, title: m.title, type: m.type })),
      research: research.slice(0, 5).map(r => ({ query: r.query, date: r.date })),
      chatSessions: chatSessions.slice(0, 5).map(s => ({ id: s.id, title: s.title })),
      openTabs: this.getAllTabSnapshots(false),
    };
  }

  buildLocalContextSummary() {
    const tabs = this.getAllTabSnapshots(false);
    const ws = window.gBharatWorkspaceManager?.activeWorkspaceId;
    return {
      activeTab: tabs.find(t => t.tabId === gBrowser.selectedBrowser?.browsingContext?.id) || tabs[0],
      tabCount: tabs.length,
      workspaceId: ws,
      timestamp: Date.now(),
    };
  }
}

window.gBrowserContextBus = new nsBrowserContextBus();
