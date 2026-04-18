/**
 * Google Apps Script HTML Service ランタイムラッパー
 * - GAS 環境では google.script.run を Promise 化して使用
 * - GAS 以外の環境（dev / GitHub Pages）では localStorage のみ使用
 */

// GAS が注入する型宣言
interface GoogleScriptRun {
  withSuccessHandler(fn: (result: unknown) => void): GoogleScriptRun
  withFailureHandler(fn: (err: { message: string }) => void): GoogleScriptRun
  serverLoadState(): void
  serverSaveState(json: string): void
}

declare global {
  interface Window {
    google?: {
      script: {
        run: GoogleScriptRun
      }
    }
  }
}

/** GAS 環境かどうかを判定 */
export const isGAS = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.google !== 'undefined' &&
  typeof window.google?.script !== 'undefined'

/** google.script.run を Promise 化するユーティリティ */
function gasRun<T>(fnName: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const runner = window.google!.script.run
      .withSuccessHandler((result) => resolve(result as T))
      .withFailureHandler((err: { message: string }) => reject(new Error(err.message ?? String(err))))
    ;(runner as unknown as Record<string, (...a: unknown[]) => void>)[fnName](...args)
  })
}

/** スプレッドシートから状態を読み込む */
export async function gasLoadState(): Promise<Record<string, unknown> | null> {
  if (!isGAS()) return null
  try {
    const json = await gasRun<string>('serverLoadState')
    return json ? (JSON.parse(json) as Record<string, unknown>) : null
  } catch (err) {
    console.error('[GAS] loadState failed:', err)
    return null
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

/** スプレッドシートへ状態を保存（1.5 秒デバウンス） */
export function gasSaveState(state: Record<string, unknown>): void {
  if (!isGAS()) return
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try {
      await gasRun<string>('serverSaveState', JSON.stringify(state))
    } catch (err) {
      console.error('[GAS] saveState failed:', err)
    }
  }, 1500)
}
