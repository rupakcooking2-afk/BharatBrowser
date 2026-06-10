/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";
import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";

export class nsVoiceActionExecutor {
  static async execute(command) {
    console.log("[Bharat Voice] Executing action:", command);

    const needsApproval = !Services.prefs.getBoolPref("bharat.voice.autoExecute", false);
    if (needsApproval) {
      const desc = `${command.type}: ${command.action || command.query || command.title || ""}`;
      const approved = await nsBrowserActionApproval.requestApproval(
        command.type,
        `Voice command: ${desc}`,
        JSON.stringify(command)
      );
      if (!approved) return;
    }

    switch (command.type) {
      case "browser":
        await this._handleBrowserAction(command);
        break;
      case "navigation":
        this._handleNavigationAction(command);
        break;
      case "page":
        await this._handlePageAction(command);
        break;
      case "youtube":
        await this._handleYouTubeAction(command);
        break;
      case "research":
        await this._handleResearchAction(command);
        break;
      case "notes":
        await this._handleNotesAction(command);
        break;
      case "memory":
        await this._handleMemoryAction(command);
        break;
      case "search":
        await this._handleSearchAction(command);
        break;
      case "chat":
        await this._handleChatAction(command);
        break;
      case "agent":
        await this._handleAgentAction(command);
        break;
    }
  }

  static async _handleBrowserAction(command) {
    const map = {
      newTab: { action: "new_tab" },
      closeTab: { action: "close_tab" },
      reload: { action: "reload" },
      back: { action: "back" },
      forward: { action: "forward" },
      downloads: { action: "open_downloads" },
      history: { action: "open_history" },
      settings: { action: "open_settings" },
      bookmarks: { action: "open_bookmarks" },
      url: { action: "open_url", url: command.url },
    };
    const params = map[command.action];
    if (params) await nsBrowserActionRegistry.execute("browser_action", params);
  }

  static _handleNavigationAction(command) {
    const panelMap = {
      workspace: "workspace",
      notes: "notes",
      memory: "memory",
      chat: "chat",
      research: "research",
      agent: "agent",
      voice: "voice",
    };
    const panel = panelMap[command.target] || command.target;
    window.gBharatAISidebar?.selectTab(panel);
    if (!window.gBharatAISidebar?._isOpen) window.gBharatAISidebar?.toggle();
  }

  static async _handlePageAction(command) {
    if (!window.gPageIntelligenceManager) return;
    switch (command.action) {
      case "summarize":
        await window.gPageIntelligenceManager.summarizeCurrentPage();
        break;
      case "explain":
        await window.gPageIntelligenceManager.explainSelection();
        break;
      case "translate":
        await window.gPageIntelligenceManager.translateSelection();
        break;
    }
  }

  static async _handleYouTubeAction(command) {
    if (command.action === "open" || command.query) {
      const q = command.query || "youtube";
      await nsBrowserActionRegistry.execute("browser_action", {
        action: "open_url",
        url: q.includes("youtube") ? q : `https://youtube.com/results?search_query=${encodeURIComponent(q)}`,
      });
    }
    if (command.action === "summarize" && window.gYouTubeIntelligenceManager) {
      await window.gYouTubeIntelligenceManager.summarizeVideo();
    }
  }

  static async _handleResearchAction(command) {
    if (window.gBharatResearchManager) {
      window.gBharatAISidebar?.selectTab("research");
      await window.gBharatResearchManager.startResearch(command.query);
    }
  }

  static async _handleNotesAction(command) {
    await nsBrowserActionRegistry.execute("browser_action", {
      action: "create_note",
      title: command.title || "Voice Note",
      content: command.content || "",
    });
  }

  static async _handleMemoryAction(command) {
    await nsBrowserActionRegistry.execute("browser_action", {
      action: "save_memory",
      title: "Voice Memory",
      content: command.content,
    });
  }

  static async _handleSearchAction(command) {
    if (window.gBharatSearchManager) {
      window.gBharatAISidebar?.selectTab("search");
      await window.gBharatSearchManager.startSearch(command.query);
    }
  }

  static async _handleChatAction(command) {
    if (window.gBharatAISidebar && window.gBharatChatManager) {
      window.gBharatAISidebar.selectTab("chat");
      setTimeout(async () => {
        await window.gBharatChatManager.sendMessage(command.content);
      }, 300);
    }
  }

  static async _handleAgentAction(command) {
    if (window.gBharatAICore && command.query) {
      window.gBharatAISidebar?.selectTab("agent");
      await window.gBharatAICore.handleUserMessage(command.query);
    }
  }
}
