/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsVoiceTTS {
  constructor() {
    this._synth = window.speechSynthesis;
    this._voice = null;
  }

  speak(text) {
    if (!Services.prefs.getBoolPref("bharat.voice.tts.enabled", true)) return;
    if (this._synth.speaking) {
      this._synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Load preferences
    utterance.rate = Services.prefs.getFloatPref("bharat.voice.speed", 1.0);
    utterance.pitch = Services.prefs.getFloatPref("bharat.voice.pitch", 1.0);
    utterance.volume = Services.prefs.getFloatPref("bharat.voice.volume", 1.0);

    // Try to find a good voice
    const voices = this._synth.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"));
    if (preferredVoice) utterance.voice = preferredVoice;

    this._synth.speak(utterance);
  }

  stop() {
    this._synth.cancel();
  }
}
