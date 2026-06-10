/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBrowserActionApproval } from "chrome://browser/content/BrowserActionApproval.mjs";
import { nsAIProviderManager } from "chrome://browser/content/AIProviderManager.mjs";

/**
 * Multi-tab intelligence — read, summarize, compare, and report across tabs.
 */
export class nsTabIntelligenceManager {
  async summarizeAllTabs() {
    const tabs = await gBrowserContextBus.getMultiTabContent();
    const approved = await nsBrowserActionApproval.requestDataExportApproval(
      "open tab content",
      `${tabs.length} tab(s) will be analyzed locally and summarized via Gemini.`
    );
    if (!approved) return;

    const summary = tabs.map(t =>
      `## ${t.title}\nURL: ${t.url}\n${(t.content || "").substring(0, 3000)}`
    ).join("\n\n---\n\n");

    gBharatAISidebar?.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(
      "Summarize all of my open tabs in organized sections. Highlight key themes and action items.",
      { title: "All Open Tabs", url: "browser://tabs", content: summary }
    );
  }

  async compareTabs(tabIds = null) {
    const targetTabs = tabIds
      ? gBrowser.tabs.filter(t => tabIds.includes(t.linkedBrowser?.browsingContext?.id))
      : gBrowser.tabs.slice(0, 5);

    const tabs = await gBrowserContextBus.getMultiTabContent(targetTabs);
    const approved = await nsBrowserActionApproval.requestDataExportApproval(
      "tab comparison",
      `Compare ${tabs.length} tab(s) using AI reasoning.`
    );
    if (!approved) return;

    const content = tabs.map(t =>
      `[${t.title}] (${t.url})\n${(t.content || "").substring(0, 2500)}`
    ).join("\n\n");

    gBharatAISidebar?.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(
      "Compare these tabs. Identify agreements, contradictions, and unique insights from each source.",
      { title: "Tab Comparison", url: "browser://tabs", content }
    );
  }

  async createResearchReportFromTabs() {
    const tabs = await gBrowserContextBus.getMultiTabContent();
    if (!tabs.length) return;

    const topic = tabs.map(t => t.title).slice(0, 3).join(", ");
    const approved = await nsBrowserActionApproval.requestDataExportApproval(
      "tab research synthesis",
      `Create a research report from ${tabs.length} open tab(s).`
    );
    if (!approved) return;

    const content = tabs.map(t =>
      `Source: ${t.title}\nURL: ${t.url}\n${(t.content || "").substring(0, 4000)}`
    ).join("\n\n---\n\n");

    gBharatAISidebar?.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(
      "Create a structured research report with executive summary, key findings, citations (use tab URLs), and recommendations.",
      { title: `Research from tabs: ${topic}`, url: "browser://tabs", content }
    );

    if (gBharatNotesManager) {
      const provider = nsAIProviderManager.getActiveProvider();
      if (provider?.generateText) {
        const report = await provider.generateText(
          `Create a markdown research report from:\n${content.substring(0, 12000)}`
        );
        await gBharatNotesManager.createNote(`Tab Research: ${topic}`, report, "research", "");
      }
    }
  }

  async saveImportantFromTabs() {
    const tabs = await gBrowserContextBus.getMultiTabContent();
    for (const tab of tabs.slice(0, 5)) {
      if (!tab.content || tab.content.length < 100) continue;
      await gBharatMemoryManager?.createMemory(
        tab.title,
        tab.content.substring(0, 2000),
        "website",
        ["tabs", "auto-save"],
        6,
        "tab-intelligence"
      );
    }
    gBharatAISidebar?.selectTab("memory");
    gBharatAISidebar?.refreshMemoryList();
  }

  async summarizeCurrentTab() {
    await gPageIntelligenceManager?.summarizeCurrentPage();
  }

  detectCommand(text) {
    const lower = text.toLowerCase().trim();
    if (/summarize\s+(all\s+)?tabs/.test(lower)) return "summarize_all";
    if (/compare\s+(these\s+)?tabs/.test(lower)) return "compare";
    if (/research\s+report\s+from\s+(open\s+)?tabs/.test(lower)) return "research_report";
    if (/save\s+important/.test(lower) && lower.includes("tab")) return "save_important";
    return null;
  }
}

window.gTabIntelligenceManager = new nsTabIntelligenceManager();
