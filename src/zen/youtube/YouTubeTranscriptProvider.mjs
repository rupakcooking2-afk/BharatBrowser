/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsYouTubeTranscriptProvider {
  async getTranscript(videoId) {
    try {
      // Method 1: Fetch YouTube page and look for transcript data in JSON
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(url);
      const text = await response.text();
      
      // Look for ytInitialPlayerResponse
      const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (!match) throw new Error("Could not find player response");
      
      const playerResponse = JSON.parse(match[1]);
      const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!captions || captions.length === 0) {
        throw new Error("No captions found");
      }

      // Prefer English or first available
      const track = captions.find(t => t.languageCode === 'en') || captions[0];
      const captionResponse = await fetch(track.baseUrl);
      const captionXml = await captionResponse.text();
      
      return this._parseXmlTranscript(captionXml);
    } catch (e) {
      console.error("[Bharat YouTube] Transcript extraction failed:", e);
      return null;
    }
  }

  _parseXmlTranscript(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const texts = doc.querySelectorAll("text");
    
    let transcript = [];
    texts.forEach(t => {
      const start = parseFloat(t.getAttribute("start"));
      const text = t.textContent
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      transcript.push({ start, text });
    });

    return this._cleanupTranscript(transcript);
  }

  _cleanupTranscript(transcript) {
    return transcript
      .map(t => t.text)
      .join(" ")
      .replace(/\[Music\]|\[music\]|\(applause\)|\(laughter\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 50000);
  }
}
