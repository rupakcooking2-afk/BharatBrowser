/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsYouTubeTranscriptProvider } from "chrome://browser/content/YouTubeTranscriptProvider.mjs";
import { nsYouTubeContextBuilder } from "chrome://browser/content/YouTubeContextBuilder.mjs";

export class nsYouTubeIntelligenceManager extends nsZenDOMOperatedFeature {
  _provider = new nsYouTubeTranscriptProvider();
  _history = [];

  static PREF_HISTORY = "bharat.youtube.history";

  init() {
    this.loadHistory();
    // Watch for tab changes to update UI state
    window.addEventListener("TabSelect", () => this.updateUIState());
  }

  loadHistory() {
    try {
      this._history = JSON.parse(Services.prefs.getStringPref(nsYouTubeIntelligenceManager.PREF_HISTORY, "[]"));
    } catch (e) {
      this._history = [];
    }
  }

  saveHistory(video, action) {
    const entry = {
      title: video.title,
      videoId: video.videoId,
      date: Date.now(),
      action
    };
    this._history.unshift(entry);
    if (this._history.length > 100) this._history.pop();
    Services.prefs.setStringPref(nsYouTubeIntelligenceManager.PREF_HISTORY, JSON.stringify(this._history));
  }

  async getActiveVideoMetadata() {
    const url = gBrowser.currentURI.spec;
    if (!url.includes("youtube.com/watch")) return null;

    const videoId = new URL(url).searchParams.get("v");
    if (!videoId) return null;

    // Use page content extraction or native title
    const title = gBrowser.selectedTab.label.replace(" - YouTube", "");
    
    return {
      videoId,
      title,
      url,
      channel: "Unknown Channel", // Would need content script for more detail
      duration: "Unknown"
    };
  }

  updateUIState() {
    const isYouTube = gBrowser.currentURI.spec.includes("youtube.com/watch");
    const toolbar = document.getElementById("bharat-ai-video-toolbar");
    if (toolbar) {
      toolbar.hidden = !isYouTube;
    }
  }

  async summarizeVideo() {
    const video = await this.getActiveVideoMetadata();
    if (!video) return;

    gBharatAISidebar.showTyping(true);
    const transcript = await this._provider.getTranscript(video.videoId);
    
    if (!transcript) {
      gBharatAISidebar.appendMessage("assistant", "No transcript available for this video.");
      gBharatAISidebar.showTyping(false);
      return;
    }

    const prompt = nsYouTubeContextBuilder.buildSummaryPrompt(video, transcript);
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage("Summarize this video", {
      title: video.title,
      url: video.url,
      content: transcript
    });
    
    // Save to Memory
    await gBharatMemoryManager.createMemory(
      "Video: " + video.title,
      transcript,
      "video",
      ["youtube", video.channel],
      6,
      "youtube"
    );
    
    this.saveHistory(video, "summary");
  }

  async generateTimeline() {
    const video = await this.getActiveVideoMetadata();
    if (!video) return;

    const transcript = await this._provider.getTranscript(video.videoId);
    if (!transcript) return;

    const prompt = nsYouTubeContextBuilder.buildTimelinePrompt(video, transcript);
    gBharatAISidebar.selectTab("chat");
    await gBharatChatManager.sendContextualMessage("Generate video timeline", {
      title: video.title,
      url: video.url,
      content: transcript
    });
  }
}

window.gYouTubeIntelligenceManager = new nsYouTubeIntelligenceManager();
