/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsBharatMemoryDB } from "chrome://browser/content/MemoryDB.mjs";

export class nsBharatMemoryManager extends nsZenDOMOperatedFeature {
  _db = new nsBharatMemoryDB();

  async init() {
    await this._db.init();
    console.log("[Bharat Memory] Manager initialized");

    window.addEventListener("bharat-workspace-changed", () => {
      if (window.gBharatAISidebar?._currentTab === "memory") {
        window.gBharatAISidebar.refreshMemoryList();
      }
    });
  }

  async createMemory(title, content, type, tags = [], importance = 5, source = "manual") {
    const id = "mem_" + crypto.randomUUID();
    const now = Date.now();
    const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
    const memory = {
      id,
      title,
      content,
      type,
      tags,
      createdAt: now,
      updatedAt: now,
      importance,
      source,
      pinned: false,
      workspaceId,
    };
    await this._db.saveMemory(memory);
    return memory;
  }

  async getMemories() {
    const activeWorkspace = window.gBharatWorkspaceManager?.activeWorkspaceId;
    let memories;
    if (activeWorkspace) {
      memories = await this._db.getMemoriesByWorkspace(activeWorkspace);
    } else {
      memories = await this._db.getAllMemories();
    }
    return memories.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteMemory(id) {
    await this._db.deleteMemory(id);
  }

  async updateMemory(id, updates) {
    const memory = await this._db.getMemory(id);
    if (!memory) return;

    const updatedMemory = { ...memory, ...updates, updatedAt: Date.now() };
    await this._db.saveMemory(updatedMemory);
    return updatedMemory;
  }

  async getRelevantMemories(query, limit = 5) {
    const activeWorkspace = window.gBharatWorkspaceManager?.activeWorkspaceId;
    let allMemories;
    if (activeWorkspace) {
      allMemories = await this._db.getMemoriesByWorkspace(activeWorkspace);
    } else {
      allMemories = await this._db.getAllMemories();
    }
    if (!query) return allMemories.slice(0, limit);

    const scoredMemories = allMemories.map(mem => ({
      memory: mem,
      score: this._calculateRelevance(mem, query)
    }));

    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  _calculateRelevance(memory, query) {
    const q = query.toLowerCase();
    let score = 0;

    // Title match
    if (memory.title?.toLowerCase().includes(q)) score += 10;

    // Content match
    if (memory.content?.toLowerCase().includes(q)) score += 5;

    // Tag match
    if (memory.tags?.some(tag => tag.toLowerCase().includes(q))) score += 8;

    // Recency (within last 7 days)
    const daysOld = (Date.now() - memory.updatedAt) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += (7 - daysOld);

    // Importance
    score += (memory.importance || 5) / 2;

    // Pinned status
    if (memory.pinned) score += 20;

    return score;
  }
}

window.gBharatMemoryManager = new nsBharatMemoryManager();
