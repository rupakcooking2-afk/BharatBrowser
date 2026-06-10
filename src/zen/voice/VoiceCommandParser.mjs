/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsVoiceCommandParser {
  static parse(transcript) {
    const text = transcript.toLowerCase().trim();

    // 1. Browser Commands
    if (text.includes("new tab")) return { type: "browser", action: "newTab" };
    if (text.includes("close tab")) return { type: "browser", action: "closeTab" };
    if (text.includes("reload")) return { type: "browser", action: "reload" };
    if (text.includes("go back")) return { type: "browser", action: "back" };
    if (text.includes("go forward")) return { type: "browser", action: "forward" };
    if (text.includes("downloads")) return { type: "browser", action: "downloads" };
    if (text.includes("history")) return { type: "browser", action: "history" };
    if (text.includes("settings")) return { type: "browser", action: "settings" };
    if (text.includes("bookmarks")) return { type: "browser", action: "bookmarks" };
    
    if (text.startsWith("open ")) {
      const site = text.replace("open ", "");
      if (site === "youtube") return { type: "browser", action: "url", url: "https://www.youtube.com" };
      if (site === "gmail") return { type: "browser", action: "url", url: "https://mail.google.com" };
      if (site === "notes") return { type: "navigation", target: "notes" };
      if (site === "research") return { type: "navigation", target: "research" };
      if (site === "settings") return { type: "browser", action: "settings" };
    }

    // 2. Page Intelligence
    if (text.includes("summarize this page")) return { type: "page", action: "summarize" };
    if (text.includes("explain this page") || text.includes("explain selection")) return { type: "page", action: "explain" };
    if (text.includes("translate this page")) return { type: "page", action: "translate" };

    // 3. YouTube Intelligence
    if (text.includes("summarize this video") || text.includes("summarize video")) {
      return { type: "youtube", action: "summarize" };
    }

    // 4. Research
    if (text.startsWith("research ") || text.startsWith("start research on ")) {
      const query = text.replace("research ", "").replace("start research on ", "");
      return { type: "research", action: "start", query };
    }

    // 5. Notes
    if (text.startsWith("create note called ")) {
      return { type: "notes", action: "create", title: text.replace("create note called ", "") };
    }
    if (text.includes("create new note") || text.includes("new note")) {
      return { type: "notes", action: "create", title: "" };
    }

    // 6. Memory
    if (text.startsWith("remember ")) {
      return { type: "memory", action: "save", content: text.replace("remember ", "") };
    }

    // 7. Search
    if (text.startsWith("search for ") || text.startsWith("search ")) {
      const query = text.replace("search for ", "").replace("search ", "");
      return { type: "search", action: "query", query };
    }

    // 8. Fallback to Chat
    return { type: "chat", action: "message", content: transcript };
  }
}
