/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatMemoryClassifier {
  static classify(content) {
    const text = content.toLowerCase();
    
    if (text.includes("i want to") || text.includes("planning to") || text.includes("building a")) {
      return { type: "project", importance: 8 };
    }
    
    if (text.includes("prefer") || text.includes("i like") || text.includes("don't like")) {
      return { type: "preference", importance: 7 };
    }
    
    if (text.includes("remember") || text.includes("don't forget")) {
      return { type: "task", importance: 9 };
    }

    return { type: "general", importance: 5 };
  }
}

window.gBharatMemoryClassifier = nsBharatMemoryClassifier;
