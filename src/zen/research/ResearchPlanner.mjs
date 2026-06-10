/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBharatAgentPlanner } from "chrome://browser/content/BharatAgentPlanner.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";

export class nsBharatResearchPlanner {
  _agentPlanner = new nsBharatAgentPlanner();

  async plan(query) {
    console.log(`[Bharat Research] Planning for: ${query}`);

    if (nsAIProviderManager.isConfigured()) {
      try {
        const provider = nsAIProviderManager.getActiveProvider();
        const researchPrompt = `Break this research topic into 4-6 focused subtasks for web research.
Return JSON: { "subtasks": [ { "id": 1, "title": "...", "searchQuery": "..." } ] }
Topic: ${query}`;

        const result = await provider.generateJSON(
          "You plan browser-native research subtasks. Return only JSON.",
          researchPrompt
        );

        if (result?.subtasks?.length) {
          return result.subtasks.map((st, i) => ({
            id: st.id || i + 1,
            title: st.title,
            searchQuery: st.searchQuery || st.title,
            status: "pending",
          }));
        }
      } catch (e) {
        console.warn("[Bharat Research] LLM planner failed, using defaults:", e);
      }
    }

    return [
      { id: 1, title: `Overview of ${query}`, searchQuery: `${query} overview 2025`, status: "pending" },
      { id: 2, title: `Key developments in ${query}`, searchQuery: `${query} latest developments`, status: "pending" },
      { id: 3, title: `Comparison and alternatives for ${query}`, searchQuery: `${query} comparison pros cons`, status: "pending" },
      { id: 4, title: `Future outlook for ${query}`, searchQuery: `${query} future trends predictions`, status: "pending" },
    ];
  }
}
