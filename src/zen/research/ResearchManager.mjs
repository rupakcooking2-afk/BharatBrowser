/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsBharatResearchPlanner } from "chrome://browser/content/ResearchPlanner.mjs";
import { nsBharatResearchExecutor } from "chrome://browser/content/ResearchExecutor.mjs";
import { nsBharatResearchCitationEngine } from "chrome://browser/content/ResearchCitationEngine.mjs";
import { nsBharatResearchReportBuilder } from "chrome://browser/content/ResearchReportBuilder.mjs";
import { nsBharatResearchMemoryBridge } from "chrome://browser/content/ResearchMemoryBridge.mjs";

export class nsBharatResearchManager extends nsZenDOMOperatedFeature {
  _planner = new nsBharatResearchPlanner();
  _citationEngine = new nsBharatResearchCitationEngine();
  _executor = new nsBharatResearchExecutor(this._citationEngine);
  _memoryBridge = new nsBharatResearchMemoryBridge();

  _isRunning = false;
  _currentTasks = [];
  _history = [];

  static PREF_HISTORY = "bharat.research.history";

  async init() {
    this.loadHistory();

    window.addEventListener("bharat-workspace-changed", () => {
      this.loadHistory();
    });
  }

  loadHistory() {
    try {
      const allHistory = JSON.parse(Services.prefs.getStringPref(nsBharatResearchManager.PREF_HISTORY, "[]"));
      const activeWorkspace = window.gBharatWorkspaceManager?.activeWorkspaceId;
      this._history = activeWorkspace
        ? allHistory.filter(h => h.workspaceId === activeWorkspace)
        : allHistory;
    } catch (e) {
      this._history = [];
    }
  }

  _getAllHistory() {
    try {
      return JSON.parse(Services.prefs.getStringPref(nsBharatResearchManager.PREF_HISTORY, "[]"));
    } catch (e) {
      return [];
    }
  }

  async startResearch(query) {
    if (this._isRunning) return;
    this._isRunning = true;
    this._citationEngine.reset();

    try {
      console.log(`[Bharat Research] Starting deep research: ${query}`);

      // 1. Planning
      this._currentTasks = await this._planner.plan(query);
      this.updateUI();

      // 2. Execution
      const findings = [];
      for (const task of this._currentTasks) {
        task.status = "running";
        this.updateUI();

        const result = await this._executor.executeSubtask(task);
        findings.push(result);

        task.status = "completed";
        this.updateUI();
      }

      // 3. Reporting
      const report = nsBharatResearchReportBuilder.build(query, findings, this._citationEngine.getSources());

      // 4. Save to Notes & Memory (workspace-aware)
      if (window.gBharatNotesManager) {
        await gBharatNotesManager.createNote(`Research: ${query}`, report, "research", "");
      }
      await this._memoryBridge.saveToMemory(query, report, this._citationEngine.getSources());

      // 5. Update History
      this.saveToHistory(query, report);

      return report;
    } finally {
      this._isRunning = false;
      this._currentTasks = [];
      this.updateUI();
    }
  }

  saveToHistory(query, report) {
    const workspaceId = window.gBharatWorkspaceManager?.activeWorkspaceId || "default-personal";
    const entry = {
      query,
      date: Date.now(),
      status: "completed",
      workspaceId,
    };

    const allHistory = this._getAllHistory();
    allHistory.unshift(entry);
    if (allHistory.length > 500) allHistory.pop();
    Services.prefs.setStringPref(nsBharatResearchManager.PREF_HISTORY, JSON.stringify(allHistory));

    this.loadHistory();
  }

  updateUI() {
    // UI update logic in BharatAISidebar
    if (window.gBharatAISidebar) {
      window.gBharatAISidebar.refreshResearchUI();
    }
  }
}

window.gBharatResearchManager = new nsBharatResearchManager();
