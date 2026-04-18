/** Web build shim for @tauri-apps/api/event */

export type UnlistenFn = () => void

export async function listen<T>(
  _event: string,
  _handler: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  // No-op in web builds – Tauri IPC events are not available
  return () => {}
}
