type HeaderProps = {
  onOpenSettings: () => void;
  onExport: () => void;
};

export default function Header({ onOpenSettings, onExport }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-elevated">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">TwinMind Copilot</h1>
        <span className="text-xs text-text-faint hidden sm:inline">
          Live meeting assistant
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="text-sm px-3 py-1.5 rounded-md border border-border hover:border-border-strong hover:bg-bg-card transition-colors text-text-muted hover:text-text"
        >
          Export
        </button>
        <button
          onClick={onOpenSettings}
          className="text-sm px-3 py-1.5 rounded-md border border-border hover:border-border-strong hover:bg-bg-card transition-colors text-text-muted hover:text-text"
        >
          Settings
        </button>
      </div>
    </header>
  );
}