/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

export class nsBharatAISidebar extends nsZenDOMOperatedFeature {
  _isOpen = false;
  _currentTab = "chat";
  _width = 300;

  static PREF_OPEN = "bharat.ai.sidebar.open";
  static PREF_WIDTH = "bharat.ai.sidebar.width";
  static PREF_TAB = "bharat.ai.sidebar.last-tab";

  init() {
    this._isOpen = Services.prefs.getBoolPref(nsBharatAISidebar.PREF_OPEN, false);
    this._width = Services.prefs.getIntPref(nsBharatAISidebar.PREF_WIDTH, 300);
    this._currentTab = Services.prefs.getStringPref(nsBharatAISidebar.PREF_TAB, "chat");

    this.applyState();
    this.setupSplitter();

    window.addEventListener("bharat-workspace-changed", () => {
      this._refreshCurrentTabUI();
    });

    window.addEventListener("bharat-workspace-ai-status", () => {
      if (this._currentTab === "workspace-ai") {
        this.refreshWorkspaceAIStatus();
      }
    });
  }

  get sidebar() {
    return document.getElementById("bharat-ai-sidebar");
  }

  get splitter() {
    return document.getElementById("ai-window-splitter");
  }

  get deck() {
    return document.getElementById("bharat-ai-deck");
  }

  applyState() {
    if (!this.sidebar) return;

    this.sidebar.hidden = !this._isOpen;
    this.splitter.collapsed = !this._isOpen;

    if (this._isOpen) {
      this.sidebar.style.setProperty("--bharat-ai-sidebar-width", `${this._width}px`);
      this.selectTab(this._currentTab);
    }
  }

  setupSplitter() {
    if (!this.splitter) return;

    this.splitter.addEventListener("mousemove", () => {
      if (this.splitter.dragging) {
        this._width = this.sidebar.getBoundingClientRect().width;
        Services.prefs.setIntPref(nsBharatAISidebar.PREF_WIDTH, this._width);
      }
    });
  }

  toggle() {
    this._isOpen = !this._isOpen;
    Services.prefs.setBoolPref(nsBharatAISidebar.PREF_OPEN, this._isOpen);
    this.applyState();
  }

  async sendChatMessage() {
    const input = document.getElementById("bharat-chat-input");
    const content = input.value.trim();
    if (!content) return;

    input.value = "";
    this.appendMessage("user", content);
    this.showTyping(true);

    try {
      const assistantBubble = this.appendMessage("assistant", "");
      let fullResponse = "";

      const stream = await gBharatChatManager.sendMessage(content);
      for await (const token of stream) {
        fullResponse += token;
        assistantBubble.textContent = fullResponse;
        this.scrollToBottom();
      }

      if (gBharatChatManager._activeSessionId) {
        const existing = await gBharatChatManager.getMessages(gBharatChatManager._activeSessionId);
        const last = existing[existing.length - 1];
        if (!last || last.role !== "assistant" || last.content !== fullResponse) {
          await gBharatChatManager.addMessage(gBharatChatManager._activeSessionId, "assistant", fullResponse);
        }
      }

      if (window.gVoiceManager) {
        window.gVoiceManager.speak(fullResponse);
      }
    } catch (e) {
      this.appendMessage("assistant", "Error: " + e.message);
    } finally {
      this.showTyping(false);
    }
  }

  appendMessage(role, content) {
    const container = document.getElementById("bharat-chat-messages");
    const bubble = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
    bubble.className = "bharat-chat-bubble";
    bubble.setAttribute("role", role);
    bubble.textContent = content;
    container.appendChild(bubble);
    this.scrollToBottom();
    return bubble;
  }

  showTyping(show) {
    document.getElementById("bharat-chat-typing-indicator").hidden = !show;
    this.scrollToBottom();
  }

  scrollToBottom() {
    const container = document.getElementById("bharat-chat-messages");
    container.scrollTop = container.scrollHeight;
  }

  showTranslateMenu(anchor) {
    const languages = ["Hindi", "English", "French", "German", "Spanish"];
    const menu = document.createXULElement("menupopup");
    languages.forEach(lang => {
      const item = document.createXULElement("menuitem");
      item.setAttribute("label", lang);
      item.addEventListener("command", () => gPageIntelligenceManager.translateSelection(lang));
      menu.appendChild(item);
    });
    anchor.appendChild(menu);
    menu.openPopup(anchor, "after_start");
  }

  handleChatKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  async createNewChat() {
    const session = await gBharatChatManager.createSession();
    // Clear messages UI for new session
    const container = document.getElementById("bharat-chat-messages");
    if (container) container.innerHTML = "";
    gBharatChatManager._activeSessionId = session.id;
  }

  async createNewNote() {
    const note = await gBharatNotesManager.createNote();
    this.refreshNotesList();
    this.openNote(note.id);
  }

  async refreshNotesList() {
    const notes = await gBharatNotesManager.getNotes();
    const container = document.getElementById("bharat-notes-list");
    container.innerHTML = "";

    notes.forEach(note => {
      const card = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      card.className = "bharat-note-card";
      card.textContent = note.title || "Untitled Note";
      card.addEventListener("click", () => this.openNote(note.id));
      if (note.id === gBharatNotesManager._activeNoteId) {
        card.setAttribute("selected", "true");
      }
      container.appendChild(card);
    });
  }

  async openNote(id) {
    const note = await gBharatNotesManager._db.getNote(id);
    if (!note) return;

    gBharatNotesManager._activeNoteId = id;
    document.getElementById("bharat-note-title-input").value = note.title;
    document.getElementById("bharat-note-editor").value = note.content;
    this.refreshNotesList();
  }

  handleNoteInput() {
    clearTimeout(gBharatNotesManager._autoSaveTimer);
    gBharatNotesManager._autoSaveTimer = setTimeout(async () => {
      const title = document.getElementById("bharat-note-title-input").value;
      const content = document.getElementById("bharat-note-editor").value;

      const note = await gBharatNotesManager._db.getNote(gBharatNotesManager._activeNoteId);
      if (note) {
        note.title = title;
        note.content = content;
        note.updatedAt = Date.now();
        await gBharatNotesManager._db.saveNote(note);
        this.refreshNotesList();
      }
    }, 2000);
  }

  async refreshMemoryList() {
    const query = document.getElementById("bharat-memory-search").value;
    const memories = await gBharatMemoryManager.getMemories();
    const filteredMemories = gBharatMemorySearch.search(query, memories);

    const container = document.getElementById("bharat-memory-list");
    container.innerHTML = "";

    filteredMemories.forEach(mem => {
      const card = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      card.className = "bharat-memory-card";

      const header = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      header.className = "bharat-memory-card-header";

      const title = document.createElementNS("http://www.w3.org/1999/xhtml", "html:span");
      title.className = "bharat-memory-title";
      title.textContent = mem.title;

      const type = document.createElementNS("http://www.w3.org/1999/xhtml", "html:span");
      type.className = "bharat-memory-type";
      type.textContent = mem.type;

      const content = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      content.className = "bharat-memory-content";
      content.textContent = mem.content;

      header.appendChild(title);
      header.appendChild(type);
      card.appendChild(header);
      card.appendChild(content);
      container.appendChild(card);
    });
  }

  async startResearch(query) {
    const input = document.getElementById("bharat-research-input");
    input.value = "";
    document.getElementById("bharat-research-status").hidden = false;
    document.getElementById("bharat-research-results-area").innerHTML = "";

    const report = await gBharatResearchManager.startResearch(query);

    if (report) {
      const reportDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      reportDiv.className = "bharat-research-report";
      reportDiv.textContent = report;
      document.getElementById("bharat-research-results-area").appendChild(reportDiv);
    }
  }

  refreshResearchUI() {
    const statusDiv = document.getElementById("bharat-research-status");
    if (!statusDiv) return;

    const isRunning = gBharatResearchManager._isRunning;
    statusDiv.hidden = !isRunning && gBharatResearchManager._currentTasks.length === 0;

    const progress = document.getElementById("bharat-research-progress-bar");
    const completedTasks = gBharatResearchManager._currentTasks.filter(t => t.status === "completed").length;
    const totalTasks = gBharatResearchManager._currentTasks.length;
    const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    progress.style.width = `${percentage}%`;

    const taskList = document.getElementById("bharat-research-tasks-list");
    if (taskList) {
      taskList.innerHTML = "";
      for (const task of gBharatResearchManager._currentTasks) {
        const item = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
        item.className = "bharat-agent-task-item";
        item.setAttribute("status", task.status || "pending");
        item.textContent = task.title;
        taskList.appendChild(item);
      }
    }
  }

