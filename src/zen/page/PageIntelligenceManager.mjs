/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

export class nsPageIntelligenceManager extends nsZenDOMOperatedFeature {
  init() {
    // Listeners for page-related events can go here
  }

  async getCurrentPageContext() {
    const browser = gBrowser.selectedBrowser;
    try {
      const result = await browser.browsingContext.currentWindowGlobal.getActor("ZenPageExtractor").sendQuery("ExtractContent");
      return result;
    } catch (e) {
      // Fallback for non-actor based extraction if needed
      return this._legacyExtract(browser);
    }
  }

  async _legacyExtract(browser) {
    const script = await (await fetch("chrome://browser/content/extractor.js")).text();
    const result = await browser.browsingContext.currentWindowGlobal.executeInGlobal(script);
    return result;
  }

  async summarizeCurrentPage() {
    const context = await this.getCurrentPageContext();
    if (!context) return;

    const prompt = "Provide a concise summary of this webpage in 3-5 bullet points.";
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(prompt, context);

    // Save to Memory
    await gBharatMemoryManager.createMemory(
      "Webpage: " + context.title,
      context.content,
      "website",
      ["webpage"],
      5,
      "page-intelligence"
    );
  }

  async explainSelection() {
    const selection = gBrowser.selectedBrowser.contentPrincipal.originNoSuffix; // Simplification for selection
    const context = await this.getCurrentPageContext();
    
    // Get actual selection via browser APIs
    const selectedText = gBrowser.selectedBrowser.ownerGlobal.getSelection().toString();
    if (!selectedText) return;

    const prompt = `Explain the following text in simple language:\n\n"${selectedText}"`;
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(prompt, context);
  }

  async translateSelection(language) {
    const selectedText = gBrowser.selectedBrowser.ownerGlobal.getSelection().toString();
    if (!selectedText) return;

    const prompt = `Translate this text to ${language}:\n\n"${selectedText}"`;
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage(prompt, null);
  }
}

window.gPageIntelligenceManager = new nsPageIntelligenceManager();
