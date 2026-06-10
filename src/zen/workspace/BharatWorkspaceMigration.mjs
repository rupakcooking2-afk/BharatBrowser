/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MIGRATION_PREF = "bharat.workspace.migrated";

export class nsBharatWorkspaceMigration {
  static DEFAULT_ID = "default-personal";
  static MAX_RETRIES = 5;
  static RETRY_DELAY = 500;

  static needsMigration() {
    return !Services.prefs.getBoolPref(MIGRATION_PREF, false);
  }

  static markComplete() {
    Services.prefs.setBoolPref(MIGRATION_PREF, true);
  }

  static async run(retryCount = 0) {
    if (!nsBharatWorkspaceMigration.needsMigration()) {
      return;
    }

    console.log("[Bharat Workspace] Running data migration...");

    // Pref-based migrations always work
    await nsBharatWorkspaceMigration._migrateChatSessions();
    await nsBharatWorkspaceMigration._migrateResearchHistory();

    // DB-based migrations need DBs to be open
    const notesReady = window.gBharatNotesManager?._db?._db;
    const memoriesReady = window.gBharatMemoryManager?._db?._db;

    if (notesReady && memoriesReady) {
      await nsBharatWorkspaceMigration._migrateNotes();
      await nsBharatWorkspaceMigration._migrateMemories();
      nsBharatWorkspaceMigration.markComplete();
      console.log("[Bharat Workspace] Migration complete.");
    } else if (retryCount < nsBharatWorkspaceMigration.MAX_RETRIES) {
      console.log(`[Bharat Workspace] DBs not ready, retrying in ${nsBharatWorkspaceMigration.RETRY_DELAY}ms (attempt ${retryCount + 1}/${nsBharatWorkspaceMigration.MAX_RETRIES})`);
      setTimeout(() => nsBharatWorkspaceMigration.run(retryCount + 1), nsBharatWorkspaceMigration.RETRY_DELAY);
    } else {
      console.warn("[Bharat Workspace] Migration timed out waiting for DBs. Chat/Research migrated, Notes/Memory skipped.");
      nsBharatWorkspaceMigration.markComplete();
    }
  }

  static async _migrateChatSessions() {
    try {
      const sessions = JSON.parse(
        Services.prefs.getStringPref("bharat.chat.sessions", "[]")
      );
      let modified = false;
      for (const session of sessions) {
        if (!session.workspaceId) {
          session.workspaceId = nsBharatWorkspaceMigration.DEFAULT_ID;
          modified = true;
        }
      }
      if (modified) {
        Services.prefs.setStringPref("bharat.chat.sessions", JSON.stringify(sessions));
        console.log(`[Bharat Workspace] Migrated ${sessions.length} chat sessions`);
      }
    } catch (e) {
      console.error("[Bharat Workspace] Chat migration error:", e);
    }
  }

  static async _migrateNotes() {
    if (!window.gBharatNotesManager?._db?._db) return;

    try {
      const db = window.gBharatNotesManager._db._db;
      const tx = db.transaction(["notes"], "readwrite");
      const store = tx.objectStore("notes");

      let count = 0;
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const note = cursor.value;
          if (!note.workspaceId) {
            note.workspaceId = nsBharatWorkspaceMigration.DEFAULT_ID;
            cursor.update(note);
            count++;
          }
          cursor.continue();
        } else {
          if (count > 0) {
            console.log(`[Bharat Workspace] Migrated ${count} notes`);
          }
        }
      };
    } catch (e) {
      console.error("[Bharat Workspace] Notes migration error:", e);
    }
  }

  static async _migrateMemories() {
    if (!window.gBharatMemoryManager?._db?._db) return;

    try {
      const db = window.gBharatMemoryManager._db._db;
      const tx = db.transaction(["memories"], "readwrite");
      const store = tx.objectStore("memories");

      let count = 0;
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const mem = cursor.value;
          if (!mem.workspaceId) {
            mem.workspaceId = nsBharatWorkspaceMigration.DEFAULT_ID;
            cursor.update(mem);
            count++;
          }
          cursor.continue();
        } else {
          if (count > 0) {
            console.log(`[Bharat Workspace] Migrated ${count} memories`);
          }
        }
      };
    } catch (e) {
      console.error("[Bharat Workspace] Memories migration error:", e);
    }
  }

  static async _migrateResearchHistory() {
    try {
      const history = JSON.parse(
        Services.prefs.getStringPref("bharat.research.history", "[]")
      );
      let modified = false;
      for (const entry of history) {
        if (!entry.workspaceId) {
          entry.workspaceId = nsBharatWorkspaceMigration.DEFAULT_ID;
          modified = true;
        }
      }
      if (modified) {
        Services.prefs.setStringPref("bharat.research.history", JSON.stringify(history));
        console.log(`[Bharat Workspace] Migrated ${history.length} research entries`);
      }
    } catch (e) {
      console.error("[Bharat Workspace] Research migration error:", e);
    }
  }
}
