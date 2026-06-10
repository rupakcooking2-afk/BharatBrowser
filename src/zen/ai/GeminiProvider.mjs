/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsGeminiProvider {
  constructor() {
    this.apiKey = Services.prefs.getStringPref("bharat.ai.gemini.key", "");
    this.temperature = Services.prefs.getFloatPref("bharat.ai.temperature", 0.7);
    this.maxTokens = Services.prefs.getIntPref("bharat.ai.maxTokens", 2048);
  }

  async *generateStream(prompt, history = []) {
    if (!this.apiKey) throw new Error("Gemini API key not configured");

    const contents = history.map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to connect to Gemini");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Gemini stream format is a JSON array of candidates
        // We need to parse chunks which might be incomplete JSON
        let startIdx = buffer.indexOf('{"candidates"');
        while (startIdx !== -1) {
          let endIdx = buffer.indexOf('}\n,', startIdx);
          if (endIdx === -1) endIdx = buffer.indexOf('}]', startIdx);
          if (endIdx === -1) break;

          const chunkStr = buffer.substring(startIdx, endIdx + 1);
          try {
            const json = JSON.parse(chunkStr);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch (e) {}
          
          buffer = buffer.substring(endIdx + 1);
          startIdx = buffer.indexOf('{"candidates"');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async generateText(prompt, systemInstruction = "") {
    if (!this.apiKey) throw new Error("Gemini API key not configured");

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Gemini request failed");
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }

  async generateJSON(systemInstruction, userPrompt) {
    const text = await this.generateText(userPrompt, systemInstruction + "\nReturn ONLY valid JSON.");
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  }
}
