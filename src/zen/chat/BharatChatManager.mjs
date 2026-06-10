/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";
import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";

export class nsBharatChatManager extends nsZenDOMOperatedFeature {
  _sessions = [];
  _allSessions = [];
  _activeSessionId = null;
  _db = null;

  static PREF_SESSIONS = "bharat.chat.sessions";

  async init() {
    this.loadSessions();
    await this.initDB();

    window.addEventListener("bharat-workspace-changed", () => {
      this.loadSessions();
      if (window.gBharatAISidebar?._currentTab === "chat") {
        window.gBharatAISidebar.refreshChatUI?.();
      }
    });
  }

  loadSessions() {
    try {
      this._allSessions = JSON.parse(Services.prefs.getStringPref(nsBharatChatManager.PREF_SESSIONS, "[]"));
    } catch (e) {
      this._allSessions = [];
    }

    const activeWorkspace = window.gBharatWorkspaceManager?.activeWorkspaceId;
    this._sessions = activeWorkspace
      ? this._allSessions.filter(s => s.workspaceId === activeWorkspace)
      : this._allSessions;
  }

  saveSessions() {
    Services.prefs.setStringPref(nsBharatChatManager.PREF_SESSIONS, JSON.stringify(this._allSessions));
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("BharatChatDB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("messages")) {
          db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
          db.transaction.objectStore("messages").createIndex("sessionId", "sessionId", { unique: false });
        }
      };
      request.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async createSession(title = "New Chat") {
    const id = crypto.randomUUID();
    const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
    const session = { id, title, timestamp: Date.now(), workspaceId };
    this._allSessions.unshift(session);
    this.saveSessions();
    this.loadSessions();
    this._activeSessionId = id;
    return session;
  }

  async deleteSession(id) {
    this._allSessions = this._allSessions.filter(s => s.id !== id);
    this.saveSessions();
    this.loadSessions();
    if (this._activeSessionId === id) this._activeSessionId = null;

    // Cleanup messages
    const tx = this._db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const index = store.index("sessionId");
    const cursorReq = index.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  async addMessage(sessionId, role, content) {
    return new Promise((resolve) => {
      const tx = this._db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      store.add({ sessionId, role, content, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
    });
  }

  async getMessages(sessionId) {
    return new Promise((resolve) => {
      const tx = this._db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const index = store.index("sessionId");
      const request = index.getAll(IDBKeyRange.only(sessionId));
      request.onsuccess = () => resolve(request.result);
    });
  }

  async sendMessage(content) {
    if (!nsAIProviderManager.isConfigured()) {
      throw new Error("AI Provider not configured. Please add an API key in settings.");
    }

    // Route through Bharat AI Core for agent/tab/browser intents
    if (window.gBharatAICore) {
      const routed = await gBharatAICore.handleUserMessage(content, { skipAgent: false });
      if (routed.handled) {
        if (routed.type === "agent" && routed.result?.summary) {
          if (!this._activeSessionId) await this.createSession(content.substring(0, 30) + "...");
          await this.addMessage(this._activeSessionId, "user", content);
          await this.addMessage(this._activeSessionId, "assistant", routed.result.summary);
          return (async function* () { yield routed.result.summary; })();
        }
        if (routed.type === "browser_action" && routed.result?.message) {
          if (!this._activeSessionId) await this.createSession(content.substring(0, 30) + "...");
          await this.addMessage(this._activeSessionId, "user", content);
          await this.addMessage(this._activeSessionId, "assistant", routed.result.message);
          return (async function* () { yield routed.result.message; })();
        }
        if (routed.type === "tab_intelligence") {
          return (async function* () { yield "Done — check chat for tab analysis."; })();
        }
      }
    }

    if (!this._activeSessionId) {
      await this.createSession(content.substring(0, 30) + "...");
    }

    const sessionId = this._activeSessionId;
    await this.addMessage(sessionId, "user", content);

    // Memory Integration (workspace-scoped)
    const relevantMemories = await gBharatMemoryManager.getRelevantMemories(content);
    let fullPrompt = content;

    const contextPrefix = window.gBharatAICore
      ? await gBharatAICore.buildChatContextPrefix(content)
      : "";

    if (contextPrefix) {
      fullPrompt = `Browser Context:\n${contextPrefix}\n\nUser: ${content}`;
    }

    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories.map(m => `- ${m.title}: ${m.content}`).join("\n");
      fullPrompt = `${fullPrompt}\n\nRelevant Memories:\n${memoryContext}`;
    }

    const history = await this.getMessages(sessionId);
    const provider = nsAIProviderManager.getActiveProvider();

    // Automatic Memory Creation (Async)
    this._processForMemory(content);

    return provider.generateStream(fullPrompt, history.slice(0, -1));
  }

  async _processForMemory(content) {
    const classification = gBharatMemoryClassifier.classify(content);
    if (classification.importance >= 7) {
      await gBharatMemoryManager.createMemory(
        content.substring(0, 30) + "...",
        content,
        classification.type,
        [],
        classification.importance,
        "chat"
      );
    }
  }

  async sendContextualMessage(prompt, pageContext) {
    if (!this._activeSessionId) {
      await this.createSession(pageContext?.title || "Page Analysis");
    }

    const sessionId = this._activeSessionId;
    let fullPrompt = prompt;

    if (pageContext) {
      fullPrompt = `You are analyzing the following webpage.\n\nTitle: ${pageContext.title}\nURL: ${pageContext.url}\n\nContent:\n${pageContext.content}\n\nUser Request: ${prompt}`;
    }

    const approved = await nsBrowserActionApproval.requestDataExportApproval(
      "page content",
      pageContext ? `"${pageContext.title}" — ${(pageContext.content || "").length} characters` : prompt
    );
    if (!approved) {
      gBharatAISidebar.appendMessage("assistant", "Analysis cancelled — no data was sent to AI.");
      return;
    }

    gBharatAISidebar.appendMessage("user", prompt);
    gBharatAISidebar.showTyping(true);

    try {
      const assistantBubble = gBharatAISidebar.appendMessage("assistant", "");
      let fullResponse = "";

      // We don't save the full contextual prompt to history to avoid bloat
      // Instead, we just save the user's short prompt
      await this.addMessage(sessionId, "user", prompt);

      const history = await this.getMessages(sessionId);
      const provider = nsAIProviderManager.getActiveProvider();

      const stream = await provider.generateStream(fullPrompt, history.slice(0, -1));
      for await (const token of stream) {
        fullResponse += token;
        assistantBubble.textContent = fullResponse;
        gBharatAISidebar.scrollToBottom();
      }

      await this.addMessage(sessionId, "assistant", fullResponse);
    } catch (e) {
      gBharatAISidebar.appendMessage("assistant", "Error: " + e.message);
    } finally {
      gBharatAISidebar.showTyping(false);
    }
  }
}

window.gBharatChatManager = new nsBharatChatManager();
