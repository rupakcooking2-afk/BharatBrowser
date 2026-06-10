/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatNotesSearch {
  static async search(query, notes) {
    if (!query) return notes;
    
    const q = query.toLowerCase();
    return notes.filter(note => {
      const titleMatch = note.title?.toLowerCase().includes(q);
      const contentMatch = note.content?.toLowerCase().includes(q);
      const tagMatch = note.tags?.some(tag => tag.toLowerCase().includes(q));
      
      return titleMatch || contentMatch || tagMatch;
    }).sort((a, b) => {
      // Prioritize title matches
      const aTitle = a.title?.toLowerCase().includes(q);
      const bTitle = b.title?.toLowerCase().includes(q);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }
}

window.gBharatNotesSearch = nsBharatNotesSearch;
