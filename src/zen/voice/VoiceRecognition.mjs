/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsVoiceRecognition {
  constructor(onResult, onStatus) {
    this._recognition = null;
    this._onResult = onResult;
    this._onStatus = onStatus;
    this._isListening = false;
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[Bharat Voice] SpeechRecognition API not available");
      return false;
    }

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = Services.prefs.getStringPref("bharat.voice.language", "en-US");

    this._recognition.onstart = () => {
      this._isListening = true;
      this._onStatus("listening");
    };

    this._recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      this._onResult(finalTranscript, interimTranscript);
    };

    this._recognition.onerror = (event) => {
      console.error("[Bharat Voice] Recognition error:", event.error);
      this._onStatus("error", event.error);
    };

    this._recognition.onend = () => {
      this._isListening = false;
      this._onStatus("idle");
    };

    return true;
  }

  start() {
    if (this._recognition && !this._isListening) {
      try {
        this._recognition.start();
      } catch (e) {
        console.error("[Bharat Voice] Failed to start recognition:", e);
      }
    }
  }

  stop() {
    if (this._recognition && this._isListening) {
      this._recognition.stop();
    }
  }
}
