/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatNotesDB {
  static DB_NAME = "BharatNotesDB";
  static DB_VERSION = 2;
  _db = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(nsBharatNotesDB.DB_NAME, nsBharatNotesDB.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("notes")) {
          const noteStore = db.createObjectStore("notes", { keyPath: "id" });
          noteStore.createIndex("updatedAt", "updatedAt", { unique: false });
          noteStore.createIndex("folder", "folder", { unique: false });
          noteStore.createIndex("sourceType", "sourceType", { unique: false });
          noteStore.createIndex("workspaceId", "workspaceId", { unique: false });
        } else if (event.oldVersion < 2) {
          const db = event.target.result;
          const tx = event.target.transaction;
          const store = tx.objectStore("notes");
          if (store && !store.indexNames.contains("workspaceId")) {
            store.createIndex("workspaceId", "workspaceId", { unique: false });
          }
        }

        if (!db.objectStoreNames.contains("folders")) {
          db.createObjectStore("folders", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("tags")) {
          db.createObjectStore("tags", { keyPath: "name" });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveNote(note) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["notes"], "readwrite");
      const store = transaction.objectStore("notes");
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNote(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["notes"], "readonly");
      const store = transaction.objectStore("notes");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllNotes() {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["notes"], "readonly");
      const store = transaction.objectStore("notes");
      const index = store.index("updatedAt");
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result.reverse());
      request.onerror = () => reject(request.error);
    });
  }

  async getNotesByWorkspace(workspaceId) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["notes"], "readonly");
      const store = transaction.objectStore("notes");
      const index = store.index("workspaceId");
      const request = index.getAll(IDBKeyRange.only(workspaceId));
      request.onsuccess = () => {
        const notes = request.result;
        notes.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(["notes"], "readwrite");
      const store = transaction.objectStore("notes");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
