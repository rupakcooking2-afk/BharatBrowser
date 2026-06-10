/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsVoiceSessionManager {
  _sessions = [];
  _currentSession = null;

  static PREF_SESSIONS = "bharat.voice.sessions";

  init() {
    try {
      this._sessions = JSON.parse(Services.prefs.getStringPref(nsVoiceSessionManager.PREF_SESSIONS, "[]"));
    } catch (e) {
      this._sessions = [];
    }
  }

  startSession() {
    this._currentSession = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      commands: [],
      transcript: ""
    };
    return this._currentSession;
  }

  endSession() {
    if (!this._currentSession) return;
    this._currentSession.endTime = Date.now();
    this._sessions.unshift(this._currentSession);
    if (this._sessions.length > 100) this._sessions.pop();
    
    Services.prefs.setStringPref(nsVoiceSessionManager.PREF_SESSIONS, JSON.stringify(this._sessions));
    this._currentSession = null;
  }

  addCommandToSession(command, transcript) {
    if (this._currentSession) {
      this._currentSession.commands.push({ command, timestamp: Date.now() });
      this._currentSession.transcript += " " + transcript;
    }
  }
}
