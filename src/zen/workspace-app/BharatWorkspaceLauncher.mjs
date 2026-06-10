/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsBharatWorkspaceLauncherView } from "chrome://browser/content/BharatWorkspaceLauncherView.mjs";

export class nsBharatWorkspaceLauncher {
  static ALLOWED_URL = "https://bharatworkspaceai.base44.app";

  init() {
    this._view = new nsBharatWorkspaceLauncherView();
    this._view.bindUI();

    // Refresh on panel open / workspace change
    window.addEventListener("bharat-workspace-changed", () => {
      this.refresh();
    });

    // Sidebar may open/close; also refresh when panel becomes active.
    window.addEventListener("bharat-workspace-ai-panel-show", () => {
      this.refresh();
    });

    // Initial paint (if panel is already in DOM and visible)
    this.refresh();
  }

  async refresh() {
    if (!this._view) return;
    await this._view.refreshStatusAndStats();
  }

  _validateAllowedUrl(url) {
    return url === nsBharatWorkspaceLauncher.ALLOWED_URL;
  }

  openWorkspaceAI() {
    const url = nsBharatWorkspaceLauncher.ALLOWED_URL;
    if (!this._validateAllowedUrl(url)) return;

    gBrowser.addTrustedTab(url);
  }
}

window.nsBharatWorkspaceLauncher = nsBharatWorkspaceLauncher;
window.gBharatWorkspaceLauncher = null;

