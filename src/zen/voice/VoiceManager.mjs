/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsVoiceRecognition } from "chrome://browser/content/VoiceRecognition.mjs";
import { nsVoicePermissions } from "chrome://browser/content/VoicePermissions.mjs";
import { nsVoiceSessionManager } from "chrome://browser/content/VoiceSessionManager.mjs";
import { nsVoiceCommandParser } from "chrome://browser/content/VoiceCommandParser.mjs";
import { nsVoiceActionExecutor } from "chrome://browser/content/VoiceActionExecutor.mjs";
import { nsVoiceWakeWord } from "chrome://browser/content/VoiceWakeWord.mjs";
import { nsVoiceTTS } from "chrome://browser/content/VoiceTTS.mjs";

export class nsVoiceManager extends nsZenDOMOperatedFeature {
  _recognition = null;
  _wakeword = null;
  _tts = new nsVoiceTTS();
  _sessions = new nsVoiceSessionManager();
  _status = "idle";
  _lastTranscript = "";

  async init() {
    this._sessions.init();
    
    this._recognition = new nsVoiceRecognition(
      (final, interim) => this._onResult(final, interim),
      (status, error) => this._onStatusUpdate(status, error)
    );
    this._recognition.init();

    this._wakeword = new nsVoiceWakeWord(() => this.start());
    this._wakeword.init();

    if (Services.prefs.getBoolPref("bharat.voice.wakeword", false)) {
      this._wakeword.start();
    }
  }

  async toggleListening() {
    if (this._status === "listening") {
      this.stop();
    } else {
      const permitted = await nsVoicePermissions.checkMicrophonePermission();
      if (!permitted) {
        this._onStatusUpdate("error", "Microphone permission required");
        return;
      }
      this.start();
    }
  }

  start() {
    this._sessions.startSession();
    this._recognition.start();
    if (this._wakeword) this._wakeword.stop();
  }

  stop() {
    this._recognition.stop();
    this._sessions.endSession();
    if (this._wakeword && Services.prefs.getBoolPref("bharat.voice.wakeword", false)) {
      this._wakeword.start();
    }
  }

  speak(text) {
    this._tts.speak(text);
  }

  _onResult(final, interim) {
    if (final) {
      this._lastTranscript = final;
      this._processCommand(final);
    }
    if (window.gBharatAISidebar) {
      window.gBharatAISidebar.updateVoiceTranscript(final || interim);
    }
  }

  _onStatusUpdate(status, error) {
    this._status = status;
    if (window.gBharatAISidebar) {
      window.gBharatAISidebar.updateVoiceStatus(status, error);
    }
  }

  async _processCommand(transcript) {
    const command = nsVoiceCommandParser.parse(transcript);
    this._sessions.addCommandToSession(command, transcript);

    if (window.gBharatAISidebar) {
      window.gBharatAISidebar.updateVoiceCommand(command);
    }

    if (Services.prefs.getBoolPref("bharat.voice.autoExecute", false)) {
      nsVoiceActionExecutor.execute(command);
    }
  }
}

window.gVoiceManager = new nsVoiceManager();
