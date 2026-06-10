/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatMemorySearch {
  static search(query, memories) {
    if (!query) return memories;
    
    const q = query.toLowerCase();
    return memories.filter(mem => {
      const titleMatch = mem.title?.toLowerCase().includes(q);
      const contentMatch = mem.content?.toLowerCase().includes(q);
      const tagMatch = mem.tags?.some(tag => tag.toLowerCase().includes(q));
      const typeMatch = mem.type?.toLowerCase().includes(q);
      
      return titleMatch || contentMatch || tagMatch || typeMatch;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

window.gBharatMemorySearch = nsBharatMemorySearch;
