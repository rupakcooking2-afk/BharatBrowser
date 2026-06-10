/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsAgentAuditLog {
  static PREF_LOG = "bharat.ai.actionLog";
  static MAX_ENTRIES = 500;

  _getLog() {
    try {
      return JSON.parse(Services.prefs.getStringPref(nsAgentAuditLog.PREF_LOG, "[]"));
    } catch (e) {
      return [];
    }
  }

  _saveLog(log) {
    Services.prefs.setStringPref(nsAgentAuditLog.PREF_LOG, JSON.stringify(log));
  }

  record({ action, approval, result, details, taskId }) {
    const log = this._getLog();
    log.unshift({
      timestamp: Date.now(),
      action,
      approval: !!approval,
      result: result || "",
      details: details || "",
      taskId: taskId || null,
    });
    if (log.length > nsAgentAuditLog.MAX_ENTRIES) log.pop();
    this._saveLog(log);
  }

  recordApproval(action, approved, details = "") {
    this.record({ action, approval: approved, result: approved ? "approved" : "denied", details });
  }

  recordAction(action, result, details = "") {
    this.record({ action, approval: true, result, details });
  }

  recordTaskStart(taskId, goal) {
    this.record({ action: "task_start", approval: true, result: "started", details: goal, taskId });
  }

  recordTaskComplete(taskId, summary) {
    this.record({ action: "task_complete", approval: true, result: "success", details: summary, taskId });
  }

  recordTaskFail(taskId, error) {
    this.record({ action: "task_fail", approval: true, result: "failed", details: error, taskId });
  }

  getLog(limit = 50) {
    return this._getLog().slice(0, limit);
  }

  getLogByAction(action, limit = 50) {
    return this._getLog().filter(e => e.action === action).slice(0, limit);
  }

  clearLog() {
    this._saveLog([]);
  }
}

window.gAgentAuditLog = new nsAgentAuditLog();
