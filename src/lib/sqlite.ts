import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'

const SQL_WASM_URL = '/sql-wasm.wasm'

export type SqlQueryResult = {
  columns: string[]
  values: SqlValue[][]
}

let pending: Promise<SqlJsStatic> | null = null

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!pending) {
    pending = initSqlJs({
      locateFile: () => SQL_WASM_URL,
    }).catch((error: unknown) => {
      pending = null
      throw error
    })
  }
  return pending
}

export async function openDatabase(bytes: ArrayBuffer): Promise<Database> {
  const SQL = await loadSqlJs()
  return new SQL.Database(new Uint8Array(bytes))
}

function stripSqlLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:""|[^"])*"/g, '""')
}

function assertReadonly(sql: string): string {
  const statement = sql.trim().replace(/;+\s*$/g, '')
  if (!statement) throw new Error('查詢是空的')
  const bare = stripSqlLiterals(statement).trim()
  if (bare.includes(';')) throw new Error('只允許單一句查詢')
  if (!/^(select|with|pragma|explain)\b/i.test(bare)) throw new Error('只允許唯讀查詢')
  if (/^pragma\b/i.test(bare) && bare.includes('=')) throw new Error('只允許唯讀查詢')
  if (
    /\b(insert|update|delete|drop|alter|create|replace|attach|detach|reindex|vacuum|begin|commit|rollback|savepoint)\b/i.test(
      bare,
    )
  ) {
    throw new Error('只允許唯讀查詢')
  }
  return statement
}

export function queryReadonly(db: Database, sql: string): SqlQueryResult {
  const statement = assertReadonly(sql)
  const prepared = db.prepare(statement)
  try {
    const columns = prepared.getColumnNames()
    const values: SqlValue[][] = []
    while (prepared.step()) values.push(prepared.get())
    return { columns, values }
  } finally {
    prepared.free()
  }
}

export function exportDatabase(db: Database): Uint8Array {
  return db.export()
}

export function exportDatabaseBlob(db: Database): Blob {
  const bytes = exportDatabase(db)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/x-sqlite3' })
}
