/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";

/**
 * Browser-native action system — replaces desktop Jarvis browser_control.
 */
export class nsBrowserActionRegistry {
  static async execute(tool, parameters = {}, options = {}) {
    const action = tool === "browser_action" ? parameters.action : tool;
    const params = tool === "browser_action" ? parameters : { action: tool, ...parameters };

    if (nsBrowserActionApproval.requiresApproval(action, options)) {
      const approved = await nsBrowserActionApproval.requestApproval(
        action,
        params.description || `Execute: ${action}`,
        JSON.stringify(params, null, 0).substring(0, 300)
      );
      if (!approved) return { success: false, message: "Action cancelled by user." };
    }

    try {
      const result = await this._dispatch(action, params);
      return { success: true, message: result };
    } catch (e) {
      console.error("[Bharat Actions]", action, e);
      return { success: false, message: e.message };
    }
  }

  static async _dispatch(action, params) {
    switch (action) {
      case "open_url":
      case "go_to": {
        const url = this._normalizeUrl(params.url || params.query);
        openTrustedLinkIn(url, "tab", { relatedToCurrent: true });
        return `Opened ${url}`;
      }
      case "search_web":
      case "search": {
        const query = params.query || "";
        const engine = params.engine || "google";
        const bases = {
          google: "https://www.google.com/search?q=",
          bing: "https://www.bing.com/search?q=",
          duckduckgo: "https://duckduckgo.com/?q=",
        };
        const url = (bases[engine] || bases.google) + encodeURIComponent(query);
        openTrustedLinkIn(url, "tab");
        return `Searching for: ${query}`;
      }
      case "new_tab": {
        if (params.url) {
          openTrustedLinkIn(this._normalizeUrl(params.url), "tab");
          return `New tab: ${params.url}`;
        }
        BrowserOpenTab();
        return "New tab opened.";
      }
      case "close_tab":
        BrowserCloseTabOrWindow();
        return "Tab closed.";
      case "reload":
        BrowserReload();
        return "Page reloaded.";
      case "back":
        BrowserBack();
        return "Navigated back.";
      case "forward":
        BrowserForward();
        return "Navigated forward.";
      case "pin_tab": {
        const tab = gBrowser.selectedTab;
        if (tab) gBrowser.pinTab(tab);
        return "Tab pinned.";
      }
      case "bookmark_page": {
        const tab = gBrowser.selectedTab;
        if (tab) BookmarkingUI.bookmarkCurrentTab(true);
        return "Page bookmarked.";
      }
      case "open_downloads":
        BrowserDownloadsUI();
        return "Downloads opened.";
      case "open_history":
        PlacesCommandHook.showPlacesOrganizer("History");
        return "History opened.";
      case "open_bookmarks":
        PlacesCommandHook.showPlacesOrganizer("BookmarksMenu");
        return "Bookmarks opened.";
      case "open_settings":
        openPreferences();
        return "Settings opened.";
      case "open_sidebar": {
        const panel = params.panel || "chat";
        gBharatAISidebar?.selectTab(panel);
        if (!gBharatAISidebar?._isOpen) gBharatAISidebar?.toggle();
        return `Sidebar: ${panel}`;
      }
      case "open_workspace":
        gBharatAISidebar?.selectTab("workspace");
        if (!gBharatAISidebar?._isOpen) gBharatAISidebar?.toggle();
        return "Workspace panel opened.";
      case "create_note": {
        const title = params.title || params.query || "AI Note";
        const content = params.content || "";
        await gBharatNotesManager?.createNote(title, content);
        gBharatAISidebar?.selectTab("notes");
        return `Note created: ${title}`;
      }
      case "save_memory": {
        await gBharatMemoryManager?.createMemory(
          params.title || "Browser Memory",
          params.content || params.query || "",
          params.type || "general",
          params.tags || ["browser-agent"]
        );
        return "Memory saved.";
      }
      case "start_research": {
        const query = params.query || params.title;
        if (query && gBharatResearchManager) {
          gBharatAISidebar?.selectTab("research");
          await gBharatResearchManager.startResearch(query);
          return `Research started: ${query}`;
        }
        return "No research query provided.";
      }
      case "summarize_page":
        await gPageIntelligenceManager?.summarizeCurrentPage();
        return "Page summarized.";
      case "read_tab_text": {
        const ctx = await gBrowserContextBus?.getTabContent();
        return ctx?.content?.substring(0, 4000) || "No content extracted.";
      }
      case "search_history": {
        const results = await gBrowserContextBus?.searchLocalHistory(params.query || "", 10) || [];
        return results.map(r => `${r.title}: ${r.url}`).join("\n") || "No history matches.";
      }
      case "search_bookmarks": {
        const results = await gBrowserContextBus?.searchBookmarks(params.query || "", 10) || [];
        return results.map(r => `${r.title}: ${r.url}`).join("\n") || "No bookmark matches.";
      }
      case "group_tabs":
        return "Tab grouping requested (Zen Spaces integration pending).";
      default:
        throw new Error(`Unknown browser action: ${action}`);
    }
  }

  static _normalizeUrl(url) {
    if (!url) return "about:blank";
    url = url.trim();
    if (url.includes("://")) return url;
    if (!url.includes(".")) url = url + ".com";
    return "https://" + url;
  }

  static getToolSchema() {
    return [
      "browser_action: open_url, search_web, new_tab, close_tab, reload, back, forward",
      "pin_tab, bookmark_page, open_downloads, open_history, open_bookmarks",
      "open_sidebar, open_workspace, create_note, save_memory, start_research",
      "summarize_page, read_tab_text, search_history, search_bookmarks",
    ].join("\n");
  }
}
