import Sidebar from './components/Sidebar'
import DataSourceView from './components/DataSourceView'
import GeneratorView from './components/GeneratorView'
import QuestionListView from './components/QuestionListView'
import SettingsView from './components/SettingsView'
import { useAppStore } from './store/appStore'

function App() {
  const activeView = useAppStore((s) => s.activeView)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-surface)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeView === 'datasource' && <DataSourceView />}
        {activeView === 'generator'  && <GeneratorView />}
        {activeView === 'questions'  && <QuestionListView />}
        {activeView === 'settings'   && <SettingsView />}
      </main>
    </div>
  )
}

export default App
