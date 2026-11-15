import { useEffect, useState } from 'react';
import { distillSession, lifecycleRequest, LifecycleCapabilities, SessionDetail, SessionSummary } from '../lib/vault';

type Claim = { text: string; state: string; evidenceId: string; quote: string };
type Preview = { path: string; content: string; revision: string; review_state: string };
const STATES = ['proposal', 'observation', 'verified_result', 'accepted_decision', 'unknown'];
const control = 'w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-xs';

export function KnowledgeDraft({ session, detail }: { session: SessionSummary; detail: SessionDetail | null }) {
  const [capabilities, setCapabilities] = useState<LifecycleCapabilities | null>(null);
  const [directory, setDirectory] = useState('');
  const [kind, setKind] = useState<'synthesis' | 'troubleshooting' | 'adr'>('synthesis');
  const [title, setTitle] = useState(session.topic || 'Session knowledge');
  const [claims, setClaims] = useState<Record<string, Claim>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [updateConfirmed, setUpdateConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    lifecycleRequest<LifecycleCapabilities>('capabilities').then(data => {
      if (active) { setCapabilities(data); setDirectory(data.targets[0] || ''); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  const setClaim = (section: string, patch: Partial<Claim>) => setClaims(previous => ({
    ...previous, [section]: { text: '', state: 'proposal', evidenceId: '', quote: '', ...previous[section], ...patch },
  }));
  const publish = async () => {
    if (!detail?.record) return;
    setBusy(true); setMessage(''); setConfirmed(false);
    try {
      const sections = Object.fromEntries(Object.entries(claims).filter(([heading, c]) =>
        capabilities?.sections[kind]?.includes(heading) && c.text.trim()).map(([heading, c]) =>
        [heading, [{ text: c.text, state: c.state, evidence: [{ id: c.evidenceId, quote: c.quote }] }]]));
      const candidate = { schema_version: 1, source_key: detail.record.source_key,
        source_revision: detail.record.source_revision, title, kind, sections };
      const result = await distillSession(session.provider, session.id, directory, kind, title,
        candidate, session.sourceKey, updateConfirmed ? preview?.revision : undefined);
      setMessage(result.status === 'partial'
        ? `Partially saved: ${result.notePath}. ${result.error || 'Retry to repair references.'}`
        : result.success ? `${result.status}: ${result.review_state} — ${result.notePath}` : result.error || 'Publication failed');
      if (result.notePath) {
        setPreview(await lifecycleRequest<Preview>('preview', { path: result.notePath }));
        setUpdateConfirmed(false);
      }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const review = async (revoke = false) => {
    if (!preview) return;
    setBusy(true);
    try {
      await lifecycleRequest('review', { path: preview.path, expected_revision: preview.revision,
        reviewer, human_confirmed: confirmed, revoke });
      setPreview(await lifecycleRequest<Preview>('preview', { path: preview.path }));
      setMessage(revoke ? 'Review revoked. Excluded from default briefings.' : 'This revision is reviewed and eligible for future-task briefings.');
      setConfirmed(false);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  if (!detail?.qualified) return <p className="p-3 text-xs text-amber-300">
    Knowledge creation requires a complete qualified Codex source. Current state: {detail?.parseStatus || 'unqualified'}.
  </p>;
  return <div className="p-3 space-y-3 border-b border-[var(--color-border)] max-h-[65vh] overflow-y-auto">
    <p className="text-xs">Write supported claims using the evidence below. Empty sections remain unknown. Saved notes begin as drafts.</p>
    <label className="block text-xs">Title<input className={control} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
    <label className="block text-xs">Destination<select className={control} value={directory} onChange={e => setDirectory(e.target.value)}>
      {capabilities?.targets.map(target => <option key={target}>{target}</option>)}
    </select></label>
    <label className="block text-xs">Note kind<select className={control} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setClaims({}); }}>
      <option value="synthesis">Session synthesis</option><option value="troubleshooting">Troubleshooting</option><option value="adr">Architecture decision</option>
    </select></label>
    {capabilities?.template_errors[kind] && <p role="alert">{capabilities.template_errors[kind]}</p>}
    {capabilities?.sections[kind]?.map(section => {
      const claim = claims[section];
      return <details key={section} className="border border-[var(--color-border)] rounded p-2">
        <summary className="text-xs cursor-pointer">{section} {claim?.text ? '— claim supplied' : '— unknown'}</summary>
        <label className="block text-xs mt-2">Claim<textarea className={control} value={claim?.text || ''} onChange={e => setClaim(section, { text: e.target.value })} /></label>
        <label className="block text-xs">Evidence state<select className={control} value={claim?.state || 'proposal'} onChange={e => setClaim(section, { state: e.target.value })}>
          {STATES.map(state => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}
        </select></label>
        <label className="block text-xs">Source evidence<select className={control} value={claim?.evidenceId || ''} onChange={e => {
          const evidence = detail.messages.find(m => m.evidence_id === e.target.value);
          setClaim(section, { evidenceId: e.target.value, quote: evidence?.content.slice(0, 600) || '' });
        }}>
          <option value="">Choose evidence</option>
          {detail.messages.filter(m => m.evidence_id).map(m => <option key={m.evidence_id} value={m.evidence_id}>
            {m.evidence_id} · {m.role}/{m.kind} · {m.content.slice(0, 90)}
          </option>)}
        </select></label>
        <label className="block text-xs">Exact excerpt (up to 600 characters)<textarea className={control} maxLength={600} value={claim?.quote || ''} onChange={e => setClaim(section, { quote: e.target.value })} /></label>
      </details>;
    })}
    {preview && <label className="block text-xs"><input type="checkbox" checked={updateConfirmed} onChange={e => setUpdateConfirmed(e.target.checked)} /> Replace the previewed revision with these claims; reset it to draft.</label>}
    <button className="px-3 py-1 rounded bg-cyan-700 disabled:opacity-40" disabled={busy || !directory || !capabilities?.sections[kind]} onClick={publish}>Save draft</button>
    <p role="status" className="text-xs whitespace-pre-wrap">{message}</p>
    {preview && <section className="space-y-2">
      <h4 className="font-semibold text-sm">Review saved {preview.review_state}</h4>
      <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto p-2 bg-black/20">{preview.content}</pre>
      <label className="block text-xs">Reviewer<input className={control} value={reviewer} onChange={e => setReviewer(e.target.value)} /></label>
      <label className="block text-xs"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this text and its evidence, including the verification limits.</label>
      <button className="px-3 py-1 bg-emerald-800 rounded disabled:opacity-40" disabled={busy || !confirmed || !reviewer.trim()} onClick={() => review()}>Approve this revision</button>
      <button className="ml-2 px-3 py-1 border rounded disabled:opacity-40" disabled={busy || !confirmed || !reviewer.trim()} onClick={() => review(true)}>Revoke review</button>
    </section>}
  </div>;
}
