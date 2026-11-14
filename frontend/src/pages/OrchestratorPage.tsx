import { useState } from 'react';
import { Sliders, Settings2, Activity, Play, Terminal, Database, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { runOrchestratorCommand } from '../lib/vault';

export function OrchestratorPage() {
  // Vault Factory State
  const [targetPath, setTargetPath] = useState('');
  const [blueprintPath, setBlueprintPath] = useState('');
  
  // Execution logs / output
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('System Console Idle. Waiting for command...');
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const executeCommand = async (taskName: string, command: string, args: string[]) => {
    setActiveTask(taskName);
    setIsGenerating(true);
    setLogs(`Executing background task: ${taskName}...\n\n`);
    setExecutionStatus('idle');
    setLastExitCode(null);

    const result = await runOrchestratorCommand(command, args);

    setIsGenerating(false);
    setActiveTask(null);

    if (result) {
      setLastExitCode(result.code);
      setExecutionStatus(result.success ? 'success' : 'error');
      
      let finalLogs = '';
      if (result.stdout) {
        finalLogs += `--- STANDARD OUTPUT ---\n${result.stdout}\n`;
      }
      if (result.stderr) {
        finalLogs += `--- STANDARD ERROR / DIAGNOSTICS ---\n${result.stderr}\n`;
      }
      if (!result.stdout && !result.stderr) {
        finalLogs += `Task completed with no direct terminal output.\n`;
      }
      finalLogs += `\nExit Code: ${result.code} (${result.success ? 'Success' : 'Failure'})`;
      
      setLogs(finalLogs);
    } else {
      setExecutionStatus('error');
      setLogs('Error: Failed to connect to the Orchestrator API server. Ensure the Express backend server is running and accessible.');
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath) return;

    const args = [targetPath];
    if (blueprintPath) {
      args.push('--from-vault', blueprintPath);
    }

    executeCommand('Spin Up New Vault (Factory)', 'generator', args);
  };

  const engineTasks = [
    {
      name: 'Validate Vault Purity',
      desc: 'Check hemisphere directories, file locations, and look for broken wikilinks.',
      icon: ShieldCheck,
      color: 'text-indigo-400',
      action: () => executeCommand('Validate Vault Purity', 'manager', ['validate'])
    },
    {
      name: 'Trigger Heartbeat Checks',
      desc: 'Run background sync tasks, check APIs, and update HEARTBEAT.md status.',
      icon: Activity,
      color: 'text-rose-400',
      action: () => executeCommand('Trigger Heartbeat Checks', 'query', ['heartbeat'])
    },
    {
      name: 'Update Database Index',
      desc: 'Re-index Knowledge Base files into sqlite-vec/fastembed for semantic vector search.',
      icon: Database,
      color: 'text-cyan-400',
      action: () => executeCommand('Update Database Index (Embed)', 'query', ['embed'])
    },
    {
      name: 'Compact Session Memory',
      desc: 'Clean up MEMORY.md to keep only the 5 most recent rolling session logs.',
      icon: Sparkles,
      color: 'text-amber-400',
      action: () => executeCommand('Compact Session Memory', 'query', ['compact'])
    },
    {
      name: 'Reset Heartbeat Checklist',
      desc: 'Clear checkboxes and last-run timestamps in HEARTBEAT.md for scheduled cron reuse.',
      icon: AlertTriangle,
      color: 'text-yellow-500',
      action: () => executeCommand('Reset Heartbeat Checklist', 'query', ['reset-heartbeat'])
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <Sliders className="w-8 h-8 text-[var(--color-right-hemisphere)] animate-pulse-subtle" />
          Vault Orchestrator Portal
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Manage the Vault Factory and trigger operational engine CLI commands directly from this panel
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Side: Controls */}
        <div className="space-y-6">
          {/* Vault Factory (Generator) */}
          <div className="card">
            <div className="card-header border-b border-[var(--color-border)] pb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[var(--color-right-hemisphere)]" />
              <h2 className="text-md font-bold text-[var(--color-text-primary)]">Vault Factory</h2>
            </div>
            <form onSubmit={handleGenerate} className="card-body p-5 space-y-4">
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Spin out a fresh, pristine Agentic Personal OS Obsidian Vault folder from your canonical golden image layout.
              </p>
              
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Target Destination Path *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C:\Repos\my-second-brain"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-right-hemisphere)] transition-all placeholder:text-[var(--color-text-muted)]/50"
                  disabled={isGenerating}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Blueprint Vault Source (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C:\Repos\gd-obsidian-agentic-vault\vault (default)"
                  value={blueprintPath}
                  onChange={(e) => setBlueprintPath(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-right-hemisphere)] transition-all placeholder:text-[var(--color-text-muted)]/50"
                  disabled={isGenerating}
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 font-semibold text-sm text-white shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                Generate Vault
              </button>
            </form>
          </div>

          {/* Engine Tasks */}
          <div className="card">
            <div className="card-header border-b border-[var(--color-border)] pb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--color-system)]" />
              <h2 className="text-md font-bold text-[var(--color-text-primary)]">Engine Actions</h2>
            </div>
            <div className="card-body p-4 divide-y divide-[var(--color-border)]">
              {engineTasks.map((task) => (
                <div key={task.name} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <task.icon className={`w-4 h-4 ${task.color}`} />
                      {task.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                      {task.desc}
                    </p>
                  </div>
                  <button
                    onClick={task.action}
                    disabled={isGenerating}
                    className="flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[var(--color-bg-tertiary)] hover:bg-white/5 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-50"
                  >
                    Run
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Log / Terminal Window */}
        <div className="flex flex-col h-full min-h-[450px]">
          <div className="card flex-1 flex flex-col overflow-hidden h-full">
            <div className="card-header border-b border-[var(--color-border)] pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h2 className="text-md font-bold text-[var(--color-text-primary)]">System Logs</h2>
              </div>
              
              {/* Task statuses */}
              {isGenerating ? (
                <span className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/40 border border-cyan-800 text-cyan-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Running: {activeTask}
                </span>
              ) : executionStatus === 'success' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 border border-emerald-800 text-emerald-400">
                  Exit Code: {lastExitCode} (SUCCESS)
                </span>
              ) : executionStatus === 'error' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/40 border border-rose-850 text-rose-400">
                  Exit Code: {lastExitCode} (FAILED)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  Console Idle
                </span>
              )}
            </div>
            
            <div className="card-body p-4 bg-black/40 font-mono text-xs overflow-y-auto leading-relaxed flex-1 whitespace-pre-wrap select-text text-emerald-400/90 h-[500px]">
              {logs}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
