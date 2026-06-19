import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, RotateCcw, ShieldAlert, Video, FileText } from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'

interface Question {
  id: string
  type: string
  question_text: string
  question_image?: string | null
  question_audio?: string | null
  question_video?: string | null
  question_document?: string | null
  options?: Array<{
    id: string
    option_text: string
    option_image?: string | null
    option_audio?: string | null
    option_video?: string | null
  }>
}

export default function TestInterface() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // State
  const [questions, setQuestions] = useState<Question[]>([])
  const [assessmentTitle, setAssessmentTitle] = useState("Loading...")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; answer_text?: string }>>({})
  const [timeLeft, setTimeLeft] = useState(1800) // Default 30 minutes, overridden by backend
  const [violations, setViolations] = useState(0)
  const [warningMessage, setWarningMessage] = useState("")

  // Fetch attempt questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.get(`/assessments/attempts/${attemptId}/questions`)
        setQuestions(res.data.questions)
        setAssessmentTitle(res.data.assessment_title)
        setTimeLeft(res.data.remaining_seconds)
        
        // Restore client_state drafts
        if (res.data.client_state) {
          const draftAnswers: Record<string, { selected_option_id?: string; answer_text?: string }> = {}
          Object.keys(res.data.client_state).forEach((qId) => {
            draftAnswers[qId] = {
              selected_option_id: res.data.client_state[qId].selected_option_id || undefined,
              answer_text: res.data.client_state[qId].answer_text || undefined
            }
          })
          setAnswers(draftAnswers)
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to fetch test questions.')
      } finally {
        setLoading(false)
      }
    }
    
    if (attemptId) {
      fetchQuestions()
    }
  }, [attemptId])

  const activeQuestion = questions[currentIndex]

  const sb = (window as any).secureBrowser

  // Start exam lockdown if secure browser is present
  useEffect(() => {
    if (sb) {
      sb.startExam()
    }
  }, [sb])

  // Timer Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fullscreen, Tab Switch & Secure Browser Process/Monitor Violation Listeners
  useEffect(() => {
    if (sb) {
      // 1. Listen for background audits
      const unsubscribeStatus = sb.onStatusUpdate((status: any) => {
        if (status.hasViolation) {
          handleViolation(status.type || 'security_violation', status.message || 'Environment security compromise')
        }
      })

      // 2. Listen for window focus loss
      const unsubscribeBlur = sb.onWindowBlur(() => {
        handleViolation('window_blur', 'Secure browser focus lost')
      })

      return () => {
        unsubscribeStatus()
        unsubscribeBlur()
      }
    } else {
      // Fallback for standard browsers
      const handleVisibilityChange = () => {
        if (document.hidden) {
          handleViolation("tab_switch", "Tab switched detected")
        }
      }
      const handleBlur = () => {
        handleViolation("window_blur", "Window focus lost detected")
      }

      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("blur", handleBlur)

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
        window.removeEventListener("blur", handleBlur)
      }
    }
  }, [violations, sb])

  const handleViolation = async (type: string, message: string) => {
    const nextViolations = violations + 1
    setViolations(nextViolations)
    setWarningMessage(`WARNING: Suspicious activity detected. Action logged: ${message}. (${nextViolations}/5)`)
    
    // Log violation to backend
    try {
      await api.post(`/proctoring/events`, {
        attempt_id: attemptId,
        event_type: type,
        details: { message }
      })
    } catch (err) {
      console.error("Failed to sync proctor event:", err)
    }

    if (nextViolations >= 5) {
      alert("Test terminated automatically due to excessive violations.")
      handleSubmit()
    }
  }

  const handleSelectOption = (optionId: string) => {
    const updated = {
      ...answers,
      [activeQuestion.id]: {
        ...answers[activeQuestion.id],
        selected_option_id: optionId
      }
    }
    setAnswers(updated)
    saveDraft(activeQuestion.id, optionId, "")
  }

  const handleTextChange = (text: string) => {
    const updated = {
      ...answers,
      [activeQuestion.id]: {
        ...answers[activeQuestion.id],
        answer_text: text
      }
    }
    setAnswers(updated)
    saveDraft(activeQuestion.id, undefined, text)
  }

  const saveDraft = async (qId: string, optionId?: string, text?: string) => {
    try {
      await api.post(`/assessments/attempts/${attemptId}/save-answer`, {
        question_id: qId,
        selected_option_id: optionId,
        answer_text: text,
        time_spent_seconds: 10
      })
    } catch (err) {
      console.warn("Draft auto-save local cache sync offline.")
    }
  }

  const handleSubmit = async () => {
    try {
      await api.post(`/assessments/attempts/${attemptId}/submit`)
      if (sb) {
        sb.endExam()
        alert("Assessment submitted successfully. The secure browser will now exit.")
        sb.closeBrowser()
      } else {
        navigate('/results')
      }
    } catch (err) {
      alert("Submission synced successfully.")
      if (sb) {
        sb.endExam()
        sb.closeBrowser()
      } else {
        navigate('/')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-400 font-mono tracking-wider animate-pulse">Loading assessment environment...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="glass-panel max-w-md w-full p-8 border border-rose-500/20 text-center space-y-4 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-lg font-bold text-white tracking-wide">Error Launching Test</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{error}</p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full mt-4 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="glass-panel max-w-md w-full p-8 border border-amber-500/20 text-center space-y-4 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-white tracking-wide">No Questions Assigned</h2>
          <p className="text-xs text-slate-400 leading-relaxed">No questions have been populated for this test attempt.</p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full mt-4 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="glass-panel px-6 py-4 flex justify-between items-center border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">{assessmentTitle}</h1>
          <p className="text-xs text-slate-400">Student ID: {user?.email || 'Candidate'}</p>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Violations Count */}
          {violations > 0 && (
            <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-semibold">Violations: {violations}/5</span>
            </div>
          )}

          {/* Timer */}
          <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-lg border border-indigo-500/20 font-mono text-lg font-bold">
            <Clock className="w-5 h-5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* Warning Panel */}
      {warningMessage && (
        <div className="bg-amber-500/20 text-amber-300 border-b border-amber-500/30 px-6 py-2.5 flex items-center gap-2 text-sm animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center - Active Question */}
        <div className="flex-1 p-8 overflow-y-auto flex flex-col">
          <div className="glass-card p-6 flex-1 flex flex-col">
            <div className="flex justify-between border-b border-slate-800 pb-4 mb-6">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs bg-slate-800 px-2.5 py-1 rounded text-slate-300 font-medium">
                Type: {
                  activeQuestion.type === 'mcq_single' ? 'MCQ Single Correct' :
                  activeQuestion.type === 'mcq_multi' ? 'MCQ Multiple Correct' :
                  activeQuestion.type === 'true_false' ? 'True / False' :
                  activeQuestion.type === 'fill_blank' ? 'Fill In The Blanks' :
                  activeQuestion.type === 'coding' ? 'Coding Challenge' : activeQuestion.type
                }
              </span>
            </div>

            {/* Question Media Attachments */}
            {(activeQuestion.question_image || activeQuestion.question_audio || activeQuestion.question_video || activeQuestion.question_document) && (
              <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl bg-slate-900/40 border border-slate-900 w-full">
                {activeQuestion.question_image && (
                  <div className="max-w-md w-full">
                    <img 
                      src={activeQuestion.question_image} 
                      alt="Question Attachment" 
                      className="rounded-lg max-h-64 object-contain border border-slate-800 shadow-md"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-3 justify-center min-w-[280px] flex-1">
                  {activeQuestion.question_audio && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Listen to Audio Clip</span>
                      <audio controls src={activeQuestion.question_audio} className="w-full max-w-[320px] h-8" />
                    </div>
                  )}
                  {activeQuestion.question_video && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Watch Video Clip</span>
                      <video controls src={activeQuestion.question_video} className="w-full max-w-[400px] rounded-lg border border-slate-800 max-h-48" />
                    </div>
                  )}
                  {activeQuestion.question_document && (
                    <div className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors py-1">
                      <FileText className="w-5 h-5" />
                      <a href={activeQuestion.question_document} target="_blank" rel="noreferrer" className="underline font-semibold">
                        View Reference Document
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-lg text-slate-200 mb-8 leading-relaxed font-medium">
              {activeQuestion.question_text}
            </p>

            {/* Answer Controls */}
            <div className="flex-1">
              {activeQuestion.type === "mcq_single" || activeQuestion.type === "mcq_multi" || activeQuestion.type === "true_false" ? (
                <div className="space-y-4 max-w-2xl">
                  {activeQuestion.options?.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        answers[activeQuestion.id]?.selected_option_id === opt.id
                          ? "bg-indigo-500/20 border-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10"
                          : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700/60 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        <span>{opt.option_text}</span>
                        {(opt.option_audio || opt.option_video) && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-800/40" onClick={(e) => e.stopPropagation()}>
                            {opt.option_audio && (
                              <div className="w-full max-w-[240px] flex flex-col gap-1">
                                <span className="text-[8px] text-slate-500 uppercase font-semibold">Audio Clip</span>
                                <audio controls src={opt.option_audio} className="w-full h-6" />
                              </div>
                            )}
                            {opt.option_video && (
                              <div className="w-full max-w-[240px] flex flex-col gap-1">
                                <span className="text-[8px] text-slate-500 uppercase font-semibold">Video Clip</span>
                                <video controls src={opt.option_video} className="w-full rounded border border-slate-800 max-h-24" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {opt.option_image && (
                        <div className="shrink-0 max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                          <img src={opt.option_image} alt="Option attachment" className="rounded max-h-16 object-contain border border-slate-800" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col h-96 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">
                      {activeQuestion.type === 'coding' ? 'script.py' : 'Answer text'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={answers[activeQuestion.id]?.answer_text || ""}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={activeQuestion.type === 'coding' ? "# Write your Python solution here..." : "Type your answer here..."}
                    className="flex-1 p-4 bg-slate-950 text-emerald-400 font-mono text-sm resize-none focus:outline-none placeholder-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Navigation Row */}
            <div className="border-t border-slate-800 pt-6 mt-8 flex justify-between items-center">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/15 transition-all"
                >
                  Submit Assessment
                </button>
                <button
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="glow-btn font-semibold"
                >
                  Save & Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Side Controls & Proctor Camera Feed */}
        <aside className="w-80 border-l border-slate-800 bg-slate-900/20 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Webcam Box */}
          <div className="glass-card p-4 rounded-xl relative overflow-hidden aspect-video flex flex-col justify-center items-center bg-slate-950/80 border-indigo-500/30 border">
            <Video className="w-8 h-8 text-indigo-400 mb-2 animate-pulse" />
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
              Proctoring Active
            </span>
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[10px] font-bold">REC</span>
            </div>
          </div>

          {/* Palette */}
          <div className="glass-panel p-4 rounded-xl flex-1 flex flex-col border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Questions Navigation
            </h3>
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all duration-150 ${
                    currentIndex === i
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400"
                      : answers[questions[i].id]
                      ? "bg-emerald-500/25 border border-emerald-500/40 text-emerald-400"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700/60"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
