/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const WINDOW_NAME = "bharat-workspace-ai";
const ALLOWED_URL = "https://bharatworkspaceai.base44.app";
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

export class nsBharatWorkspaceAILauncher {
  _windowRef = null;
  _boundOnUnload = null;

  init() {
    console.log("[Bharat Workspace AI] Launcher initialized.");
  }

  get ALLOWED_URL() {
    return ALLOWED_URL;
  }

  launch() {
    if (this.isOpen()) {
      this.focus();
      return;
    }

    const { availLeft, availTop, availWidth, availHeight } = screen;
    const left = Math.max(0, Math.round(availLeft + (availWidth - DEFAULT_WIDTH) / 2));
    const top = Math.max(0, Math.round(availTop + (availHeight - DEFAULT_HEIGHT) / 2));
    const features = [
      `width=${DEFAULT_WIDTH}`,
      `height=${DEFAULT_HEIGHT}`,
      `left=${left}`,
      `top=${top}`,
      "chrome",
      "resizable",
      "scrollbars",
      "status",
    ].join(",");

    const win = window.open(ALLOWED_URL, WINDOW_NAME, features);
    if (!win) {
      console.warn("[Bharat Workspace AI] Failed to open window (popup blocked?).");
      return;
    }

    this._trackWindow(win);
    this._dispatchStatusEvent(true);
  }

  focus() {
    if (this._windowRef && !this._windowRef.closed) {
      try {
        this._windowRef.focus();
      } catch (e) {
        this._clearRef();
      }
    }
  }

  close() {
    if (this._windowRef && !this._windowRef.closed) {
      try {
        this._windowRef.close();
      } catch (e) {
        // Window may already be closing
      }
    }
    this._clearRef();
    this._dispatchStatusEvent(false);
  }

  isOpen() {
    return this._windowRef !== null && !this._windowRef.closed;
  }

  getWindow() {
    return this.isOpen() ? this._windowRef : null;
  }

  _trackWindow(win) {
    this._clearRef();
    this._windowRef = win;
    this._boundOnUnload = () => {
      this._clearRef();
      this._dispatchStatusEvent(false);
    };
    win.addEventListener("unload", this._boundOnUnload, { once: true });
    win.addEventListener("focus", () => {
      this._dispatchStatusEvent(true);
    });
  }

  _clearRef() {
    if (this._windowRef && this._boundOnUnload) {
      try {
        this._windowRef.removeEventListener("unload", this._boundOnUnload);
      } catch (e) {}
    }
    this._windowRef = null;
    this._boundOnUnload = null;
  }

  _dispatchStatusEvent(isRunning) {
    window.dispatchEvent(
      new CustomEvent("bharat-workspace-ai-status", {
        detail: { running: isRunning },
      })
    );
  }
}

window.gBharatWorkspaceAILauncher = new nsBharatWorkspaceAILauncher();
