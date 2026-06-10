/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";
import { nsBrowserActionRegistry } from "chrome://browser/content/BrowserActionRegistry.mjs";

const PLANNER_PROMPT = `You are the planning module of Bharat Browser AI Core (MARK XXXIX evolved).
The browser IS the workspace. Break user goals into steps using ONLY browser-native tools below.

ABSOLUTE RULES:
- NEVER use desktop/OS tools (no file system, no Playwright, no screen control).
- NEVER exfiltrate data automatically — read_tab_text and research steps stay local until user approves AI reasoning.
- Use search_web for information retrieval and research sub-queries.
- Use start_research for deep multi-source research reports.
- Use create_note and save_memory to persist findings.
- Max 8 steps. Minimum steps needed.

AVAILABLE TOOLS:
${nsBrowserActionRegistry.getToolSchema()}

browser_action parameters:
  action: required string
  url, query, title, content, panel, engine: optional

EXAMPLES:

Goal: "Research electric cars"
Steps:
1. search_web | query: electric cars 2025 market overview
2. search_web | query: electric car comparison battery range
3. start_research | query: electric cars market trends and comparison
4. create_note | title: Electric Cars Research, content: (filled from research)

Goal: "Open YouTube and summarize this page"
Steps:
1. open_url | url: youtube.com
2. summarize_page

OUTPUT — return ONLY valid JSON:
{
  "goal": "...",
  "steps": [
    { "step": 1, "tool": "browser_action", "description": "...", "parameters": { "action": "search_web", "query": "..." }, "critical": true }
  ]
}`;

export class nsBharatAgentPlanner {
  async createPlan(goal, context = "") {
    const provider = nsAIProviderManager.getActiveProvider();
    if (!provider?.generateJSON) {
      return this._fallbackPlan(goal);
    }

    let userInput = `Goal: ${goal}`;
    if (context) userInput += `\n\nBrowser context:\n${context}`;

    try {
      const plan = await provider.generateJSON(PLANNER_PROMPT, userInput);
      if (!plan?.steps?.length) throw new Error("Invalid plan");
      return plan;
    } catch (e) {
      console.warn("[Bharat Agent Planner]", e);
      return this._fallbackPlan(goal);
    }
  }

  async replan(goal, completedSteps, failedStep, error) {
    const provider = nsAIProviderManager.getActiveProvider();
    if (!provider?.generateJSON) return this._fallbackPlan(goal);

    const completed = completedSteps.map(s => `- Step ${s.step} (${s.tool}): done`).join("\n");
    const prompt = `Goal: ${goal}\nCompleted:\n${completed || "(none)"}\nFailed: [${failedStep?.tool}] ${failedStep?.description}\nError: ${error}\nCreate REVISED plan for remaining work only.`;

    try {
      return await provider.generateJSON(PLANNER_PROMPT, prompt);
    } catch (e) {
      return this._fallbackPlan(goal);
    }
  }

  _fallbackPlan(goal) {
    const lower = goal.toLowerCase();
    if (lower.includes("research") || lower.startsWith("research ")) {
      const topic = goal.replace(/^research\s+/i, "").trim() || goal;
      return {
        goal,
        steps: [
          { step: 1, tool: "browser_action", description: `Search for ${topic}`, parameters: { action: "search_web", query: topic }, critical: true },
          { step: 2, tool: "browser_action", description: `Deep research on ${topic}`, parameters: { action: "start_research", query: topic }, critical: true },
          { step: 3, tool: "browser_action", description: "Save research note", parameters: { action: "create_note", title: `Research: ${topic}` }, critical: false },
        ],
      };
    }
    if (lower.includes("summarize") && lower.includes("tab")) {
      return {
        goal,
        steps: [
          { step: 1, tool: "tab_intelligence", description: "Summarize all open tabs", parameters: { command: "summarize_all" }, critical: true },
        ],
      };
    }
    return {
      goal,
      steps: [
        { step: 1, tool: "browser_action", description: `Search: ${goal}`, parameters: { action: "search_web", query: goal }, critical: true },
      ],
    };
  }
}
