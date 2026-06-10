/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatWorkspaceLauncherView {
  constructor() {
    this._panelEl = null;
  }

  bindUI() {
    this._panelEl = document.getElementById("bharat-ai-panel-workspace-ai");
    if (!this._panelEl) return;

    // Buttons
    const initBtn = document.getElementById(
      "bharat-workspace-ai-init-btn"
    );
    const openBtn = document.getElementById(
      "bharat-workspace-ai-open-btn"
    );

    if (initBtn) {
      initBtn.addEventListener("command", () => {
        window.gBharatWorkspaceLauncher?.openWorkspaceAI();
      });
    }
    if (openBtn) {
      openBtn.addEventListener("command", () => {
        window.gBharatWorkspaceLauncher?.openWorkspaceAI();
      });
    }

    // When panel is selected, refresh stats
    // (Sidebar will dispatch event; also refresh on connect)
    document.addEventListener("bharat-workspace-ai-panel-show", () => {
      this.refreshStatusAndStats();
    });
  }

  async refreshStatusAndStats() {
    const panel = document.getElementById("bharat-ai-panel-workspace-ai");
    if (!panel) return;

    // Status card (display-only)
    const status = {
      ready: true,
      connected: !!window.gBharatWorkspaceManager,
      notes: !!window.gBharatNotesManager,
      memory: !!window.gBharatMemoryManager,
      research: !!window.gBharatResearchManager,
      workspace: !!window.gBharatWorkspaceManager,
    };

    const setStatusText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setStatusText("bharat-ai-status-ready", status.ready ? "Ready" : "Not Ready");
    setStatusText(
      "bharat-ai-status-connected",
      status.connected ? "Connected to Bharat Browser" : "Not Connected"
    );
    setStatusText(
      "bharat-ai-status-notes",
      status.notes ? "Notes Available" : "Notes Unavailable"
    );
    setStatusText(
      "bharat-ai-status-memory",
      status.memory ? "Memory Available" : "Memory Unavailable"
    );
    setStatusText(
      "bharat-ai-status-research",
      status.research ? "Research Available" : "Research Unavailable"
    );
    setStatusText(
      "bharat-ai-status-workspace",
      status.workspace ? "Workspace Available" : "Workspace Unavailable"
    );

    // Statistics card
    const workspaceMgr = window.gBharatWorkspaceManager;
    if (!workspaceMgr?.isReady) {
      this._setStatCounts({ notes: 0, memory: 0, research: 0, workspace: 0 });
      return;
    }

    const countsByWs = await workspaceMgr.getWorkspaceCounts();

    // Totals across all workspaces (display-only)
    let totals = {
      notes: 0,
      memory: 0,
      research: 0,
      workspace: 0,
    };

    totals.workspace = workspaceMgr.workspaces?.length || 0;

    for (const wsId of Object.keys(countsByWs || {})) {
      const c = countsByWs[wsId] || {};
      totals.notes += c.notes || 0;
      totals.memory += c.memories || 0;
      totals.research += c.research || 0;
    }

    this._setStatCounts(totals);
  }

  _setStatCounts({ notes, memory, research, workspace }) {
    const setText = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v ?? 0);
    };

    setText("bharat-ai-stat-notes", notes);
    setText("bharat-ai-stat-memory", memory);
    setText("bharat-ai-stat-research", research);
    setText("bharat-ai-stat-workspace", workspace);
  }
}