  async startAgentTask(query) {
    if (!query?.trim()) return;
    const input = document.getElementById("bharat-agent-input");
    if (input) input.value = "";

    this._clearAgentUI();
    this._appendAgentLog(`Starting: ${query}`);

    if (window.gBharatAICore) {
      const ctx = await gBharatAICore.buildChatContextPrefix(query);
      const result = await gBharatAgentExecutor.execute(query, {
        context: ctx,
        onProgress: (phase, data) => this.updateAgentProgress(phase, data),
      });
      this._appendAgentLog(result.summary || (result.success ? "Complete." : "Failed."));
      this.refreshAgentTaskQueue();
    }
  }

  updateAgentProgress(phase, data) {
    const progress = document.getElementById("bharat-agent-progress-bar");
    const taskList = document.getElementById("bharat-agent-tasks-list");

    if (phase === "planning" && data.steps && taskList) {
      taskList.innerHTML = "";
      for (const step of data.steps) {
        const item = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
        item.className = "bharat-agent-task-item";
        item.id = `bharat-agent-step-${step.step}`;
        item.setAttribute("status", step.status || "pending");
        item.textContent = `Step ${step.step}: ${step.description}`;
        taskList.appendChild(item);
      }
      if (progress) progress.style.width = "10%";
    }

    if (phase === "step_start" && data.step) {
      const el = document.getElementById(`bharat-agent-step-${data.step.step}`);
      if (el) el.setAttribute("status", "running");
      this._appendAgentLog(`Running: ${data.step.description}`);
    }

    if (phase === "step_done" && data.step) {
      const el = document.getElementById(`bharat-agent-step-${data.step.step}`);
      if (el) el.setAttribute("status", "completed");
      const total = gBharatAgentExecutor._currentSteps?.length || 1;
      const done = gBharatAgentExecutor._currentSteps?.filter(s => s.status === "completed").length || 0;
      if (progress) progress.style.width = `${Math.round((done / total) * 100)}%`;
    }

    if (phase === "step_done" && data.step) {
      this.refreshAgentTaskQueue();
    }

    if (phase === "complete" && progress) {
      progress.style.width = "100%";
      this._appendAgentLog(data.summary || "Agent complete.");
      this.refreshAgentTaskQueue();
    }
  }

  _clearAgentUI() {
    const log = document.getElementById("bharat-agent-log");
    const tasks = document.getElementById("bharat-agent-tasks-list");
    const progress = document.getElementById("bharat-agent-progress-bar");
    if (log) log.textContent = "";
    if (tasks) tasks.innerHTML = "";
    if (progress) progress.style.width = "0%";
  }

  _appendAgentLog(line) {
    const log = document.getElementById("bharat-agent-log");
    if (log) {
      log.textContent += (log.textContent ? "\n" : "") + line;
      log.scrollTop = log.scrollHeight;
    }
  }

  async refreshAgentTaskQueue() {
    const queueList = document.getElementById("bharat-agent-task-queue-list");
    const runningList = document.getElementById("bharat-agent-running-tasks-list");
    const completedList = document.getElementById("bharat-agent-completed-tasks-list");
    const failedList = document.getElementById("bharat-agent-failed-tasks-list");
    if (!queueList) return;

    const tasks = window.gAgentTaskManager?.tasks || [];

    this._renderTaskList(queueList, tasks.filter(t => t.status === "queued"), "queued");
    this._renderTaskList(runningList, tasks.filter(t => t.status === "running"), "running");
    this._renderTaskList(completedList, tasks.filter(t => t.status === "completed"), "completed");
    this._renderTaskList(failedList, tasks.filter(t => t.status === "failed"), "failed");

    this._updateAgentStatusLabel();
  }

  _renderTaskList(container, tasks, status) {
    container.innerHTML = "";
    if (!tasks.length) {
      const empty = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      empty.className = "bharat-agent-task-empty";
      empty.textContent = "No tasks";
      container.appendChild(empty);
      return;
    }
    for (const task of tasks) {
      const item = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      item.className = "bharat-agent-task-card";
      item.setAttribute("status", status);

      const goalText = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      goalText.className = "bharat-agent-task-goal";
      goalText.textContent = task.goal.substring(0, 80) + (task.goal.length > 80 ? "..." : "");

      const meta = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      meta.className = "bharat-agent-task-meta";
      const stepCount = task.steps?.length || 0;
      const timeStr = task.createdAt ? new Date(task.createdAt).toLocaleTimeString() : "";
      meta.textContent = `${stepCount} steps · ${timeStr}`;

      item.appendChild(goalText);
      item.appendChild(meta);
      container.appendChild(item);
    }
  }

