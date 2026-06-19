import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ShieldCheck, CheckCircle2, 
  XCircle, AlertTriangle, Play, RefreshCw, Settings, Loader2
} from 'lucide-react'

interface CheckItem {
  id: string
  label: string
  description: string
  status: 'pending' | 'checking' | 'passed' | 'failed'
  errorMsg?: string
}

export default function SystemCheck() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const sb = (window as any).secureBrowser

  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'lockdown', label: 'Lockdown Browser Shield', description: 'Verifies running inside the secure exam application wrapper.', status: 'pending' },
    { id: 'media', label: 'Camera & Microphone Access', description: 'Requires webcam and microphone permissions for identity and proctoring verification.', status: 'pending' },
    { id: 'display', label: 'Single Display Audit', description: 'Verifies no secondary monitors or capture systems are connected.', status: 'pending' },
    { id: 'process', label: 'Clean Process & Environment Audit', description: 'Ensures no unauthorized background software (Zoom, Discord, Teams) or VMs are running.', status: 'pending' }
  ])

  const [systemLogs, setSystemLogs] = useState<string[]>([])
  const [isVerifying, setIsVerifying] = useState(false)
  const [unresolvedProcess, setUnresolvedProcess] = useState<string | null>(null)
  const [unresolvedVM, setUnresolvedVM] = useState(false)
  const [unresolvedMonitor, setUnresolvedMonitor] = useState(false)
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false)

  const logEvent = (msg: string) => {
    setSystemLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)])
  }

  const updateCheckStatus = (id: string, status: CheckItem['status'], errorMsg?: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, errorMsg } : c))
    )
  }

  // Run the full verification suite
  const runVerification = async () => {
    if (isVerifying) return
    setIsVerifying(true)
    logEvent("Initiating security verification suite...")

    // 1. Lockdown Browser check
    updateCheckStatus('lockdown', 'checking')
    if (!sb || !sb.isSecureShell()) {
      updateCheckStatus('lockdown', 'failed', 'Not running inside the Secure Lockdown Browser container.')
      logEvent("CRITICAL: Secure shell verification failed. Application is exposed.")
      setIsVerifying(false)
      return
    }
    updateCheckStatus('lockdown', 'passed')
    logEvent("SUCCESS: Lockdown browser verified. Local process hooks connected.")

    // 2. Media permissions check
    updateCheckStatus('media', 'checking')
    try {
      logEvent("Requesting webcam and audio access stream...")
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      // Keep it active/stop it appropriately
      stream.getTracks().forEach((track) => track.stop())
      updateCheckStatus('media', 'passed')
      setMediaPermissionDenied(false)
      logEvent("SUCCESS: Camera and Microphone permissions granted.")
    } catch (err) {
      updateCheckStatus('media', 'failed', 'Permission denied by browser policies or OS settings.')
      setMediaPermissionDenied(true)
      logEvent("ERROR: Media access rejected. Check privacy panel settings.")
      setIsVerifying(false)
      return
    }

    // 3. Multi monitor check
    updateCheckStatus('display', 'checking')
    try {
      const status = await sb.getSystemStatus()
      if (status.multipleMonitors) {
        updateCheckStatus('display', 'failed', 'Secondary display/screen detected.')
        setUnresolvedMonitor(true)
        logEvent("ERROR: Multiple monitors detected. Please detach secondary screens.")
        setIsVerifying(false)
        return
      }
      updateCheckStatus('display', 'passed')
      setUnresolvedMonitor(false)
      logEvent("SUCCESS: Single physical monitor configuration confirmed.")
    } catch (err) {
      updateCheckStatus('display', 'failed', 'Failed to retrieve system status.')
      setIsVerifying(false)
      return
    }

    // 4. Background process audit (uses real-time Electron updates or immediate check)
    updateCheckStatus('process', 'checking')
    logEvent("Auditing active background processes and hypervisors...")
    
    // We register the real-time status listener. Electron sends updates every 3s.
    // We also double-check status right now.
    setIsVerifying(false)
  }

  // Real-time security listener from Electron process monitor
  useEffect(() => {
    if (!sb) return

    const unsubscribe = sb.onStatusUpdate((status: any) => {
      if (status.hasViolation) {
        if (status.type === 'multiple-monitors') {
          updateCheckStatus('display', 'failed', status.message)
          setUnresolvedMonitor(true)
          logEvent(`VIOLATION: Multiple displays connected.`)
        } else if (status.type === 'blacklisted-app') {
          updateCheckStatus('process', 'failed', status.message)
          setUnresolvedProcess(status.process || 'forbidden-app')
          logEvent(`VIOLATION: Forbidden app running - "${status.process}"`)
        } else if (status.type === 'vm-detected') {
          updateCheckStatus('process', 'failed', status.message)
          setUnresolvedVM(true)
          logEvent(`VIOLATION: Virtualization layer / Hypervisor active.`)
        }
      } else {
        // Clear violations
        setUnresolvedProcess(null)
        setUnresolvedVM(false)
        setUnresolvedMonitor(false)

        setChecks((prev) => {
          const updated = [...prev]
          // If display failed due to monitor, set passed if cleared
          if (updated[2].status === 'failed' && !status.multipleMonitors) {
            updated[2].status = 'passed'
            updated[2].errorMsg = undefined
            logEvent("Display configuration resolved.")
          }
          // If process failed, set passed if cleared
          if (updated[3].status === 'checking' || updated[3].status === 'failed' || updated[3].status === 'pending') {
            updated[3].status = 'passed'
            updated[3].errorMsg = undefined
          }
          return updated
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sb])

  useEffect(() => {
    runVerification()
  }, [])

  const handleStartExam = () => {
    if (sb) {
      sb.startExam()
    }
    navigate(`/test/${attemptId}`)
  }

  const allPassed = checks.every((c) => c.status === 'passed')

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Upper Brand Nav */}
      <header className="glass-panel px-8 py-4 border-b border-slate-800/80 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <ShieldCheck className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider uppercase text-slate-200">Secure Assessment Sandbox</h1>
            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Pre-Exam Security Screening</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Attempt ID: <span className="font-mono text-indigo-400">{attemptId}</span></span>
        </div>
      </header>

      {/* Grid Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col md:flex-row gap-8 overflow-hidden">
        {/* Left column - Checklist */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-white tracking-tight border-b border-slate-800 pb-3">
              Hardware & Software Checklist
            </h2>

            <div className="space-y-4">
              {checks.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-850 bg-slate-900/30 flex items-start gap-4">
                  <div className="mt-1">
                    {item.status === 'passed' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    {item.status === 'failed' && <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />}
                    {item.status === 'checking' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                    {item.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-700" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-slate-200">{item.label}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        item.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                        item.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                        item.status === 'checking' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                    
                    {item.status === 'failed' && item.errorMsg && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-300 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{item.errorMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-between items-center glass-card p-5">
            <button
              onClick={runVerification}
              disabled={isVerifying}
              className="flex items-center gap-2 text-xs font-bold bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white px-5 py-3 rounded-lg text-slate-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
              Re-run Diagnostics
            </button>

            {allPassed ? (
              <button
                onClick={handleStartExam}
                className="glow-btn font-bold text-xs py-3 px-6 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                Enter Exam Arena
              </button>
            ) : (
              <div className="text-xs text-rose-400 font-semibold bg-rose-500/5 px-4 py-3 rounded-lg border border-rose-500/10 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5" />
                <span>Resolve all check failures to begin your assessment.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Logs & Diagnostic info */}
        <aside className="w-full md:w-80 flex flex-col gap-6">
          {/* Instructions Box */}
          <div className="glass-panel p-5 border border-slate-850 rounded-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Diagnostic Controls</h3>
            
            {mediaPermissionDenied && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Webcam/Mic privacy permission has been blocked. Please open System Privacy Settings and enable permissions for this application.
                </p>
                <button
                  onClick={() => sb?.openPermissionSettings('camera')}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-lg transition-colors text-white"
                >
                  <Settings className="w-4 h-4" /> Open Camera Privacy Settings
                </button>
              </div>
            )}

            {unresolvedMonitor && (
              <p className="text-xs text-amber-300 leading-relaxed bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg">
                Please disconnect all external display monitors, HDMI docks, or screen-sharing systems. The secure shell only permits one physical monitor.
              </p>
            )}

            {unresolvedProcess && (
              <div className="space-y-3">
                <p className="text-xs text-rose-300 leading-relaxed bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg">
                  Forbidden application running: <span className="font-mono font-bold text-white">"{unresolvedProcess}"</span>. Close it manually or click the button below to shut it down.
                </p>
              </div>
            )}

            {unresolvedVM && (
              <p className="text-xs text-rose-300 leading-relaxed bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg">
                Virtual Machine environment detected. Please quit this application and launch it on your physical machine (native OS).
              </p>
            )}

            {!mediaPermissionDenied && !unresolvedMonitor && !unresolvedProcess && !unresolvedVM && (
              <p className="text-xs text-slate-400 leading-relaxed">
                Diagnostics running in background. You will be allowed to start the assessment once all checks turn green.
              </p>
            )}
          </div>

          {/* System Console Logs */}
          <div className="glass-card flex-1 p-5 flex flex-col border border-slate-850 min-h-60">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Auditing Log</h3>
            <div className="flex-1 bg-slate-950/80 p-3 rounded-lg border border-slate-900 font-mono text-[10px] text-slate-300 overflow-y-auto flex flex-col gap-1.5 h-64">
              {systemLogs.length === 0 ? (
                <span className="text-slate-600">Idle...</span>
              ) : (
                systemLogs.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-slate-900/40 pb-1.5 break-words">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
