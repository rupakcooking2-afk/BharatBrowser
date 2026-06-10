/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * User approval gate before sensitive browser or data-export actions.
 */
export class nsBrowserActionApproval {
  static SENSITIVE_ACTIONS = new Set([
    "open_url", "search_web", "close_tab", "close_all_tabs",
    "bookmark_page", "search_history", "send_to_ai",
    "export_notes", "export_memory", "export_pdf", "export_tabs",
  ]);

  static DATA_EXPORT_ACTIONS = new Set([
    "send_to_ai", "export_notes", "export_memory", "export_pdf", "export_tabs",
  ]);

  static requiresApproval(action, context = {}) {
    if (!Services.prefs.getBoolPref("bharat.ai.requireApproval", true)) {
      return false;
    }
    if (context.skipApproval) return false;
    return this.SENSITIVE_ACTIONS.has(action);
  }

  static async requestApproval(action, description, details = "") {
    if (!this.requiresApproval(action)) return true;

    const title = this._titleForAction(action);
    const message = `${description}\n\n${details}`.trim();

    const remember = { value: false };
    const confirmed = Services.prompt.confirmEx(
      null,
      title,
      message,
      Services.prompt.BUTTON_TITLE_YES * Services.prompt.BUTTON_POS_0 +
        Services.prompt.BUTTON_TITLE_NO * Services.prompt.BUTTON_POS_1,
      null,
      null,
      null,
      null,
      remember
    ) === 0;

    this._logDecision(action, confirmed);
    return confirmed;
  }

  static async requestDataExportApproval(dataType, summary) {
    if (!Services.prefs.getBoolPref("bharat.ai.requireApproval", true)) {
      return true;
    }

    const confirmed = Services.prompt.confirm(
      null,
      "Share data with AI?",
      `Bharat AI wants to send ${dataType} to Gemini for reasoning.\n\n${summary}\n\nNothing is sent without your approval.`
    );

    this._logDecision(`export_${dataType}`, confirmed);
    return confirmed;
  }

  static _titleForAction(action) {
    const titles = {
      open_url: "Open website?",
      search_web: "Search the web?",
      close_tab: "Close tab?",
      send_to_ai: "Send data to AI?",
      export_tabs: "Share tab content?",
      export_pdf: "Share PDF content?",
      export_notes: "Share notes?",
      export_memory: "Share memories?",
    };
    return titles[action] || "Allow Bharat AI action?";
  }

  static _logDecision(action, approved) {
    try {
      const log = JSON.parse(Services.prefs.getStringPref("bharat.ai.actionLog", "[]"));
      log.unshift({ action, approved, timestamp: Date.now() });
      if (log.length > 200) log.pop();
      Services.prefs.setStringPref("bharat.ai.actionLog", JSON.stringify(log));
    } catch (e) {}
  }
}
