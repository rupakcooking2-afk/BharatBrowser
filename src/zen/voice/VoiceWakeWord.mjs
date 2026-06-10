/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsVoiceWakeWord {
  constructor(onWake) {
    this._onWake = onWake;
    this._recognition = null;
    this._isListening = false;
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    
    this._recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase();
      
      const wakeWords = ["hey bharat", "bharat", "hello bharat"];
      if (wakeWords.some(word => transcript.includes(word))) {
        this._onWake();
      }
    };

    this._recognition.onend = () => {
      if (this._isListening) {
        this._recognition.start(); // Auto-restart for continuous listening
      }
    };
  }

  start() {
    if (this._recognition && !this._isListening) {
      this._isListening = true;
      try {
        this._recognition.start();
      } catch (e) {}
    }
  }

  stop() {
    this._isListening = false;
    if (this._recognition) {
      this._recognition.stop();
    }
  }
}
