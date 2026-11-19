import { useEffect, useState } from 'react'
import { Save, Check, Wrench, Info } from 'lucide-react'
import type { AppSettings, ToolAvailability } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Label, Field, Button, StatusDot, Badge } from '../components/ui'

export function SettingsView(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [tools, setTools] = useState<ToolAvailability>({ nmap: false, tshark: false })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.pingus.getSettings().then(setSettings)
    window.pingus.detectTools().then(setTools)
  }, [])

  if (!settings) return <div />

  const update = (patch: Partial<AppSettings>): void => setSettings((s) => (s ? { ...s, ...patch } : s))

  const save = async (): Promise<void> => {
    const next = await window.pingus.setSettings(settings)
    setSettings(next)
    setTools(await window.pingus.detectTools())
    setSaved(true)
    setTimeout(() => setSaved(false), 1400)
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Application preferences and tool integrations"
        actions={<Button variant="primary" icon={saved ? <Check size={15} /> : <Save size={15} />} onClick={save}>{saved ? 'Saved' : 'Save'}</Button>}
      />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-6 p-6">
          <CardHeader title="Monitoring" />
          <div className="mt-5 space-y-5">
            <NumberField label="Ping interval (ms)" value={settings.pingIntervalMs} min={250} max={10000} onChange={(v) => update({ pingIntervalMs: v })} />
            <NumberField label="Ping timeout (ms)" value={settings.pingTimeoutMs} min={500} max={10000} onChange={(v) => update({ pingTimeoutMs: v })} />
            <Toggle label="Auto-save scan history" value={settings.autosaveHistory} onChange={(v) => update({ autosaveHistory: v })} />
            <Toggle label="Show authorization reminders" value={settings.authorizedOnly} onChange={(v) => update({ authorizedOnly: v })} />
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-6 p-6">
          <CardHeader title="Integrations" action={<Wrench size={15} className="text-ink-500" />} />
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Nmap</Label>
                <StatusDot state={tools.nmap ? 'good' : 'bad'} label={tools.nmap ? 'Detected' : 'Not found'} />
              </div>
              <Field placeholder="nmap (or full path to nmap.exe)" value={settings.nmapPath ?? ''} onChange={(e) => update({ nmapPath: e.target.value || null })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>TShark / Wireshark</Label>
                <StatusDot state={tools.tshark ? 'good' : 'bad'} label={tools.tshark ? 'Detected' : 'Not found'} />
              </div>
              <Field placeholder="tshark (or full path to tshark.exe)" value={settings.tsharkPath ?? ''} onChange={(e) => update({ tsharkPath: e.target.value || null })} />
            </div>
            <p className="text-xs text-ink-500 leading-relaxed">
              Leave blank to use the system PATH. Save to re-detect. Nmap enables service/version
              detection in the Port Scanner; TShark enables the Packet Analyzer.
            </p>
          </div>
        </Card>

        <Card className="col-span-12 p-6">
          <CardHeader title="About" action={<Info size={15} className="text-ink-500" />} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="outline">PingUs v0.1.0</Badge>
            <Badge tone="outline">Electron · React · TypeScript</Badge>
            <Badge tone="outline">Local-first</Badge>
          </div>
          <p className="mt-4 text-sm text-ink-400 leading-relaxed max-w-2xl">
            PingUs is an all-in-one network diagnostics and monitoring suite. All scans run locally on
            this machine using real network data. Use these tools only on networks and systems you own
            or are explicitly authorized to assess.
          </p>
        </Card>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }): JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      <Field
        className="mt-2"
        type="number"
        value={String(value)}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
        }}
      />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-200">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`no-drag relative h-6 w-11 rounded-full transition-colors duration-300 ${value ? 'bg-ink-100' : 'bg-ink-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink-900 transition-transform duration-300 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
