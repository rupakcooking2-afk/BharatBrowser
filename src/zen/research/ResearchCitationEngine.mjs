/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatResearchCitationEngine {
  _sources = [];

  addSource(title, url, snippet = "") {
    const id = this._sources.length + 1;
    const source = {
      id,
      title,
      url,
      snippet,
      date: new Date().toLocaleDateString(),
      confidence: 0.9
    };
    this._sources.push(source);
    return id;
  }

  getSources() {
    return this._sources;
  }

  reset() {
    this._sources = [];
  }

  formatCitation(id) {
    return `[${id}]`;
  }
}
