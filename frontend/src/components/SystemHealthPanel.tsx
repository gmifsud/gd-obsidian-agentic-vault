import { Target, AlertTriangle, ScrollText, Heart, Activity } from 'lucide-react';

interface SystemHealthPanelProps {
  memoryFocus: string;
  memoryBlockers?: string;
  heartbeatChecked: number;
  heartbeatTotal: number;
  lastLogEntry?: string;
}

export function SystemHealthPanel({
  memoryFocus,
  memoryBlockers,
  heartbeatChecked,
  heartbeatTotal,
  lastLogEntry,
}: SystemHealthPanelProps) {
  const heartbeatPercent = heartbeatTotal > 0 ? (heartbeatChecked / heartbeatTotal) * 100 : 0;

  return (
    <div className="card hemisphere-system">
      <div className="card-header">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-system)]" />
          System Health
        </h3>
      </div>
      <div className="card-body space-y-5">
        {/* Current Focus */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Current Focus
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed pl-5">
            {memoryFocus || 'No focus set'}
          </p>
        </div>

        {/* Blockers */}
        {memoryBlockers && memoryBlockers.toLowerCase() !== 'none' && !memoryBlockers.toLowerCase().includes('none.') && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Active Blockers
              </span>
            </div>
            <p className="text-sm text-amber-300/80 leading-relaxed pl-5">
              {memoryBlockers}
            </p>
          </div>
        )}

        {/* Heartbeat Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--color-system)]" />
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Heartbeat
              </span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {heartbeatChecked}/{heartbeatTotal} tasks
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill"
              style={{ width: `${heartbeatPercent}%` }}
            />
          </div>
        </div>

        {/* Last Log Entry */}
        {lastLogEntry && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ScrollText className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Last Action
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] pl-5 font-mono">
              {lastLogEntry}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
