/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";

export const BHARAT_AI_CORE_PROMPT = `You are Bharat Browser AI Core — the intelligence engine of Bharat Browser.
You operate inside the browser as a native AI operating assistant (evolved from MARK XXXIX).

IDENTITY:
- You are Bharat AI, integrated with Bharat Notes, Memory, Research, Workspace, PDF Intelligence, and Voice.
- The browser is the primary workspace — tabs, history, bookmarks, downloads, notes, and memories are your context.

CORE BEHAVIOR:
- Prefer local data (IndexedDB, prefs, tab extraction) before external reasoning.
- Use Gemini only for reasoning when the user approves data sharing.
- Never send browsing history, notes, PDFs, or tab content to external AI without explicit user approval.
- For multi-step goals (research, compare tabs, open sources, save notes), delegate to agent mode.

CAPABILITIES:
- Read current tab, selected tabs, or all tabs (with approval for AI analysis).
- Open URLs, search web, manage tabs, bookmarks, history, downloads.
- Create notes, save memories, run deep research, analyze PDFs.
- Workspace-scoped context for notes, memories, research, chat, PDF sessions.

When the user asks for autonomous work, respond briefly then execute via the browser agent.`;

/**
 * Central orchestrator — MARK XXXIX transformed into browser-native AI OS core.
 */
export class nsBharatAICore extends nsZenDOMOperatedFeature {
  _initialized = false;

  init() {
    if (this._initialized) return;
    this._initialized = true;

    window.addEventListener("TabSelect", () => this._onTabSelect());
    window.addEventListener("bharat-workspace-changed", () => this._onWorkspaceChanged());

    console.log("[Bharat AI Core] Initialized — browser-native AI operating system ready.");
  }

  _onTabSelect() {
    window.dispatchEvent(new CustomEvent("bharat-tab-context-changed", {
      detail: gBrowserContextBus?.buildLocalContextSummary(),
    }));
  }

  _onWorkspaceChanged() {
    window.dispatchEvent(new CustomEvent("bharat-workspace-context-changed", {
      detail: { workspaceId: gBharatWorkspaceManager?.activeWorkspaceId },
    }));
  }

  async getFullContext(options = {}) {
    const includeWorkspace = options.workspace !== false;
    const includeTabs = options.tabs !== false;

    const ctx = {
      summary: gBrowserContextBus?.buildLocalContextSummary(),
      currentTab: includeTabs ? await gBrowserContextBus?.getTabContent() : null,
    };

    if (includeWorkspace) {
      ctx.workspace = await gBrowserContextBus?.getWorkspaceContext();
    }

    return ctx;
  }

  async buildChatContextPrefix(userMessage) {
    const parts = [];
    const summary = gBrowserContextBus?.buildLocalContextSummary();
    const ws = await gBrowserContextBus?.getWorkspaceContext();

    if (summary?.activeTab) {
      parts.push(`Active tab: "${summary.activeTab.title}" (${summary.activeTab.url})`);
    }
    parts.push(`Open tabs: ${summary?.tabCount || 0}`);
    parts.push(`Workspace: ${ws?.workspaceName || "Personal"}`);

    const relevantMemories = await gBharatMemoryManager?.getRelevantMemories(userMessage);
    if (relevantMemories?.length) {
      parts.push("Relevant memories:\n" + relevantMemories.map(m => `- ${m.title}: ${m.content}`).join("\n"));
    }

    return parts.join("\n");
  }

  detectIntent(message) {
    const lower = message.toLowerCase().trim();

    const tabCmd = gTabIntelligenceManager?.detectCommand(message);
    if (tabCmd) return { type: "tab_intelligence", command: tabCmd };

    if (/^(research|deep research)\s+/i.test(message)) {
      return { type: "agent", goal: message };
    }
    if (/^(agent|autonomous|do this for me)\s*[:\-]?\s*/i.test(message)) {
      return { type: "agent", goal: message.replace(/^(agent|autonomous|do this for me)\s*[:\-]?\s*/i, "") };
    }
    if (lower.startsWith("open ") && !lower.includes("?")) {
      const target = message.replace(/^open\s+/i, "").trim();
      if (target && target.split(" ").length <= 4) {
        return { type: "browser_action", action: "open_url", url: target };
      }
    }
    if (/^search (for |the web for )?/i.test(message)) {
      return { type: "browser_action", action: "search_web", query: message.replace(/^search (for |the web for )?/i, "") };
    }

    return { type: "chat" };
  }

  async handleUserMessage(message, options = {}) {
    const intent = this.detectIntent(message);

    switch (intent.type) {
      case "tab_intelligence": {
        const mgr = gTabIntelligenceManager;
        switch (intent.command) {
          case "summarize_all": await mgr.summarizeAllTabs(); break;
          case "compare": await mgr.compareTabs(); break;
          case "research_report": await mgr.createResearchReportFromTabs(); break;
          case "save_important": await mgr.saveImportantFromTabs(); break;
        }
        return { handled: true, type: "tab_intelligence" };
      }
      case "browser_action": {
        const result = await nsBrowserActionRegistry.execute(intent.action, {
          action: intent.action,
          url: intent.url,
          query: intent.query,
        });
        return { handled: true, type: "browser_action", result };
      }
      case "agent": {
        if (options.skipAgent) return { handled: false };
        gBharatAISidebar?.selectTab("agent");
        const ctx = await this.buildChatContextPrefix(message);
        const result = await gBharatAgentExecutor.execute(intent.goal || message, {
          context: ctx,
          onProgress: (phase, data) => gBharatAISidebar?.updateAgentProgress?.(phase, data),
        });
        return { handled: true, type: "agent", result };
      }
      default:
        return { handled: false };
    }
  }

  getModuleAPI() {
    return {
      notes: gBharatNotesManager,
      memory: gBharatMemoryManager,
      research: gBharatResearchManager,
      workspace: gBharatWorkspaceManager,
      pdf: gPDFIntelligenceManager,
      voice: gVoiceManager,
      chat: gBharatChatManager,
      search: gBharatSearchManager,
      page: gPageIntelligenceManager,
      tabs: gTabIntelligenceManager,
      agent: gBharatAgentExecutor,
      context: gBrowserContextBus,
      actions: nsBrowserActionRegistry,
      taskManager: gAgentTaskManager,
      memoryBridge: gAgentMemoryBridge,
      auditLog: gAgentAuditLog,
    };
  }
}

window.gBharatAICore = new nsBharatAICore();
