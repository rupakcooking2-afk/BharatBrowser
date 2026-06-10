/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";

export class nsAgentMemoryBridge {
  async getRelevantMemories(query, limit = 10) {
    if (!window.gBharatMemoryManager) return [];
    try {
      return await gBharatMemoryManager.getRelevantMemories(query, limit);
    } catch (e) {
      console.warn("[AgentMemoryBridge] getRelevantMemories failed:", e);
      return [];
    }
  }

  async saveMemory(title, content, type = "agent", tags = ["agent"], importance = 5) {
    if (!window.gBharatMemoryManager) return null;
    const approved = await nsBrowserActionApproval.requestDataExportApproval(
      "save to memory",
      `Agent wants to save: "${title}"`
    );
    if (!approved) return null;
    try {
      return await gBharatMemoryManager.createMemory(title, content, type, tags, importance, "agent");
    } catch (e) {
      console.warn("[AgentMemoryBridge] saveMemory failed:", e);
      return null;
    }
  }

  async saveTaskResult(taskGoal, resultSummary, steps) {
    const content = [
      `Goal: ${taskGoal}`,
      `Steps:\n${steps.map(s => `  - ${s.description}`).join("\n")}`,
      `Result: ${resultSummary}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n\n");
    return this.saveMemory(
      `Agent Task: ${taskGoal.substring(0, 60)}`,
      content,
      "agent-task",
      ["agent", "task", "completed"]
    );
  }

  async searchMemory(query) {
    if (!window.gBharatMemorySearch) return [];
    try {
      const all = await gBharatMemoryManager.getMemories();
      return gBharatMemorySearch.search(query, all);
    } catch (e) {
      console.warn("[AgentMemoryBridge] searchMemory failed:", e);
      return [];
    }
  }

  async getMemoriesByType(type) {
    if (!window.gBharatMemoryManager) return [];
    try {
      const all = await gBharatMemoryManager.getMemories();
      return all.filter(m => m.type === type);
    } catch (e) {
      return [];
    }
  }
}

window.gAgentMemoryBridge = new nsAgentMemoryBridge();
