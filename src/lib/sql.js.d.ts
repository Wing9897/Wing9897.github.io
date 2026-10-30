declare module 'sql.js' {
  export type SqlValue = string | number | Uint8Array | null

  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export interface Statement {
    bind(values?: SqlValue[] | Record<string, SqlValue>): boolean
    step(): boolean
    get(): SqlValue[]
    getColumnNames(): string[]
    free(): boolean
  }

  export interface Database {
    exec(sql: string, params?: SqlValue[] | Record<string, SqlValue>): QueryExecResult[]
    run(sql: string, params?: SqlValue[] | Record<string, SqlValue>): Database
    prepare(sql: string, params?: SqlValue[] | Record<string, SqlValue>): Statement
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