  _updateAgentStatusLabel() {
    const label = document.getElementById("bharat-agent-status-label");
    if (!label) return;
    const running = gAgentTaskManager?.runningTasks?.length || 0;
    const queued = gAgentTaskManager?.queuedTasks?.length || 0;
    const completed = gAgentTaskManager?.completedTasks?.length || 0;
    if (running > 0) {
      label.setAttribute("data-l10n-id", "bharat-agent-status-running");
    } else if (completed > 0) {
      label.setAttribute("data-l10n-id", "bharat-agent-status-completed");
    } else {
      label.setAttribute("data-l10n-id", "bharat-agent-status-idle");
    }
    document.l10n.translateFragment(label);
  }

  clearAgentTasks() {
    window.gAgentTaskManager?.clearCompleted();
    this.refreshAgentTaskQueue();
  }

  updateVoiceStatus(status, error) {
    const container = document.getElementById("bharat-voice-container");
    const label = document.getElementById("bharat-voice-status-label");
    const btn = document.getElementById("bharat-voice-toggle-btn");

    if (!container || !label || !btn) return;

    container.setAttribute("status", status);

    let statusText = "voice-status-idle";
    let btnText = "voice-start";

    switch (status) {
      case "listening":
        statusText = "voice-status-listening";
        btnText = "voice-stop";
        break;
      case "processing":
        statusText = "voice-status-processing";
        btnText = "voice-stop";
        break;
      case "speaking":
        statusText = "voice-status-speaking";
        btnText = "voice-stop";
        break;
      case "error":
        statusText = "voice-status-error";
        btnText = "voice-start";
        if (error) {
          console.error("[Bharat Voice] Error:", error);
        }
        break;
    }

    label.setAttribute("data-l10n-id", statusText);
    btn.setAttribute("data-l10n-id", btnText);
    document.l10n.translateFragment(container);
  }

  updateVoiceTranscript(transcript) {
    const text = document.getElementById("bharat-voice-transcript-text");
    if (text) {
      text.textContent = transcript;
      const area = document.getElementById("bharat-voice-transcript-area");
      if (area) area.scrollTop = area.scrollHeight;
    }
  }

  updateVoiceCommand(command) {
    const text = document.getElementById("bharat-voice-command-text");
    if (text) {
      text.textContent = `Type: ${command.type} | Action: ${command.action || command.query || command.title || "n/a"}`;
    }
  }

