/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsBharatNotesDB } from "chrome://browser/content/BharatNotesDB.mjs";

export class nsBharatNotesManager extends nsZenDOMOperatedFeature {
  _db = new nsBharatNotesDB();
  _activeNoteId = null;
  _autoSaveTimer = null;

  async init() {
    await this._db.init();
    console.log("[Bharat Notes] Manager initialized");

    window.addEventListener("bharat-workspace-changed", () => {
      if (window.gBharatAISidebar?._currentTab === "notes") {
        window.gBharatAISidebar.refreshNotesList();
      }
    });
  }

  async createNote(title = "Untitled Note", content = "", sourceType = "manual", sourceUrl = "") {
    const id = crypto.randomUUID();
    const now = Date.now();
    const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
    const note = {
      id,
      title,
      content,
      tags: [],
      folder: "root",
      createdAt: now,
      updatedAt: now,
      sourceUrl,
      sourceType,
      workspaceId,
    };
    await this._db.saveNote(note);
    this._activeNoteId = id;
    return note;
  }

  async saveActiveNote(content) {
    if (!this._activeNoteId) return;
    const note = await this._db.getNote(this._activeNoteId);
    if (!note) return;

    note.content = content;
    note.updatedAt = Date.now();
    await this._db.saveNote(note);

    // Save to Memory
    await gBharatMemoryManager.createMemory(
      note.title,
      note.content,
      "note",
      note.tags,
      5,
      "notes"
    );
  }

  async getNotes() {
    const activeWorkspace = window.gBharatWorkspaceManager?.activeWorkspaceId;
    if (activeWorkspace) {
      return await this._db.getNotesByWorkspace(activeWorkspace);
    }
    return await this._db.getAllNotes();
  }

  async deleteNote(id) {
    await this._db.deleteNote(id);
    if (this._activeNoteId === id) this._activeNoteId = null;
  }

  // AI Integrations
  async summarizeNote() {
    if (!this._activeNoteId) return;
    const note = await this._db.getNote(this._activeNoteId);
    if (!note) return;

    const prompt = "Summarize the following note content concisely:\n\n" + note.content;
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage("Summarize my note", {
      title: note.title,
      url: "local://notes/" + note.id,
      content: note.content
    });
  }

  async improveNote() {
    if (!this._activeNoteId) return;
    const note = await this._db.getNote(this._activeNoteId);
    if (!note) return;

    const prompt = "Improve the clarity, grammar, and flow of the following note while keeping its meaning:\n\n" + note.content;
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage("Improve this note", {
      title: note.title,
      url: "local://notes/" + note.id,
      content: note.content
    });
  }

  // Web Clipper Integration
  async clipPage() {
    const context = await gPageIntelligenceManager.getCurrentPageContext();
    if (!context) return;

    const note = await this.createNote(context.title, context.content, "webpage", context.url);
    gBharatAISidebar.selectTab("notes");
    // UI update logic will be triggered via manager events or direct calls
  }

  // YouTube Integration
  async clipVideoSummary(videoMetadata, summary) {
    const content = `# Video Summary: ${videoMetadata.title}\n\n${summary}\n\nSource: ${videoMetadata.url}`;
    await this.createNote(videoMetadata.title, content, "youtube", videoMetadata.url);
    gBharatAISidebar.selectTab("notes");
  }
}

window.gBharatNotesManager = new nsBharatNotesManager();
