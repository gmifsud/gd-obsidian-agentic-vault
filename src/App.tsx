import { Brain, Cpu, Zap, Lock, Unlock, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold text-neutral-100 tracking-tight">Agentic Vault Architect</h1>
          <p className="text-neutral-400 mt-2">Phase 6: Dynamic MOC Synchronization</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Split-Brain Architecture */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg flex flex-col">
            <h2 className="text-xl font-semibold text-neutral-100 mb-6 flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-400" />
              The Split-Brain Vault Model
            </h2>
            
            <div className="space-y-6 flex-grow">
              {/* Left Hemisphere */}
              <div className="bg-neutral-950/50 p-5 rounded-lg border border-neutral-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-blue-300 font-semibold flex items-center gap-2">
                    Left Hemisphere
                    <span className="text-xs bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded-full">Human</span>
                  </h3>
                  <Lock className="w-4 h-4 text-neutral-500" />
                </div>
                <p className="text-xs text-neutral-400 mb-3">Raw input, daily logs, unstructured thoughts. <strong className="text-neutral-300">AI is READ-ONLY.</strong></p>
                <ul className="text-sm font-mono text-neutral-300 space-y-1">
                  <li>📁 01_Daily_Notes/</li>
                  <li>📁 02_Human_Thoughts/</li>
                </ul>
              </div>

              {/* Right Hemisphere */}
              <div className="bg-neutral-950/50 p-5 rounded-lg border border-neutral-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-emerald-300 font-semibold flex items-center gap-2">
                    Right Hemisphere
                    <span className="text-xs bg-emerald-900/50 text-emerald-200 px-2 py-0.5 rounded-full">AI Agent</span>
                  </h3>
                  <Unlock className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xs text-neutral-400 mb-3">Structured knowledge, SOPs, automation. <strong className="text-neutral-300">AI is READ/WRITE.</strong></p>
                <ul className="text-sm font-mono text-neutral-300 space-y-1 grid grid-cols-2 gap-x-4">
                  <li>📁 00_MOCs/</li>
                  <li>📁 10_Repositories/</li>
                  <li>📁 20_DevOps/</li>
                  <li>📁 30_Git/</li>
                  <li>📁 80_Templates/</li>
                  <li>📁 90_Assets/</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Agent Memory & Workflows */}
          <div className="space-y-8 flex flex-col">
            {/* Dynamic MOC Sync */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                Dynamic MOC Sync Protocol
              </h2>
              <p className="text-sm text-neutral-400 mb-4">
                Agents are now equipped with a Node.js script (`scripts/update_moc.js`) and strict prompt instructions to automatically update Maps of Content when new files are created.
              </p>
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
<span className="text-purple-400 font-bold"># MOC Update Protocol</span>
Whenever you create a new file in the Right Hemisphere, you MUST dynamically update the corresponding MOC.

<span className="text-blue-300">- Automated:</span> Run `node scripts/update_moc.js &lt;path/to/new/file.md&gt;`
<span className="text-blue-300">- Manual:</span> Open the relevant MOC, locate `## Static Agent Index`, and append: `- [[File Name]] | key: value`
                </pre>
              </div>
            </section>

            {/* Workflows */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg flex-grow">
              <h2 className="text-xl font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Workflow Logic
              </h2>
              
              <div className="space-y-4">
                <div className="border-l-2 border-yellow-500 pl-4">
                  <h3 className="text-sm font-bold text-neutral-200 font-mono">/new [input]</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    <strong>Logic:</strong> Agent reads raw input &rarr; Selects template &rarr; Generates structured markdown &rarr; Saves to Right Hemisphere &rarr; <span className="text-cyan-400 font-semibold">Executes `update_moc.js` to sync MOC.</span>
                  </p>
                </div>
                
                <div className="border-l-2 border-yellow-500 pl-4">
                  <h3 className="text-sm font-bold text-neutral-200 font-mono">/today</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    <strong>Logic:</strong> Agent scans `01_Daily_Notes/` &rarr; Extracts tasks &rarr; Cross-references with Right Hemisphere &rarr; Outputs prioritized task list.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-8 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-200 text-sm flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p><strong>Phase 6 Complete.</strong> The Dynamic MOC Synchronization mechanism (Node script + Agent Prompts) is fully integrated.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
