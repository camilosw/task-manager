import { AppStateProvider } from './ui/AppStateProvider'
import { TaskManagerApp } from './ui/TaskManagerApp'
import { ThemeProvider } from './ui/ThemeProvider'
import { createIndexedDbRepository } from './persistence/indexedDbRepository'

// Created once at module scope rather than inside the component: the
// repository has no per-render inputs, and re-creating it on every render
// would give AppStateProvider's load effect a new dependency each time
// (see src/ui/AppStateProvider.tsx's effect, which depends on `repository`).
const repository = createIndexedDbRepository()

function App() {
  return (
    <ThemeProvider>
      <AppStateProvider repository={repository}>
        <TaskManagerApp />
      </AppStateProvider>
    </ThemeProvider>
  )
}

export default App
