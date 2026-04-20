import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { ReasoningEffort, Settings } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsModal({ open, onClose }: Props) {
  const { settings, updateSettings, resetSettings } = useSettings();

  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setAdvancedOpen(false);
    }
  }, [open, settings]);

  if (!open) return null;

  const handleSave = () => {
    updateSettings(draft);
    onClose();
  };

  const handleReset = () => {
    if (confirm("Reset prompts and parameters to defaults? Your API key is preserved.")) {
      resetSettings();
      onClose();
    }
  };

  // Note: trailing comma after `K` disambiguates from JSX in a .tsx file.
  const setField = <K extends keyof Settings,>(key: K, value: Settings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-bg-elevated border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-elevated z-10">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-text mb-1">Groq API key</h3>
            <p className="text-xs text-text-faint mb-3">
              Your key is stored only in this browser and sent to your backend
              per request. It is never logged or persisted.
            </p>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={draft.groq_api_key}
                onChange={(e) => setField("groq_api_key", e.target.value)}
                placeholder="gsk_..."
                className="flex-1 px-3 py-2 rounded-md bg-bg-card border border-border text-sm font-mono outline-none focus:border-border-strong"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="px-3 py-2 rounded-md border border-border hover:border-border-strong text-sm text-text-muted"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-text-faint mt-2">
              Need a key? Get one free at{" "}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noreferrer"
                className="text-accent-blue hover:underline"
              >
                console.groq.com
              </a>
              .
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center justify-between py-3 text-sm text-text-muted hover:text-text"
            >
              <span className="font-medium">Advanced settings</span>
              <span className="text-xs">
                {advancedOpen ? "Hide" : "Show"}
              </span>
            </button>
            <p className="text-xs text-text-faint -mt-1 mb-2">
              Prompts and parameters come with optimized defaults. Edit only if
              you want to customize behavior.
            </p>
          </div>

          {advancedOpen && (
            <div className="space-y-6">
              <Section title="Behavior">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Auto-refresh (seconds)"
                    value={draft.auto_refresh_seconds}
                    min={10}
                    max={120}
                    onChange={(n) => setField("auto_refresh_seconds", n)}
                  />
                  <NumberField
                    label="Suggestions context (chars)"
                    value={draft.suggestions_context_chars}
                    min={500}
                    max={20000}
                    onChange={(n) => setField("suggestions_context_chars", n)}
                  />
                  <NumberField
                    label="Detailed context (chars)"
                    value={draft.detailed_context_chars}
                    min={1000}
                    max={100000}
                    onChange={(n) => setField("detailed_context_chars", n)}
                  />
                </div>
              </Section>

              <Section
                title="Reasoning effort"
                description="GPT-OSS 120B supports variable reasoning depth per call. Higher = better answers, slower."
              >
                <div className="grid grid-cols-3 gap-3">
                  <EffortField
                    label="Suggestions"
                    value={draft.suggestions_effort}
                    onChange={(v) => setField("suggestions_effort", v)}
                  />
                  <EffortField
                    label="Detailed answers"
                    value={draft.detailed_effort}
                    onChange={(v) => setField("detailed_effort", v)}
                  />
                  <EffortField
                    label="Chat"
                    value={draft.chat_effort}
                    onChange={(v) => setField("chat_effort", v)}
                  />
                </div>
              </Section>

              <Section title="Live suggestions prompt">
                <PromptField
                  value={draft.suggestions_prompt}
                  onChange={(v) => setField("suggestions_prompt", v)}
                />
              </Section>

              <Section title="Detailed answer prompt (on suggestion click)">
                <PromptField
                  value={draft.detailed_prompt}
                  onChange={(v) => setField("detailed_prompt", v)}
                />
              </Section>

              <Section title="Chat prompt">
                <PromptField
                  value={draft.chat_prompt}
                  onChange={(v) => setField("chat_prompt", v)}
                />
              </Section>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border sticky bottom-0 bg-bg-elevated">
          <button
            onClick={handleReset}
            className="text-sm px-3 py-2 rounded-md text-text-muted hover:text-accent-orange"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border border-border hover:border-border-strong text-text-muted hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-sm px-4 py-2 rounded-md bg-accent-blue hover:bg-accent-blue/80 text-white font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-text mb-1">{title}</h3>
      {description && <p className="text-xs text-text-faint mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted block mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full px-3 py-2 rounded-md bg-bg-card border border-border text-sm outline-none focus:border-border-strong"
      />
    </label>
  );
}

function EffortField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReasoningEffort;
  onChange: (v: ReasoningEffort) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted block mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ReasoningEffort)}
        className="w-full px-3 py-2 rounded-md bg-bg-card border border-border text-sm outline-none focus:border-border-strong"
      >
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
    </label>
  );
}

function PromptField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={10}
      className="w-full px-3 py-2 rounded-md bg-bg-card border border-border text-xs font-mono leading-relaxed outline-none focus:border-border-strong resize-y"
    />
  );
}