import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownToLine, ArrowUpRight,
  CheckCircle2, ChevronDown, CircleHelp, Cloud, FileSearch, Filter,
  Github, Globe, LockKeyhole, Menu, RefreshCw, Search, Server, Shield,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Terminal, X
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 }

const fallbackReport = {
  mode: 'sample_preview',
  resources_scanned: 7,
  finding_count: 5,
  severity_counts: { HIGH: 3, MEDIUM: 2, LOW: 0 },
  findings: [
    {
      id: 'CS-S3-001', resource: 'demo-public-risk', service: 'S3',
      check: 'S3 public-access protection', severity: 'HIGH', status: 'FAIL',
      evidence: 'The sample configuration marks public-access blocking as disabled.',
      recommendation: 'Review bucket policy and access requirements; enable suitable S3 Block Public Access settings.'
    },
    {
      id: 'CS-EC2-001', resource: 'demo-admin-sg', service: 'EC2',
      check: 'Public SSH access', severity: 'HIGH', status: 'FAIL',
      evidence: 'Inbound TCP port 22 permits traffic from a public CIDR.',
      recommendation: 'Restrict SSH to approved source ranges or use a managed access solution.'
    },
    {
      id: 'CS-IAM-001', resource: 'demo-admin-policy', service: 'IAM',
      check: 'Broad IAM permissions', severity: 'HIGH', status: 'REVIEW',
      evidence: 'The normalized demo policy uses wildcard actions and resources.',
      recommendation: 'Review effective permissions and replace broad grants with least-privilege actions and resources.'
    },
    {
      id: 'CS-S3-002', resource: 'demo-needs-review', service: 'S3',
      check: 'S3 public-access protection', severity: 'MEDIUM', status: 'REVIEW',
      evidence: 'The sample configuration does not provide public-access-block status.',
      recommendation: 'Inspect all four S3 Block Public Access settings and the bucket/access-point policies.'
    },
    {
      id: 'CS-EC2-002', resource: 'demo-app-sg', service: 'EC2',
      check: 'Inbound access review', severity: 'MEDIUM', status: 'REVIEW',
      evidence: 'Sample rule configuration needs additional review.',
      recommendation: 'Confirm exposed ports and source CIDRs match the application requirements.'
    }
  ],
  disclaimer: 'Preview findings are illustrative. Run a scan to load the backend report.'
}

const history = [
  { label: 'Mon', high: 5, medium: 3, low: 2 },
  { label: 'Tue', high: 4, medium: 4, low: 2 },
  { label: 'Wed', high: 6, medium: 3, low: 1 },
  { label: 'Thu', high: 3, medium: 4, low: 2 },
  { label: 'Fri', high: 4, medium: 2, low: 3 },
  { label: 'Sat', high: 3, medium: 3, low: 2 },
  { label: 'Today', high: 3, medium: 2, low: 0 },
]

function severityClass(severity = 'INFO') {
  return `severity severity-${severity.toLowerCase()}`
}

