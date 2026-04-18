/** Web build shim for @tauri-apps/api/core */

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (command === 'save_bytes_to_downloads') {
    const { filename, data } = args as { filename: string; data: number[] }
    const bytes = new Uint8Array(data)
    const blob = new Blob([bytes])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return filename as T
  }

  if (command === 'open_notebooklm_window') {
    alert('この機能はデスクトップアプリでのみ使用できます。')
    return undefined as T
  }

  if (command === 'start_oauth_server') {
    throw new Error('OAuth サーバー機能はデスクトップアプリでのみ使用できます。')
  }

  console.warn(`[Web shim] invoke('${command}') は Web では利用できません`)
  throw new Error(`[Web] invoke('${command}') is not supported`)
}
