/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsYouTubeContextBuilder {
  static buildSummaryPrompt(metadata, transcript) {
    return `Analyze the following YouTube video transcript.
    
Video Title: ${metadata.title}
Channel: ${metadata.channel}
URL: ${metadata.url}

Transcript:
${transcript}

Generate a comprehensive analysis in Markdown:
1. ## Executive Summary
2. ## Main Topics
3. ## Key Takeaways
4. ## Important Quotes
5. ## Action Items`;
  }

  static buildTimelinePrompt(metadata, transcript) {
    return `Based on the following transcript, generate a chronological timeline of topics discussed in the video.
    
Video: ${metadata.title}
Transcript: ${transcript}

Format as:
00:00 - [Topic Name]
...`;
  }

  static buildQAPrompt(userQuery, metadata, transcript) {
    return `You are analyzing this YouTube video: "${metadata.title}" by ${metadata.channel}.
    
Context (Transcript):
${transcript}

User Question: ${userQuery}`;
  }
}
