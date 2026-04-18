/**
 * GAS ↔ Zustand ストア 同期モジュール
 * アプリ起動時に呼び出す。GAS 環境でのみ動作する。
 */

import { useAppStore } from '../store/appStore'
import { isGAS, gasLoadState, gasSaveState } from './gasRuntime'
import type { AppSettings, GenerationConfig, DataSource, Question, PassageSet } from '../types'

let _subscribed = false

export async function initGASSync(): Promise<void> {
  if (!isGAS()) return

  // ① スプレッドシートからデータを読み込んでストアに反映
  const gasState = await gasLoadState()
  if (gasState) {
    const patch: Partial<ReturnType<typeof useAppStore.getState>> = {}

    if (Array.isArray(gasState.questions))
      patch.questions = gasState.questions as Question[]
    if (Array.isArray(gasState.passageSets))
      patch.passageSets = gasState.passageSets as PassageSet[]
    if (Array.isArray(gasState.dataSources))
      patch.dataSources = gasState.dataSources as DataSource[]
    if (Array.isArray(gasState.urlHistory))
      patch.urlHistory = gasState.urlHistory as string[]
    if (gasState.generationConfig)
      patch.generationConfig = gasState.generationConfig as GenerationConfig
    if (gasState.settings)
      patch.settings = gasState.settings as AppSettings

    useAppStore.setState(patch)
    console.log('[GAS] ストアをスプレッドシートから復元しました')
  }

  // ② ストアの変更を監視してスプレッドシートへ自動保存
  if (!_subscribed) {
    _subscribed = true
    useAppStore.subscribe((state) => {
      gasSaveState({
        questions:        state.questions,
        passageSets:      state.passageSets,
        dataSources:      state.dataSources,
        generationConfig: state.generationConfig,
        settings:         state.settings,
        urlHistory:       state.urlHistory,
      })
    })
  }
}
