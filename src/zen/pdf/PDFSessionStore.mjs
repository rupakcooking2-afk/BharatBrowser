/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsPDFSessionStore {
  static DB_NAME = "BharatPDFDB";
  static DB_VERSION = 1;
  _db = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(nsPDFSessionStore.DB_NAME, nsPDFSessionStore.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("workspaceId", "workspaceId", { unique: false });
          store.createIndex("sourceUrl", "sourceUrl", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveSession(session) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["sessions"], "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionByUrl(sourceUrl, workspaceId) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      const index = store.index("sourceUrl");
      const request = index.getAll(IDBKeyRange.only(sourceUrl));
      request.onsuccess = () => {
        const results = request.result || [];
        const match = results.find(s => s.workspaceId === workspaceId);
        resolve(match || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionsByWorkspace(workspaceId) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      const index = store.index("workspaceId");
      const request = index.getAll(IDBKeyRange.only(workspaceId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["sessions"], "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
