/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBharatAgentPlanner } from "chrome://browser/content/BharatAgentPlanner.mjs";
import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";
import { nsAgentTaskManager } from "chrome://browser/content/AgentTaskManager.mjs";
import { nsAgentMemoryBridge } from "chrome://browser/content/AgentMemoryBridge.mjs";
import { nsAgentAuditLog } from "chrome://browser/content/AgentAuditLog.mjs";

export class nsBharatAgentExecutor {
  _planner = new nsBharatAgentPlanner();
  _isRunning = false;
  _cancelRequested = false;
  _currentGoal = "";
  _currentSteps = [];
  _stepResults = {};
  _onProgress = null;

  get isRunning() {
    return this._isRunning;
  }

  cancel() {
    this._cancelRequested = true;
  }

  async execute(goal, options = {}) {
    if (this._isRunning) throw new Error("Agent task already running");

    this._isRunning = true;
    this._cancelRequested = false;
    this._currentGoal = goal;
    this._stepResults = {};
    this._onProgress = options.onProgress || null;

    const task = gAgentTaskManager.createTask(goal);
    gAgentAuditLog.recordTaskStart(task.taskId, goal);

    let replanAttempts = 0;
    let completedSteps = [];
    let plan = await this._planner.createPlan(goal, options.context || "");

    try {
      while (true) {
        this._currentSteps = plan.steps || [];
        gAgentTaskManager.markRunning(task.taskId);
        this._emitProgress("planning", { steps: this._currentSteps });

        let failedStep = null;
        let failedError = "";

        for (const [idx, step] of this._currentSteps.entries()) {
          if (this._cancelRequested) {
            gAgentTaskManager.markFailed(task.taskId, "Agent task cancelled.");
            gAgentAuditLog.recordTaskFail(task.taskId, "Cancelled");
            return { success: false, summary: "Agent task cancelled." };
          }

          step.status = "running";
          gAgentTaskManager.addStep(task.taskId, step);
          gAgentTaskManager.updateStep(task.taskId, idx, { status: "running" });
          this._emitProgress("step_start", { step });

          const result = await this._executeStep(step, goal);
          this._stepResults[step.step] = result;

          if (!result.success) {
            failedStep = step;
            failedError = result.message;
            step.status = "failed";
            gAgentTaskManager.updateStep(task.taskId, idx, { status: "failed", error: failedError });
            this._emitProgress("step_failed", { step, error: failedError });
            break;
          }

          step.status = "completed";
          completedSteps.push(step);
          gAgentTaskManager.updateStep(task.taskId, idx, { status: "completed" });
          this._emitProgress("step_done", { step, result: result.message });
        }

        if (!failedStep) {
          const summary = await this._summarize(goal, completedSteps);
          gAgentTaskManager.markCompleted(task.taskId, summary);
          gAgentAuditLog.recordTaskComplete(task.taskId, summary);
          gAgentMemoryBridge.saveTaskResult(goal, summary, completedSteps);
          this._emitProgress("complete", { summary });
          return { success: true, summary, steps: completedSteps };
        }

        if (replanAttempts >= 2) {
          const msg = `Task failed: ${failedError}`;
          gAgentTaskManager.markFailed(task.taskId, msg);
          gAgentAuditLog.recordTaskFail(task.taskId, failedError);
          return { success: false, summary: msg };
        }

        replanAttempts++;
        plan = await this._planner.replan(goal, completedSteps, failedStep, failedError);
      }
    } finally {
      this._isRunning = false;
      this._currentSteps = [];
      this._currentGoal = "";
    }
  }

  async _executeStep(step, goal) {
    const tool = step.tool || "browser_action";
    const params = { ...(step.parameters || {}), description: step.description };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (tool === "browser_action") {
          return await nsBrowserActionRegistry.execute("browser_action", params);
        }
        if (tool === "tab_intelligence") {
          return await this._runTabIntelligence(params);
        }
        if (tool === "read_tabs") {
          const tabs = await gBrowserContextBus.getMultiTabContent();
          return { success: true, message: tabs.map(t => `${t.title}: ${t.content?.substring(0, 500)}`).join("\n\n") };
        }
        return await nsBrowserActionRegistry.execute(tool, params);
      } catch (e) {
        if (attempt === 3) return { success: false, message: e.message };
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return { success: false, message: "Max retries exceeded" };
  }

  async _runTabIntelligence(params) {
    const cmd = params.command || params.action;
    const mgr = window.gTabIntelligenceManager;
    if (!mgr) return { success: false, message: "Tab intelligence unavailable" };

    switch (cmd) {
      case "summarize_all":
        await mgr.summarizeAllTabs();
        return { success: true, message: "All tabs summarized in chat." };
      case "compare":
        await mgr.compareTabs();
        return { success: true, message: "Tab comparison started in chat." };
      case "research_report":
        await mgr.createResearchReportFromTabs();
        return { success: true, message: "Research report from tabs started." };
      case "save_important":
        await mgr.saveImportantFromTabs();
        return { success: true, message: "Important information saved to memory." };
      default:
        return { success: false, message: `Unknown tab command: ${cmd}` };
    }
  }

  async _summarize(goal, completedSteps) {
    const provider = nsAIProviderManager.getActiveProvider();
    const stepsStr = completedSteps.map(s => `- ${s.description}`).join("\n");

    if (provider?.generateText) {
      try {
        return await provider.generateText(
          `User goal: "${goal}"\nCompleted:\n${stepsStr}\n\nWrite one concise sentence summarizing what was accomplished in the browser.`
        );
      } catch (e) {}
    }

    return `Completed ${completedSteps.length} steps for: ${goal}`;
  }

  _emitProgress(phase, data) {
    if (this._onProgress) this._onProgress(phase, data);
    window.dispatchEvent(new CustomEvent("bharat-agent-progress", { detail: { phase, ...data } }));
  }
}

window.gBharatAgentExecutor = new nsBharatAgentExecutor();
