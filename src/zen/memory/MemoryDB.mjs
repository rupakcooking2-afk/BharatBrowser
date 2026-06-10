/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatMemoryDB {
  static DB_NAME = "BharatMemoryDB";
  static DB_VERSION = 2;
  _db = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(nsBharatMemoryDB.DB_NAME, nsBharatMemoryDB.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("memories")) {
          const store = db.createObjectStore("memories", { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("importance", "importance", { unique: false });
          store.createIndex("workspaceId", "workspaceId", { unique: false });
        } else if (event.oldVersion < 2) {
          const db = event.target.result;
          const tx = event.target.transaction;
          const store = tx.objectStore("memories");
          if (store && !store.indexNames.contains("workspaceId")) {
            store.createIndex("workspaceId", "workspaceId", { unique: false });
          }
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveMemory(memory) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["memories"], "readwrite");
      const store = transaction.objectStore("memories");
      const request = store.put(memory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMemory(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["memories"], "readonly");
      const store = transaction.objectStore("memories");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMemories() {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["memories"], "readonly");
      const store = transaction.objectStore("memories");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMemoriesByWorkspace(workspaceId) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["memories"], "readonly");
      const store = transaction.objectStore("memories");
      const index = store.index("workspaceId");
      const request = index.getAll(IDBKeyRange.only(workspaceId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMemory(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["memories"], "readwrite");
      const store = transaction.objectStore("memories");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
