import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeftRight, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Cloud, Database, FileSearch, Filter,
  History, LockKeyhole, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck,
  SlidersHorizontal, X, Zap, ExternalLink
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']
const LOCAL_HISTORY_KEY = 'cloudsentinel.scanHistory.v2'

function readLocalHistory() {
  try { return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]') } catch { return [] }
}
function severityClass(severity = 'info') {
  return `severity severity-${String(severity).toLowerCase()}`
}
function normalizeReport(data = {}) {
  const findings = Array.isArray(data.findings) ? data.findings : []
  const counts = data.summary?.by_severity || {}
  return {
    ...data,
    scan_id: data.scan_id || `local-${Date.now()}`,
    scanned_at: data.scanned_at || new Date().toISOString(),
    posture_score: data.posture_score !== null && data.posture_score !== undefined && Number.isFinite(Number(data.posture_score)) ? Number(data.posture_score) : null,
    risk_level: data.risk_level || 'Unknown',
    summary: {
      total_findings: Number(data.summary?.total_findings ?? findings.length),
      by_severity: Object.fromEntries(SEVERITIES.map(s => [s, Number(counts[s] || 0)])),
      resources_reviewed: Number(data.summary?.resources_reviewed || 0),
    },
    findings: findings.map((f, i) => ({
      ...f,
      id: f.id || `${f.rule_id || 'finding'}-${i}`,
      title: f.title || f.check || 'Security finding',
      resource_id: f.resource_id || f.resource || 'unknown-resource',
      resource_type: f.resource_type || f.service || 'Resource',
      severity: String(f.severity || 'info').toLowerCase(),
      status: f.status || 'open',
      evidence: f.evidence || 'No evidence supplied.',
      why_it_matters: f.why_it_matters || f.description || 'Review this configuration for security impact.',
      remediation: f.remediation || f.recommendation || 'Review the resource and apply least-privilege secure configuration.',
    })),
  }
}
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}
function Metric({ icon: Icon, label, value, note, tone = 'blue' }) {
  return <div className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={18}/></div>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    <div className="metric-note">{note}</div>
  </div>
}
function App() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState('moderate_risk')
  const [apiState, setApiState] = useState('checking')
  const [apiMessage, setApiMessage] = useState('Checking backend')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [historyItems, setHistoryItems] = useState(readLocalHistory)
  const [serverHistory, setServerHistory] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [compareId, setCompareId] = useState('')
  const [comparison, setComparison] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const saveHistory = useCallback((item) => {
    setHistoryItems(prev => {
      const next = [item, ...prev.filter(x => x.scan_id !== item.scan_id)].slice(0, 30)
      try { localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data.status !== 'ok') throw new Error('Unexpected health response')
      setApiState('online')
      setApiMessage('Backend connected')
    } catch (err) {
      setApiState('offline')
      setApiMessage('Backend unreachable')
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE}/history?limit=30`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error(`History request failed: ${response.status}`)
      const data = await response.json()
      setServerHistory(Array.isArray(data.history) ? data.history : [])
    } catch {
      setServerHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const runScan = useCallback(async () => {
    setLoading(true)
    setToast('')
    setComparison(null)
    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenario, label: `CloudSentinel · ${selectedScenario.replaceAll('_', ' ')}` }),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) throw new Error(`Scan failed: HTTP ${response.status} — ${(await response.text()).slice(0, 180)}`)
      const result = normalizeReport(await response.json())
      setReport(result)
      saveHistory(result)
      setApiState('online')
      setApiMessage('Backend connected')
      setToast(`Scan complete: ${result.summary.total_findings} findings · posture ${result.posture_score}/100`)
      fetchHistory()
    } catch (err) {
      setApiState('offline')
      setApiMessage('Backend unreachable')
      setToast(`${err.message || 'Could not run scan'}. Check the backend URL, CORS settings, and Render logs.`)
    } finally {
      setLoading(false)
    }
  }, [fetchHistory, saveHistory, selectedScenario])

  useEffect(() => { checkHealth() }, [checkHealth])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  const allFindings = report?.findings || []
  const categories = useMemo(() => ['all', ...new Set(allFindings.map(f => f.category || f.resource_type))], [allFindings])
  const visibleFindings = useMemo(() => {
    const term = query.trim().toLowerCase()
    return allFindings.filter(f => severityFilter === 'all' || f.severity === severityFilter)
      .filter(f => categoryFilter === 'all' || (f.category || f.resource_type) === categoryFilter)
      .filter(f => !term || [f.title, f.resource_id, f.resource_type, f.rule_id, f.evidence, f.remediation].some(v => String(v || '').toLowerCase().includes(term)))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  }, [allFindings, query, severityFilter, categoryFilter])

  const exportJson = async (item = report) => {
    if (!item) { setToast('Run a scan before exporting a report.'); return }
    let payload = { report_type: 'CloudSentinel security assessment', exported_at: new Date().toISOString(), scan: item }
    try {
      const response = await fetch(`${API_BASE}/report/${encodeURIComponent(item.scan_id)}`)
      if (response.ok) payload = await response.json()
    } catch {}
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cloudsentinel-report-${item.scan_id}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast('JSON security report exported.')
  }

  const loadHistoricalScan = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/history/${encodeURIComponent(id)}`)
      if (!response.ok) throw new Error('Could not load that scan from the backend.')
      const data = normalizeReport(await response.json())
      setReport(data)
      setActiveTab('overview')
      setToast(`Loaded scan from ${formatDate(data.scanned_at)}.`)
    } catch {
      const local = historyItems.find(x => x.scan_id === id)
      if (local) { setReport(normalizeReport(local)); setActiveTab('overview'); setToast('Loaded browser-saved scan.'); }
      else setToast('Could not load scan details. Render may have restarted and cleared its local SQLite history.')
    }
  }

  const compareScans = async () => {
    if (!report || !compareId) { setToast('Run a scan and choose an earlier scan to compare.'); return }
    try {
      const response = await fetch(`${API_BASE}/compare?scan_id=${encodeURIComponent(report.scan_id)}&against=${encodeURIComponent(compareId)}`)
      if (!response.ok) throw new Error(`Comparison endpoint returned HTTP ${response.status}`)
      setComparison(await response.json())
      setToast('Scan comparison loaded.')
    } catch (err) {
      const older = historyItems.find(x => x.scan_id === compareId)
      if (!older) { setToast(`${err.message}. The earlier scan may only exist in this browser.`); return }
      const currentMap = new Map(report.findings.map(f => [`${f.rule_id}:${f.resource_id}`, f]))
      const olderMap = new Map(older.findings.map(f => [`${f.rule_id}:${f.resource_id}`, f]))
      const newFindings = [...currentMap].filter(([k]) => !olderMap.has(k)).map(([,v]) => v)
      const resolved = [...olderMap].filter(([k]) => !currentMap.has(k)).map(([,v]) => v)
      const unchanged = [...currentMap].filter(([k]) => olderMap.has(k)).map(([,v]) => v)
      setComparison({
        current_scan_id: report.scan_id, previous_scan_id: older.scan_id,
        posture_score_change: report.posture_score - older.posture_score,
        new_findings: newFindings, resolved_findings: resolved, unchanged_findings: unchanged,
        summary: { new: newFindings.length, resolved: resolved.length, unchanged: unchanged.length },
      })
      setToast('Compared browser-saved scans. For complete results, keep both scans in backend history.')
    }
  }

  const severityCounts = report?.summary?.by_severity || {}
  const total = report?.summary?.total_findings ?? 0
  const mergedHistory = [...new Map([...serverHistory, ...historyItems].map(item => [item.scan_id, item])).values()]
    .filter(item => item.scanned_at && item.posture_score !== null && item.posture_score !== undefined)
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
  const chartData = mergedHistory.slice(-10).map((x, i) => ({
    label: new Date(x.scanned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: Number(x.posture_score),
    findings: x.summary?.total_findings ?? x.findings?.length ?? 0,
    index: i + 1,
  }))

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={22}/></div><div><strong>CloudSentinel</strong><span>CLOUD SECURITY CENTER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        <button className={activeTab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('overview')}><Activity size={17}/> Overview</button>
        <button className={activeTab === 'findings' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('findings')}><ShieldAlert size={17}/> Security findings <span className="nav-count">{total}</span></button>
        <button className={activeTab === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('history')}><History size={17}/> Scan history <span className="nav-count">{new Set([...serverHistory, ...historyItems].map(x => x.scan_id)).size}</span></button>
        <button className={activeTab === 'comparison' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('comparison')}><ArrowLeftRight size={17}/> Compare scans</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><LockKeyhole size={17}/><strong>Defensive demo mode</strong><p>Uses simulated AWS-style configuration. No live AWS account or credentials are connected.</p></div>
        <div className="user-chip"><div className="avatar">CS</div><div><strong>CloudSentinel</strong><span>Personal workspace</span></div></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{activeTab === 'overview' ? 'Overview' : activeTab === 'findings' ? 'Security findings' : activeTab === 'history' ? 'Scan history' : 'Compare scans'}</strong></div>
        <div className="top-actions"><span className={`connection-pill ${apiState}`}><i/>{apiMessage}</span><button className="icon-button" title="Refresh backend status" onClick={checkHealth}><RefreshCw size={16}/></button></div>
      </header>

      <div className="page-content">
        <section className="welcome-row">
          <div><div className="eyebrow"><Cloud size={14}/> CLOUD POSTURE MANAGEMENT</div><h1>{activeTab === 'overview' ? 'Security overview' : activeTab === 'findings' ? 'Security findings' : activeTab === 'history' ? 'Scan history' : 'Scan comparison'}<span>.</span></h1><p className="subtitle">Prioritize cloud risk with evidence-backed findings and remediation guidance.</p></div>
          <div className="welcome-actions">
            <label className="scenario-control"><span>Scenario</span><select aria-label="Select simulated security scenario" value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)} disabled={loading}>
              <option value="secure">Secure environment</option><option value="moderate_risk">Moderate risk</option><option value="high_risk">High risk</option>
            </select></label>
            <button className="button secondary" onClick={() => exportJson()} disabled={!report}><ArrowDownToLine size={16}/> Export report</button><button className="button primary" onClick={runScan} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/>{loading ? 'Scanning…' : 'Run security scan'}</button>
          </div>
        </section>

        {apiState === 'offline' && <div className="notice warning"><AlertTriangle size={18}/><div><strong>Backend unreachable</strong><p>The live API at <code>{API_BASE}</code> could not be reached. Check Render status, CORS origins, and browser Network details.</p></div></div>}
        {toast && <div className="notice info"><CircleHelp size={18}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss"><X size={16}/></button></div>}

        {activeTab === 'overview' && <>
          <section className="metric-grid">
            <Metric icon={Database} label="Resources reviewed" value={report?.summary?.resources_reviewed ?? '—'} note="Latest backend scan" tone="blue"/>
            <Metric icon={ShieldAlert} label="Open findings" value={total || (report ? 0 : '—')} note="Requires review" tone="purple"/>
            <Metric icon={AlertTriangle} label="Critical + high" value={(severityCounts.critical || 0) + (severityCounts.high || 0)} note={`${severityCounts.medium || 0} medium severity`} tone="red"/>
            <Metric icon={CheckCircle2} label="Posture score" value={report ? `${report.posture_score}/100` : '—'} note={report?.risk_level ? `${report.risk_level} risk` : 'Run your first scan'} tone="green"/>
          </section>

          <section className="content-grid">
            <div className="panel chart-panel">
              <div className="panel-heading"><div><h2>Posture trend</h2><p>{chartData.length > 1 ? 'Recorded scan scores across available history' : 'Run different scenarios to build your trend'}</p></div><span className="chart-label">{chartData.length} saved</span></div>
              <div className="chart-wrap">
                {chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f7cff" stopOpacity={0.25}/><stop offset="100%" stopColor="#4f7cff" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="#e8edf4" vertical={false}/><XAxis dataKey="label" tick={{ fill: '#8792a4', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{ fill: '#8792a4', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ border: '1px solid #e4e9f0', borderRadius: 12 }}/><Area type="monotone" dataKey="score" name="Posture score" stroke="#4f7cff" strokeWidth={2.5} fill="url(#scoreFill)"/>
                </AreaChart></ResponsiveContainer> : <div className="chart-empty"><Activity size={24}/><strong>No trend yet</strong><span>Run at least two scans to compare posture over time.</span></div>}
              </div>
              <div className="chart-foot"><span><i className="legend-dot blue-dot"/> Posture score</span><span><i className="legend-dot purple-dot"/> Scan history</span></div>
            </div>
            <div className="panel posture-panel">
              <div className="panel-heading"><div><h2>Security posture</h2><p>Heuristic risk assessment</p></div><Shield size={20}/></div>
              <div className="score-row">
                <div className="score-ring" style={{ '--score': `${report?.posture_score ?? 0}%` }}><div><strong>{report?.posture_score ?? '—'}</strong><span>/ 100</span></div></div>
                <div className="score-copy"><strong>{report?.risk_level || 'Awaiting scan'}</strong><span>Overall risk level</span><small>Heuristic score, not a certification</small></div>
              </div>
              <div className="severity-breakdown">
                {SEVERITIES.slice(0,4).map(s => <div className="breakdown-row" key={s}><span><i className={`legend-dot ${s}-dot`}/>{s[0].toUpperCase()+s.slice(1)}</span><strong>{severityCounts[s] || 0}</strong><div className="breakdown-track"><i className={`bar-${s}`} style={{width:`${Math.min(100, (severityCounts[s] || 0) / Math.max(1,total) * 100)}%`}}/></div></div>)}
              </div>
              <div className="posture-footnote"><LockKeyhole size={13}/> Score methodology available in report JSON.</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><h2>Latest scan</h2><p>{report ? `${formatDate(report.scanned_at)} · ${report.scan_mode || 'scan'}` : 'No scan has been run yet'}</p></div>{report && <button className="text-button" onClick={() => setActiveTab('findings')}>View findings <ChevronRight size={15}/></button>}</div>
            {!report ? <div className="empty-state"><ShieldCheck size={26}/><strong>Ready for your first scan</strong><span>Click “Run security scan” to request a scan from the backend.</span></div> : <div className="latest-summary"><div><span>Scan ID</span><code>{report.scan_id}</code></div><div><span>Resources reviewed</span><strong>{report.summary.resources_reviewed}</strong></div><div><span>Findings</span><strong>{total}</strong></div><div><span>Scope</span><strong>{report.scope || 'Simulated configuration'}</strong></div></div>}
          </section>
        </>}

        {activeTab === 'findings' && <section className="panel findings-panel">
          <div className="panel-heading"><div><h2>Security findings <span className="subtle-count">{visibleFindings.length}</span></h2><p>Evidence, impact, and suggested remediation for each finding.</p></div></div>
          <div className="filters-row"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search rule, resource, evidence…" /></div><div className="filter-control"><Filter size={15}/><select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="all">All severities</option>{SEVERITIES.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></div><div className="filter-control"><SlidersHorizontal size={15}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c==='all'?'All categories':c}</option>)}</select></div></div>
          <div className="table-wrap"><table><thead><tr><th>Finding</th><th>Resource</th><th>Category</th><th>Severity</th><th>Status</th><th/></tr></thead><tbody>
            {visibleFindings.map(f=><tr key={f.id} onClick={()=>setSelectedFinding(f)} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&setSelectedFinding(f)}><td><strong>{f.title}</strong><small className="finding-id">{f.rule_id || f.id}</small></td><td><code>{f.resource_id}</code></td><td><span className="service-tag">{f.category || f.resource_type}</span></td><td><span className={severityClass(f.severity)}><i/>{f.severity}</span></td><td><span className={`status-tag status-${f.status}`}>{f.status}</span></td><td><button className="row-action" onClick={e=>{e.stopPropagation();setSelectedFinding(f)}} aria-label="View finding"><ChevronRight size={16}/></button></td></tr>)}
            {!visibleFindings.length && <tr><td colSpan="6" className="empty-state"><FileSearch size={23}/><strong>No findings match</strong><span>Try a different search or filter.</span></td></tr>}
          </tbody></table></div>
          <div className="table-footer">Showing {visibleFindings.length} of {allFindings.length} findings · click a row for details</div>
        </section>}

        {activeTab === 'history' && <section className="panel">
          <div className="panel-heading"><div><h2>Scan history</h2><p>Backend history plus browser-local backup history.</p></div><button className="button secondary small" onClick={fetchHistory}><RefreshCw size={14} className={historyLoading?'spin':''}/> Refresh history</button></div>
          <div className="history-list">
            {historyLoading && <div className="empty-state">Loading scan history…</div>}
            {!historyLoading && !serverHistory.length && !historyItems.length && <div className="empty-state"><History size={25}/><strong>No saved scans</strong><span>Run a scan to begin building history.</span></div>}
            {serverHistory.map(item=><div className="history-row" key={`server-${item.scan_id}`}><div className="history-icon"><Clock3 size={17}/></div><div className="history-main"><strong>{item.label || `Scan ${item.scan_id}`}</strong><span>{formatDate(item.scanned_at)} · {item.summary?.total_findings ?? 0} findings</span><code>{item.scan_id}</code></div><div className="history-score"><strong>{item.posture_score}/100</strong><span>{item.risk_level}</span></div><button className="button secondary small" onClick={()=>loadHistoricalScan(item.scan_id)}>Open</button><button className="icon-button" title="Use as comparison baseline" onClick={()=>{setCompareId(item.scan_id);setActiveTab('comparison')}}><ArrowLeftRight size={15}/></button></div>)}
            {historyItems.filter(x=>!serverHistory.some(s=>s.scan_id===x.scan_id)).map(item=><div className="history-row" key={`local-${item.scan_id}`}><div className="history-icon local"><Clock3 size={17}/></div><div className="history-main"><strong>Browser-saved scan</strong><span>{formatDate(item.scanned_at)} · {item.summary?.total_findings ?? item.findings?.length ?? 0} findings</span><code>{item.scan_id}</code></div><div className="history-score"><strong>{item.posture_score}/100</strong><span>{item.risk_level}</span></div><button className="button secondary small" onClick={()=>loadHistoricalScan(item.scan_id)}>Open</button><button className="icon-button" title="Use as comparison baseline" onClick={()=>{setCompareId(item.scan_id);setActiveTab('comparison')}}><ArrowLeftRight size={15}/></button></div>)}
          </div>
          <p className="inline-note"><AlertTriangle size={14}/> Render's local SQLite file may be ephemeral on the free plan. Browser history is local to this device and browser.</p>
        </section>}

        {activeTab === 'comparison' && <section className="panel">
          <div className="panel-heading"><div><h2>Compare scans</h2><p>Identify new, resolved, and unchanged findings between two scans.</p></div></div>
          <div className="compare-controls"><div><label>Current scan</label><div className="select-display">{report ? `${formatDate(report.scanned_at)} · ${report.scan_id}` : 'Run a scan first'}</div></div><div><label>Compare against earlier scan</label><select value={compareId} onChange={e=>setCompareId(e.target.value)}><option value="">Choose baseline scan</option>{[...serverHistory, ...historyItems.filter(x=>!serverHistory.some(s=>s.scan_id===x.scan_id))].filter(x=>x.scan_id !== report?.scan_id).map(x=><option key={x.scan_id} value={x.scan_id}>{formatDate(x.scanned_at)} · {x.posture_score}/100 · {x.scan_id.slice(0,8)}</option>)}</select></div><button className="button primary" onClick={compareScans} disabled={!report||!compareId}><ArrowLeftRight size={15}/> Compare</button></div>
          {comparison && <><div className="compare-metrics"><div><span>Posture change</span><strong className={comparison.posture_score_change>=0?'positive':'negative'}>{comparison.posture_score_change>0?'+':''}{comparison.posture_score_change}</strong></div><div><span>New findings</span><strong>{comparison.summary.new}</strong></div><div><span>Resolved findings</span><strong>{comparison.summary.resolved}</strong></div><div><span>Unchanged</span><strong>{comparison.summary.unchanged}</strong></div></div><div className="compare-columns"><div><h3>New findings <span className="pill red">{comparison.new_findings.length}</span></h3>{comparison.new_findings.length ? comparison.new_findings.map(f=><div className="compare-finding" key={f.id}><span className={severityClass(f.severity)}><i/>{f.severity}</span><strong>{f.title}</strong><small>{f.resource_id}</small></div>) : <p className="empty-inline">No new findings.</p>}</div><div><h3>Resolved findings <span className="pill green">{comparison.resolved_findings.length}</span></h3>{comparison.resolved_findings.length ? comparison.resolved_findings.map(f=><div className="compare-finding" key={f.id}><span className={severityClass(f.severity)}><i/>{f.severity}</span><strong>{f.title}</strong><small>{f.resource_id}</small></div>) : <p className="empty-inline">No resolved findings.</p>}</div></div></>}
        </section>}

        <footer className="footer"><span>© {new Date().getFullYear()} CloudSentinel · Portfolio project</span><span><LockKeyhole size={13}/> Simulated configuration · No live AWS connection</span></footer>
      </div>
    </main>

    {selectedFinding && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedFinding(null)}>
      <section className="finding-modal" role="dialog" aria-modal="true" aria-labelledby="finding-title">
        <div className="modal-header"><div><div className="eyebrow">FINDING DETAILS · {selectedFinding.rule_id}</div><h2 id="finding-title">{selectedFinding.title}</h2></div><button className="icon-button" onClick={()=>setSelectedFinding(null)} aria-label="Close"><X size={18}/></button></div>
        <div className="modal-tags"><span className={severityClass(selectedFinding.severity)}><i/>{selectedFinding.severity}</span><span className="service-tag">{selectedFinding.category || selectedFinding.resource_type}</span><span className={`status-tag status-${selectedFinding.status}`}>{selectedFinding.status}</span></div>
        <div className="detail-block"><label>Resource</label><code>{selectedFinding.resource_id}</code></div>
        <div className="detail-block"><label>Evidence observed</label><p>{selectedFinding.evidence}</p></div>
        <div className="detail-block"><label>Why it matters</label><p>{selectedFinding.why_it_matters}</p></div>
        <div className="recommendation-block"><div><ShieldCheck size={17}/> Recommended remediation</div><p>{selectedFinding.remediation}</p></div>
        <div className="modal-footer"><button className="button secondary" onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(selectedFinding,null,2));setToast('Finding JSON copied if clipboard access is allowed.')}}>Copy finding JSON</button><button className="button primary" onClick={()=>setSelectedFinding(null)}>Done</button></div>
      </section>
    </div>}
  </div>
}
export default App