function normalizeReport(data) {
  const findings = Array.isArray(data?.findings) ? data.findings : []
  return {
    ...data,
    resources_scanned: Number(data?.resources_scanned ?? 0),
    finding_count: Number(data?.finding_count ?? findings.length),
    severity_counts: data?.severity_counts || {},
    findings: findings.map((item, index) => ({
      ...item,
      id: item.id || `CS-${String(item.service || 'GEN').toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      service: item.service || 'General',
      severity: String(item.severity || 'INFO').toUpperCase(),
      status: item.status || 'REVIEW',
    }))
  }
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'blue' }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-helper">{helper}</div>
    </div>
  )
}

function App() {
  const [report, setReport] = useState(() => normalizeReport(fallbackReport))
  const [loading, setLoading] = useState(false)
  const [apiState, setApiState] = useState('checking')
  const [apiMessage, setApiMessage] = useState('Checking backend connection')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState('')

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
      const data = await response.json()
      setApiState(data.status === 'ok' ? 'online' : 'offline')
      setApiMessage(data.status === 'ok' ? 'Backend connected' : 'Unexpected health response')
    } catch {
      setApiState('offline')
      setApiMessage('Backend offline · showing preview data')
    }
  }, [])

  const runScan = useCallback(async () => {
    setLoading(true)
    setToast('')
    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Scan failed (${response.status}): ${body.slice(0, 180)}`)
      }
      const data = normalizeReport(await response.json())
      setReport(data)
      setApiState('online')
      setApiMessage('Backend connected')
      setToast(`Scan complete · ${data.finding_count} finding(s) returned`)
    } catch (error) {
      setApiState('offline')
      setApiMessage('Backend offline · showing preview data')
      setToast(error.message || 'Unable to reach backend. Showing preview data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { checkHealth() }, [checkHealth])

  const services = useMemo(() => ['ALL', ...new Set(report.findings.map(item => item.service))], [report])
  const visibleFindings = useMemo(() => {
    const term = query.trim().toLowerCase()
    return [...report.findings]
      .filter(item => severityFilter === 'ALL' || item.severity === severityFilter)
      .filter(item => serviceFilter === 'ALL' || item.service === serviceFilter)
      .filter(item => !term || [item.id, item.resource, item.check, item.evidence, item.service].some(v => String(v || '').toLowerCase().includes(term)))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  }, [report, severityFilter, serviceFilter, query])

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cloudsentinel-scan-report.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const highCount = report.severity_counts?.HIGH ?? report.findings.filter(f => f.severity === 'HIGH').length
  const mediumCount = report.severity_counts?.MEDIUM ?? report.findings.filter(f => f.severity === 'MEDIUM').length
  const lowCount = report.severity_counts?.LOW ?? report.findings.filter(f => f.severity === 'LOW').length

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={23} /></div>
          <div><div className="brand-name">CloudSentinel</div><div className="brand-caption">CLOUD SECURITY CENTER</div></div>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18}/></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          <button className="nav-item active"><Activity size={18}/> Overview</button>
          <button className="nav-item" onClick={() => document.getElementById('findings')?.scrollIntoView({ behavior: 'smooth' })}><ShieldAlert size={18}/> Security findings <span className="nav-count">{report.finding_count}</span></button>
          <button className="nav-item" onClick={() => setToast('Scan history is a UI preview; persistent scan history is not implemented yet.')}><RefreshCw size={18}/> Scan history</button>
          <button className="nav-item" onClick={() => setToast('Configuration management is planned for a later version.')}><SlidersHorizontal size={18}/> Configuration</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><LockKeyhole size={17}/></div>
            <div className="tip-title">Security first</div>
            <p>Demo mode uses fictional configuration data. No AWS credentials are stored in this frontend.</p>
          </div>
          <div className="user-chip">
            <div className="avatar">CS</div>
            <div className="user-info"><strong>CloudSentinel</strong><span>Local workspace</span></div>
            <ChevronDown size={15} className="muted-icon"/>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19}/></button>
            <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>Overview</strong></div>
          </div>
          <div className="topbar-actions">
            <div className={`connection-pill ${apiState}`}><span className="connection-dot"/>{apiMessage}</div>
            <button className="icon-button" title="Check backend connection" aria-label="Check backend connection" onClick={checkHealth}><RefreshCw size={17}/></button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><Cloud size={14}/> CLOUD POSTURE MANAGEMENT</div>
              <h1>Security overview<span>.</span></h1>
              <p className="page-subtitle">Understand your cloud exposure, prioritize risk, and take action.</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-secondary" onClick={downloadReport}><ArrowDownToLine size={16}/> Export report</button>
              <button className="button button-primary" onClick={runScan} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/>{loading ? 'Scanning…' : 'Run security scan'}</button>
            </div>
          </section>

          {apiState === 'offline' && (
            <div className="notice notice-warning">
              <AlertTriangle size={18}/>
              <div><strong>Preview mode</strong><p>Couldn't reach the FastAPI backend at <code>{API_BASE}</code>. The dashboard is displaying illustrative preview findings. Start the backend and try again.</p></div>
            </div>
          )}
          {toast && <div className="notice notice-info"><CircleHelp size={18}/><span>{toast}</span><button className="toast-close" onClick={() => setToast('')} aria-label="Dismiss"><X size={16}/></button></div>}

          <section className="metric-grid">
            <MetricCard icon={Server} label="Resources scanned" value={report.resources_scanned} helper="In latest report" tone="blue"/>
            <MetricCard icon={ShieldAlert} label="Security findings" value={report.finding_count} helper="Items to investigate" tone="purple"/>
            <MetricCard icon={AlertCircle} label="High severity" value={highCount} helper="Prioritize these first" tone="red"/>
            <MetricCard icon={CheckCircle2} label="Low severity" value={lowCount} helper={`${mediumCount} medium severity`} tone="green"/>
          </section>

          <section className="content-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div><h2>Risk trend</h2><p>Illustrative trend · not historical scan data</p></div>
                <button className="period-button" onClick={() => setToast('Historical trend is sample visualization data, not persisted scan history.')}>Last 7 days <ChevronDown size={14}/></button>
              </div>
              <div className="chart-legend">
                <span><i className="legend-dot high-dot"/> High</span><span><i className="legend-dot medium-dot"/> Medium</span><span><i className="legend-dot low-dot"/> Low</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="highFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.16}/><stop offset="100%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                      <linearGradient id="mediumFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.14}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" stroke="#e8edf4" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill: '#8490a3', fontSize: 11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill: '#8490a3', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip contentStyle={{ border: '1px solid #e4e9f0', borderRadius: 12, boxShadow: '0 8px 25px #15223a10' }}/>
                    <Area type="monotone" dataKey="high" name="High" stroke="#ef4444" strokeWidth={2} fill="url(#highFill)"/>
                    <Area type="monotone" dataKey="medium" name="Medium" stroke="#f59e0b" strokeWidth={2} fill="url(#mediumFill)"/>
                    <Area type="monotone" dataKey="low" name="Low" stroke="#10b981" strokeWidth={2} fillOpacity={0.04}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel posture-panel">
              <div className="panel-heading"><div><h2>Security posture</h2><p>Based on current report</p></div><Shield size={20} className="heading-icon"/></div>
              <div className="posture-score-row">
                <div className="score-ring" style={{ '--score': `${Math.max(0, 100 - highCount * 15 - mediumCount * 7)}%` }}>
                  <div className="score-ring-inner"><strong>{Math.max(0, 100 - highCount * 15 - mediumCount * 7)}</strong><span>/ 100</span></div>
                </div>
                <div className="score-description"><strong>{highCount > 0 ? 'Needs attention' : 'Looking good'}</strong><span>Demo heuristic score</span><span className="score-note">Not a compliance certification</span></div>
              </div>
              <div className="severity-breakdown">
                <div className="breakdown-row"><span><i className="legend-dot high-dot"/>High</span><strong>{highCount}</strong><div className="breakdown-track"><i className="bar-high" style={{ width: `${Math.min(100, highCount / Math.max(1, report.finding_count) * 100)}%` }}/></div></div>
                <div className="breakdown-row"><span><i className="legend-dot medium-dot"/>Medium</span><strong>{mediumCount}</strong><div className="breakdown-track"><i className="bar-medium" style={{ width: `${Math.min(100, mediumCount / Math.max(1, report.finding_count) * 100)}%` }}/></div></div>
                <div className="breakdown-row"><span><i className="legend-dot low-dot"/>Low</span><strong>{lowCount}</strong><div className="breakdown-track"><i className="bar-low" style={{ width: `${Math.min(100, lowCount / Math.max(1, report.finding_count) * 100)}%` }}/></div></div>
              </div>
              <div className="posture-footnote"><LockKeyhole size={14}/> Score is a prototype heuristic.</div>
            </div>
          </section>

          <section className="panel findings-panel" id="findings">
            <div className="panel-heading findings-heading">
              <div><h2>Security findings <span className="subtle-count">{report.finding_count}</span></h2><p>Review evidence and recommended remediation for each item.</p></div>
              <button className="button button-secondary button-small" onClick={downloadReport}><ArrowDownToLine size={15}/> Export JSON</button>
            </div>
            <div className="filters-row">
              <div className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search findings or resources…" aria-label="Search findings"/></div>
              <div className="filter-control"><Filter size={15}/><select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} aria-label="Filter by severity"><option value="ALL">All severities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="INFO">Info</option></select></div>
              <div className="filter-control"><SlidersHorizontal size={15}/><select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} aria-label="Filter by service">{services.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All services' : s}</option>)}</select></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Finding</th><th>Resource</th><th>Service</th><th>Severity</th><th>Status</th><th aria-label="Actions"/></tr></thead>
                <tbody>
                  {visibleFindings.map(item => (
                    <tr key={item.id} onClick={() => setSelectedFinding(item)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedFinding(item)}>
                      <td><div className="finding-title">{item.check}</div><div className="finding-id">{item.id}</div></td>
                      <td><code className="resource-code">{item.resource}</code></td>
                      <td><span className="service-tag">{item.service}</span></td>
                      <td><span className={severityClass(item.severity)}><i/>{item.severity}</span></td>
                      <td><span className={`status-tag status-${String(item.status).toLowerCase()}`}>{item.status}</span></td>
                      <td><button className="row-action" aria-label={`View ${item.check}`} onClick={e => { e.stopPropagation(); setSelectedFinding(item) }}><ArrowUpRight size={16}/></button></td>
                    </tr>
                  ))}
                  {visibleFindings.length === 0 && <tr><td colSpan="6" className="empty-state"><FileSearch size={22}/><strong>No matching findings</strong><span>Try changing your search or filters.</span></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>{visibleFindings.length}</strong> of <strong>{report.finding_count}</strong> findings</span><span>Source: {report.mode === 'sample_configuration' ? 'Backend scan' : 'Illustrative preview'}</span></div>
          </section>

          <footer className="footer"><span>© {new Date().getFullYear()} CloudSentinel · Portfolio project</span><span><LockKeyhole size={13}/> Demo mode · No live AWS connection</span></footer>
        </div>
      </main>

      {selectedFinding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && setSelectedFinding(null)}>
          <section className="finding-modal" role="dialog" aria-modal="true" aria-labelledby="finding-modal-title">
            <div className="modal-header">
              <div><div className="eyebrow">FINDING DETAILS</div><h2 id="finding-modal-title">{selectedFinding.check}</h2></div>
              <button className="icon-button" aria-label="Close details" onClick={() => setSelectedFinding(null)}><X size={18}/></button>
            </div>
            <div className="modal-tags"><span className={severityClass(selectedFinding.severity)}><i/>{selectedFinding.severity}</span><span className="service-tag">{selectedFinding.service}</span><span className={`status-tag status-${String(selectedFinding.status).toLowerCase()}`}>{selectedFinding.status}</span></div>
            <div className="detail-block"><label>Resource</label><code>{selectedFinding.resource}</code></div>
            <div className="detail-block"><label>Evidence</label><p>{selectedFinding.evidence || 'No evidence was provided by the scanner.'}</p></div>
            <div className="recommendation-block"><div><ShieldCheck size={17}/> Recommended remediation</div><p>{selectedFinding.recommendation || 'Review the resource configuration and validate the appropriate security controls.'}</p></div>
            <div className="modal-footer"><button className="button button-secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(selectedFinding, null, 2)); setToast('Finding JSON copied if clipboard permission is available.') }}>Copy finding JSON</button><button className="button button-primary" onClick={() => setSelectedFinding(null)}>Done</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
