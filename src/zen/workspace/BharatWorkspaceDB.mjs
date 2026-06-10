/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatWorkspaceDB {
  static DB_NAME = "BharatWorkspaceDB";
  static DB_VERSION = 1;
  _db = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(nsBharatWorkspaceDB.DB_NAME, nsBharatWorkspaceDB.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("workspaces")) {
          const store = db.createObjectStore("workspaces", { keyPath: "id" });
          store.createIndex("sortOrder", "sortOrder", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveWorkspace(workspace) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["workspaces"], "readwrite");
      const store = transaction.objectStore("workspaces");
      const request = store.put(workspace);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getWorkspace(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["workspaces"], "readonly");
      const store = transaction.objectStore("workspaces");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllWorkspaces() {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["workspaces"], "readonly");
      const store = transaction.objectStore("workspaces");
      const index = store.index("sortOrder");
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteWorkspace(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["workspaces"], "readwrite");
      const store = transaction.objectStore("workspaces");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
