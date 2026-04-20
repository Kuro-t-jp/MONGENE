import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import QuestionListView from './components/QuestionListView'
import { initGASSync } from './lib/gasSync'

function App() {
  useEffect(() => {
    initGASSync()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-surface)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <QuestionListView />
      </main>
    </div>
  )
}

export default App
