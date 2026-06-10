/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsGeminiProvider } from "chrome://browser/content/GeminiProvider.mjs";

export class nsAIProviderManager {
  static PREF_PROVIDER = "bharat.ai.provider";
  
  static getActiveProvider() {
    const providerId = Services.prefs.getStringPref(this.PREF_PROVIDER, "gemini");
    switch (providerId) {
      case "gemini":
        return new nsGeminiProvider();
      default:
        return new nsGeminiProvider();
    }
  }

  static getGeminiKey() {
    return Services.prefs.getStringPref("bharat.ai.gemini.key", "");
  }

  static isConfigured() {
    return this.getGeminiKey().length > 0;
  }
}
