import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DataSource,
  Question,
  PassageSet,
  GenerationConfig,
  AppSettings,
  ViewType,
  GoogleAuthState,
} from '../types'

interface AppState {
  dataSources: DataSource[]
  questions: Question[]
  passageSets: PassageSet[]
  activeView: ViewType
  questionListTab: 'individual' | 'passage'
  generationConfig: GenerationConfig
  settings: AppSettings
  isGenerating: boolean
  generationProgress: string
  googleAuth: GoogleAuthState | null
  urlHistory: string[]

  // DataSource
  addDataSource: (source: DataSource) => void
  removeDataSource: (id: string) => void
  toggleDataSource: (id: string) => void
  clearDataSources: () => void

  // Questions
  appendQuestions: (questions: Question[]) => void
  removeQuestion: (id: string) => void
  toggleQuestion: (id: string) => void
  updateQuestion: (id: string, updates: Partial<Question>) => void
  clearQuestions: () => void

  // PassageSets
  appendPassageSets: (sets: PassageSet[]) => void
  removePassageSet: (id: string) => void
  togglePassageSet: (id: string) => void
  clearPassageSets: () => void

  // UI
  setActiveView: (view: ViewType) => void
  setQuestionListTab: (tab: 'individual' | 'passage') => void
  updateGenerationConfig: (config: Partial<GenerationConfig>) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  setIsGenerating: (b: boolean) => void
  setGenerationProgress: (p: string) => void
  setGoogleAuth: (auth: GoogleAuthState | null) => void
  addUrlHistory: (url: string) => void
  clearUrlHistory: () => void
}

const defaultConfig: GenerationConfig = {
  generationMode: 'individual',
  levels: ['high_exam'],
  customLevel: '',
  questionTypes: ['multiple_choice_4'],
  count: 10,
  passageCount: 2,
  questionsPerPassage: 5,
  subject: '',
  additionalInstructions: '',
  curriculumStage: 'none',
}

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite-preview',
  googleClientId: '',
  googleClientSecret: '',
  seibuturagBaseUrl: 'http://localhost:3001',
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      dataSources: [],
      questions: [],
      passageSets: [],
      activeView: 'datasource',
      questionListTab: 'individual',
      generationConfig: defaultConfig,
      settings: defaultSettings,
      isGenerating: false,
      generationProgress: '',
      googleAuth: null,
      urlHistory: [],

      addDataSource: (source) =>
        set((s) => ({ dataSources: [...s.dataSources, source] })),
      removeDataSource: (id) =>
        set((s) => ({ dataSources: s.dataSources.filter((d) => d.id !== id) })),
      toggleDataSource: (id) =>
        set((s) => ({
          dataSources: s.dataSources.map((d) =>
            d.id === id ? { ...d, selected: !d.selected } : d
          ),
        })),
      clearDataSources: () => set({ dataSources: [] }),

      appendQuestions: (questions) =>
        set((s) => ({ questions: [...s.questions, ...questions] })),
      removeQuestion: (id) =>
        set((s) => ({ questions: s.questions.filter((q) => q.id !== id) })),
      toggleQuestion: (id) =>
        set((s) => ({
          questions: s.questions.map((q) =>
            q.id === id ? { ...q, checked: !q.checked } : q
          ),
        })),
      updateQuestion: (id, updates) =>
        set((s) => ({
          questions: s.questions.map((q) =>
            q.id === id ? { ...q, ...updates } : q
          ),
        })),
      clearQuestions: () => set({ questions: [] }),

      appendPassageSets: (sets) =>
        set((s) => ({ passageSets: [...s.passageSets, ...sets] })),
      removePassageSet: (id) =>
        set((s) => ({ passageSets: s.passageSets.filter((p) => p.id !== id) })),
      togglePassageSet: (id) =>
        set((s) => ({
          passageSets: s.passageSets.map((p) =>
            p.id === id ? { ...p, checked: !p.checked } : p
          ),
        })),
      clearPassageSets: () => set({ passageSets: [] }),

      setActiveView: (view) => set({ activeView: view }),
      setQuestionListTab: (tab) => set({ questionListTab: tab }),
      updateGenerationConfig: (config) =>
        set((s) => ({
          generationConfig: { ...s.generationConfig, ...config },
        })),
      updateSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),
      setIsGenerating: (b) => set({ isGenerating: b }),
      setGenerationProgress: (p) => set({ generationProgress: p }),
      setGoogleAuth: (auth) => set({ googleAuth: auth }),
      addUrlHistory: (url) =>
        set((s) => ({
          urlHistory: [url, ...s.urlHistory.filter((u) => u !== url)].slice(0, 20),
        })),
      clearUrlHistory: () => set({ urlHistory: [] }),
    }),
    {
      name: 'mongene-v1',
      version: 5,
      migrate: (state: any) => {
        const prevConfig = state.generationConfig ?? {}
        const validStages = ['none', 'high_biology', 'high_biology_basic']
        const validModes = ['individual', 'passage', 'figure']
        return {
          ...state,
          passageSets: state.passageSets ?? [],
          urlHistory: Array.isArray(state.urlHistory) ? state.urlHistory : [],
          generationConfig: {
            passageCount: 2,
            questionsPerPassage: 5,
            ...prevConfig,
            generationMode: validModes.includes(prevConfig.generationMode)
              ? prevConfig.generationMode
              : 'individual',
            curriculumStage: validStages.includes(prevConfig.curriculumStage)
              ? prevConfig.curriculumStage
              : 'none',
          },
        }
      },
      partialize: (s) => ({
        dataSources: s.dataSources,
        questions: s.questions,
        passageSets: s.passageSets,
        generationConfig: s.generationConfig,
        settings: s.settings,
        urlHistory: s.urlHistory,
      }),
    }
  )
)
