/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsBharatWorkspaceDB } from "chrome://browser/content/BharatWorkspaceDB.mjs";

export class nsBharatWorkspaceManager extends nsZenDOMOperatedFeature {
  _db = new nsBharatWorkspaceDB();
  _workspaces = [];
  _activeWorkspaceId = null;
  _ready = false;

  static PREF_ACTIVE = "bharat.workspace.active";
  static DEFAULT_WORKSPACE_ID = "default-personal";

  static DEFAULT_WORKSPACE = {
    id: nsBharatWorkspaceManager.DEFAULT_WORKSPACE_ID,
    name: "Personal",
    color: "#6C63FF",
    icon: "🧑",
    sortOrder: 0,
    createdAt: 0,
  };

  async init() {
    await this._db.init();
    this._workspaces = await this._db.getAllWorkspaces();

    // Ensure default workspace exists
    if (this._workspaces.length === 0) {
      const defaultWs = { ...nsBharatWorkspaceManager.DEFAULT_WORKSPACE, createdAt: Date.now() };
      await this._db.saveWorkspace(defaultWs);
      this._workspaces.push(defaultWs);
    }

    // Load active workspace from pref
    this._activeWorkspaceId = Services.prefs.getStringPref(
      nsBharatWorkspaceManager.PREF_ACTIVE,
      nsBharatWorkspaceManager.DEFAULT_WORKSPACE_ID
    );

    // Validate active workspace exists
    if (!this._workspaces.find(w => w.id === this._activeWorkspaceId)) {
      this._activeWorkspaceId = this._workspaces[0].id;
      this._saveActiveWorkspacePref();
    }

    this._ready = true;
    console.log("[Bharat Workspace] Manager initialized, active:", this._activeWorkspaceId);
  }

  get activeWorkspaceId() {
    return this._activeWorkspaceId;
  }

  get activeWorkspace() {
    return this._workspaces.find(w => w.id === this._activeWorkspaceId) || this._workspaces[0];
  }

  get workspaces() {
    return this._workspaces;
  }

  get isReady() {
    return this._ready;
  }

  _saveActiveWorkspacePref() {
    Services.prefs.setStringPref(nsBharatWorkspaceManager.PREF_ACTIVE, this._activeWorkspaceId);
  }

  async switchWorkspace(id) {
    if (id === this._activeWorkspaceId) return;
    if (!this._workspaces.find(w => w.id === id)) return;

    this._activeWorkspaceId = id;
    this._saveActiveWorkspacePref();

    window.dispatchEvent(
      new CustomEvent("bharat-workspace-changed", {
        detail: { workspaceId: id },
      })
    );

    console.log("[Bharat Workspace] Switched to:", id);
  }

  async createWorkspace(name, color = "#6C63FF", icon = "📁") {
    const id = "ws_" + crypto.randomUUID();
    const workspace = {
      id,
      name,
      color,
      icon,
      sortOrder: this._workspaces.length,
      createdAt: Date.now(),
    };

    await this._db.saveWorkspace(workspace);
    this._workspaces.push(workspace);

    window.dispatchEvent(new CustomEvent("bharat-workspace-created", { detail: { workspace } }));
    return workspace;
  }

  async renameWorkspace(id, newName) {
    const workspace = this._workspaces.find(w => w.id === id);
    if (!workspace) return null;

    workspace.name = newName;
    await this._db.saveWorkspace(workspace);

    window.dispatchEvent(new CustomEvent("bharat-workspace-updated", { detail: { workspace } }));
    return workspace;
  }

  async updateWorkspace(id, updates) {
    const workspace = this._workspaces.find(w => w.id === id);
    if (!workspace) return null;

    Object.assign(workspace, updates);
    await this._db.saveWorkspace(workspace);

    window.dispatchEvent(new CustomEvent("bharat-workspace-updated", { detail: { workspace } }));
    return workspace;
  }

  async deleteWorkspace(id) {
    if (id === nsBharatWorkspaceManager.DEFAULT_WORKSPACE_ID) return false;

    const index = this._workspaces.findIndex(w => w.id === id);
    if (index === -1) return false;

    this._workspaces.splice(index, 1);
    await this._db.deleteWorkspace(id);

    // If deleted workspace was active, switch to Personal
    if (this._activeWorkspaceId === id) {
      await this.switchWorkspace(nsBharatWorkspaceManager.DEFAULT_WORKSPACE_ID);
    }

    window.dispatchEvent(new CustomEvent("bharat-workspace-deleted", { detail: { workspaceId: id } }));
    return true;
  }

  async getWorkspaceCounts() {
    const counts = {};
    for (const ws of this._workspaces) {
      counts[ws.id] = { chats: 0, notes: 0, memories: 0, research: 0 };
    }

    // Count chats
    try {
      const sessions = JSON.parse(
        Services.prefs.getStringPref("bharat.chat.sessions", "[]")
      );
      for (const session of sessions) {
        if (counts[session.workspaceId]) {
          counts[session.workspaceId].chats++;
        }
      }
    } catch (e) { /* ignore */ }

    // Count notes (from DB if available)
    if (window.gBharatNotesManager?._db?._db) {
      try {
        const notes = await window.gBharatNotesManager._db.getAllNotes();
        for (const note of notes) {
          if (counts[note.workspaceId]) {
            counts[note.workspaceId].notes++;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Count memories (from DB if available)
    if (window.gBharatMemoryManager?._db?._db) {
      try {
        const memories = await window.gBharatMemoryManager._db.getAllMemories();
        for (const mem of memories) {
          if (counts[mem.workspaceId]) {
            counts[mem.workspaceId].memories++;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Count research
    try {
      const history = JSON.parse(
        Services.prefs.getStringPref("bharat.research.history", "[]")
      );
      for (const entry of history) {
        if (counts[entry.workspaceId]) {
          counts[entry.workspaceId].research++;
        }
      }
    } catch (e) { /* ignore */ }

    return counts;
  }

  generateColor() {
    const colors = ["#6C63FF", "#FF6B6B", "#4ECDC4", "#FFD93D", "#6BCB77", "#FF8E53", "#9B59B6", "#3498DB"];
    const used = new Set(this._workspaces.map(w => w.color));
    for (const c of colors) {
      if (!used.has(c)) return c;
    }
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

window.gBharatWorkspaceManager = new nsBharatWorkspaceManager();
