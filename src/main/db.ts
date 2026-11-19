import { app } from 'electron'
import { join } from 'node:path'
import fs from 'node:fs'
import type { HistoryRecord, ModuleId } from '@shared/types'

// History store backed by better-sqlite3 when the native module loads,
// otherwise a durable JSON file so the app never loses functionality.
interface Store {
  insert(rec: Omit<HistoryRecord, 'id'>): HistoryRecord
  list(filter?: { module?: ModuleId; limit?: number }): HistoryRecord[]
  get(id: number): HistoryRecord | null
  remove(id: number): void
  clear(): void
}

let store: Store | null = null

function jsonStore(file: string): Store {
  let rows: HistoryRecord[] = []
  try {
    if (fs.existsSync(file)) rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    rows = []
  }
  const persist = (): void => {
    try {
      fs.writeFileSync(file, JSON.stringify(rows))
    } catch {
      /* ignore */
    }
  }
  let nextId = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1
  return {
    insert(rec) {
      const row: HistoryRecord = { ...rec, id: nextId++ }
      rows.unshift(row)
      persist()
      return row
    },
    list(filter) {
      let out = rows
      if (filter?.module) out = out.filter((r) => r.module === filter.module)
      return filter?.limit ? out.slice(0, filter.limit) : out
    },
    get: (id) => rows.find((r) => r.id === id) ?? null,
    remove(id) {
      rows = rows.filter((r) => r.id !== id)
      persist()
    },
    clear() {
      rows = []
      persist()
    }
  }
}

function sqliteStore(file: string): Store {
  // Lazy require so a failed native load falls back to JSON.
  const Database = require('better-sqlite3')
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    target TEXT,
    createdAt INTEGER NOT NULL,
    summary TEXT NOT NULL,
    data TEXT NOT NULL
  )`)
  const insertStmt = db.prepare(
    `INSERT INTO history (module, title, target, createdAt, summary, data)
     VALUES (@module, @title, @target, @createdAt, @summary, @data)`
  )
  return {
    insert(rec) {
      const info = insertStmt.run(rec)
      return { ...rec, id: Number(info.lastInsertRowid) }
    },
    list(filter) {
      if (filter?.module) {
        return db
          .prepare(`SELECT * FROM history WHERE module = ? ORDER BY createdAt DESC LIMIT ?`)
          .all(filter.module, filter.limit ?? 500) as HistoryRecord[]
      }
      return db
        .prepare(`SELECT * FROM history ORDER BY createdAt DESC LIMIT ?`)
        .all(filter?.limit ?? 500) as HistoryRecord[]
    },
    get: (id) => (db.prepare(`SELECT * FROM history WHERE id = ?`).get(id) as HistoryRecord) ?? null,
    remove: (id) => void db.prepare(`DELETE FROM history WHERE id = ?`).run(id),
    clear: () => void db.exec(`DELETE FROM history`)
  }
}

export function getStore(): Store {
  if (store) return store
  const dir = app.getPath('userData')
  try {
    store = sqliteStore(join(dir, 'pingus.db'))
  } catch (err) {
    console.warn('[pingus] SQLite unavailable, using JSON store:', (err as Error).message)
    store = jsonStore(join(dir, 'pingus-history.json'))
  }
  return store
}
