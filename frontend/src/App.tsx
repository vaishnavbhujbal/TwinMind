import { useState } from "react";
import Header from "./components/Header";
import MicColumn from "./components/MicColumn";
import SuggestionsColumn from "./components/SuggestionsColumn";
import ChatColumn from "./components/ChatColumn";
import SettingsModal from "./components/SettingsModal";
import { useSettings } from "./context/SettingsContext";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { hasApiKey } = useSettings();

  const handleExport = () => {
    // TODO: Step 9 — export session JSON
    console.log("export session");
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-text">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={handleExport}
      />

      {!hasApiKey && (
        <div className="px-6 py-2 bg-accent-orange/10 border-b border-accent-orange/30 text-accent-orange text-sm">
          No Groq API key set.{" "}
          <button
            onClick={() => setSettingsOpen(true)}
            className="underline hover:no-underline"
          >
            Add one in Settings
          </button>{" "}
          to begin.
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        <MicColumn />
        <SuggestionsColumn />
        <ChatColumn />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;