  toggleVoiceSettings() {
    const panel = document.getElementById("bharat-voice-settings-panel");
    if (panel) {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        // Load current prefs into UI
        document.getElementById("bharat-voice-wakeword-check").checked = Services.prefs.getBoolPref("bharat.voice.wakeword", false);
        document.getElementById("bharat-voice-tts-check").checked = Services.prefs.getBoolPref("bharat.voice.tts.enabled", true);
      }
    }
  }

  updateVoicePref(name, value) {
    const prefName = `bharat.voice.${name}`;
    if (typeof value === "boolean") {
      Services.prefs.setBoolPref(prefName, value);
    } else {
      Services.prefs.setCharPref(prefName, value.toString());
    }

    if (name === "wakeword") {
      if (value) window.gVoiceManager._wakeword.start();
      else window.gVoiceManager._wakeword.stop();
    }
  }

  selectTab(tabId) {
    this._currentTab = tabId;
    Services.prefs.setStringPref(nsBharatAISidebar.PREF_TAB, tabId);

    const items = document.querySelectorAll(".bharat-ai-nav-item");
    items.forEach(item => {
      item.setAttribute("selected", item.id === `bharat-ai-nav-${tabId}`);
    });

    const deck = this.deck;
    const panel = document.getElementById(`bharat-ai-panel-${tabId}`);
    if (deck && panel) {
      const index = Array.from(deck.children).indexOf(panel);
      if (index !== -1) {
        deck.selectedIndex = index;
      }
    }

    // Tab specific initialization
    if (tabId === "notes") this.refreshNotesList();
    if (tabId === "memory") this.refreshMemoryList();
    if (tabId === "workspace") this.refreshWorkspaceList();
    if (tabId === "workspace-ai") {
      this.refreshWorkspaceAIStatus();
    }
    if (tabId === "pdf") window.gPDFIntelligenceManager.updateUIState();
    if (tabId === "voice") {
      if (!window.gVoiceManager._recognition) {
        window.gVoiceManager.init();
      }
    }
    if (tabId === "agent") {
      this._clearAgentUI();
      this.refreshAgentTaskQueue();
    }
  }

  _refreshCurrentTabUI() {
    if (this._currentTab === "chat") {
      gBharatChatManager.loadSessions();
      this._refreshChatSessionList();
    }
    if (this._currentTab === "notes") this.refreshNotesList();
    if (this._currentTab === "memory") this.refreshMemoryList();
    if (this._currentTab === "workspace") this.refreshWorkspaceList();
    if (this._currentTab === "workspace-ai") this.refreshWorkspaceAIStatus();
    if (this._currentTab === "agent") this.refreshAgentTaskQueue();
    if (this._currentTab === "pdf") window.gPDFIntelligenceManager.updateUIState();
  }

  _refreshChatSessionList() {
    // Refresh chat session list UI if visible
    const container = document.getElementById("bharat-chat-session-list");
    if (!container) return;
    container.innerHTML = "";
    // Session list rendering handled by existing chat code
  }

  refreshChatUI() {
    this._refreshChatSessionList();
  }

  // ==================== Workspace UI ====================

  async refreshWorkspaceList() {
    if (!window.gBharatWorkspaceManager?.isReady) return;

    const container = document.getElementById("bharat-workspace-list");
    if (!container) return;
    container.innerHTML = "";

    const workspaces = window.gBharatWorkspaceManager.workspaces;
    const activeId = window.gBharatWorkspaceManager.activeWorkspaceId;
    const counts = await window.gBharatWorkspaceManager.getWorkspaceCounts();

    for (const ws of workspaces) {
      const card = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      card.className = "bharat-workspace-card";
      if (ws.id === activeId) {
        card.setAttribute("selected", "true");
      }

      // Color dot
      const colorDot = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      colorDot.className = "bharat-workspace-color-dot";
      colorDot.style.backgroundColor = ws.color;

      // Icon
      const icon = document.createElementNS("http://www.w3.org/1999/xhtml", "html:span");
      icon.className = "bharat-workspace-icon";
      icon.textContent = ws.icon;

      // Info
      const info = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      info.className = "bharat-workspace-info";

      const name = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      name.className = "bharat-workspace-name";
      name.textContent = ws.name;

      const wsCounts = counts[ws.id] || { chats: 0, notes: 0, memories: 0, research: 0 };
      const countsEl = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      countsEl.className = "bharat-workspace-counts";
      countsEl.textContent = [
        wsCounts.chats ? `${wsCounts.chats} chats` : "",
        wsCounts.notes ? `${wsCounts.notes} notes` : "",
        wsCounts.memories ? `${wsCounts.memories} memories` : "",
        wsCounts.research ? `${wsCounts.research} research` : "",
      ].filter(Boolean).join(" · ") || "Empty";

      info.appendChild(name);
      info.appendChild(countsEl);

      // Actions
      const actions = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      actions.className = "bharat-workspace-card-actions";

      if (ws.id !== "default-personal") {
        const deleteBtn = document.createElementNS("http://www.w3.org/1999/xhtml", "html:span");
        deleteBtn.className = "bharat-workspace-action-btn";
        deleteBtn.textContent = "×";
        deleteBtn.title = "Delete workspace";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this._deleteWorkspace(ws);
        });
        actions.appendChild(deleteBtn);
      }

      card.appendChild(colorDot);
      card.appendChild(icon);
      card.appendChild(info);
      card.appendChild(actions);

      card.addEventListener("click", () => {
        window.gBharatWorkspaceManager.switchWorkspace(ws.id);
      });

      container.appendChild(card);
    }
  }

  async showCreateWorkspaceModal() {
    const colors = ["#6C63FF", "#FF6B6B", "#4ECDC4", "#FFD93D", "#6BCB77", "#FF8E53", "#9B59B6", "#3498DB"];
    const icons = ["📁", "💼", "🔬", "🎨", "📚", "🏠", "🎯", "🧪", "🛠️", "💡"];

    // Create overlay
    const overlay = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
    overlay.id = "bharat-workspace-modal-overlay";

    let selectedColor = colors[0];

    // Build modal HTML
    overlay.innerHTML = `
      <div id="bharat-workspace-modal">
        <div class="bharat-modal-title">New Workspace</div>
        <div class="bharat-modal-field">
          <label>Name</label>
          <input type="text" id="bharat-modal-ws-name" placeholder="Workspace name" />
        </div>
        <div class="bharat-modal-field">
          <label>Color</label>
          <div class="bharat-modal-colors" id="bharat-modal-colors"></div>
        </div>
        <div class="bharat-modal-actions">
          <button class="bharat-modal-btn bharat-modal-btn-secondary" id="bharat-modal-cancel">Cancel</button>
          <button class="bharat-modal-btn bharat-modal-btn-primary" id="bharat-modal-create">Create</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    // Populate color swatches
    const colorsContainer = overlay.querySelector("#bharat-modal-colors");
    for (const color of colors) {
      const swatch = document.createElementNS("http://www.w3.org/1999/xhtml", "html:div");
      swatch.className = "bharat-modal-color-swatch";
      swatch.style.backgroundColor = color;
      if (color === selectedColor) swatch.setAttribute("selected", "true");
      swatch.addEventListener("click", () => {
        selectedColor = color;
        colorsContainer.querySelectorAll(".bharat-modal-color-swatch").forEach(s => s.removeAttribute("selected"));
        swatch.setAttribute("selected", "true");
      });
      colorsContainer.appendChild(swatch);
    }

    // Focus input
    const nameInput = overlay.querySelector("#bharat-modal-ws-name");
    setTimeout(() => nameInput.focus(), 100);

    // Cancel handler
    overlay.querySelector("#bharat-modal-cancel").addEventListener("click", () => {
      overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Create handler
    overlay.querySelector("#bharat-modal-create").addEventListener("click", async () => {
      const name = nameInput.value.trim() || "New Workspace";
      const icon = icons[Math.floor(Math.random() * icons.length)];
      await window.gBharatWorkspaceManager.createWorkspace(name, selectedColor, icon);
      overlay.remove();
      this.refreshWorkspaceList();
    });

    // Enter key
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        overlay.querySelector("#bharat-modal-create").click();
      }
    });
  }

  async _deleteWorkspace(workspace) {
    // Simple confirm
    const confirmed = Services.prompt.confirm(
      null,
      "Delete Workspace",
      `Are you sure you want to delete "${workspace.name}"? Content will be moved to Personal.`
    );

    if (confirmed) {
      await window.gBharatWorkspaceManager.deleteWorkspace(workspace.id);
      this.refreshWorkspaceList();
    }
  }

  // ==================== Workspace AI Launcher ====================

  initializeWorkspaceAI() {
    window.gBharatWorkspaceAILauncher?.launch();
  }

  openWorkspaceAI() {
    window.gBharatWorkspaceAILauncher?.launch();
  }

  focusWorkspaceAI() {
    window.gBharatWorkspaceAILauncher?.focus();
  }

  refreshWorkspaceAIStatus() {
    const running = window.gBharatWorkspaceAILauncher?.isOpen() || false;
    const statusEl = document.getElementById("bharat-workspace-ai-status-value");
    if (statusEl) {
      statusEl.setAttribute("data-l10n-id", running ? "bharat-workspace-ai-running" : "bharat-workspace-ai-not-running");
      document.l10n.translateFragment(statusEl);
    }
    const statusDot = document.getElementById("bharat-workspace-ai-status-dot");
    if (statusDot) {
      statusDot.className = running ? "bharat-ws-status-dot-online" : "bharat-ws-status-dot-offline";
    }
    const launchBtn = document.getElementById("bharat-workspace-ai-launch-btn");
    if (launchBtn) {
      launchBtn.setAttribute("data-l10n-id", running ? "bharat-workspace-ai-focus" : "bharat-workspace-ai-launch");
      document.l10n.translateFragment(launchBtn);
    }
  }
}

window.gBharatAISidebar = new nsBharatAISidebar();
