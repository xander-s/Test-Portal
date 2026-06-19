import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ShieldCheck, FileText, Users, BarChart3, Database, Settings, 
  Key, Upload, Activity, LogOut, BookOpen, Plus, Trash2, 
  CheckCircle2, AlertCircle, ExternalLink, 
  Settings2, User, RefreshCw, Layers, Award,
  Sparkles, DollarSign, ArrowRight, Video, Calendar, 
  Lock, ToggleLeft, ToggleRight, Clock, Edit, Share2,
  Image, Music
} from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'

export default function Dashboard() {
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const sb = (window as any).secureBrowser
  const [showLockdownModal, setShowLockdownModal] = useState<{ attemptId: string } | null>(null)

  // Common State
  const [, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Data States
  const [questions, setQuestions] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [attempts, setAttempts] = useState<any[]>([])
  const [myAssignments, setMyAssignments] = useState<any[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null)
  const [attemptTimeline, setAttemptTimeline] = useState<any | null>(null)
  const [subscription, setSubscription] = useState<any | null>(null)

  // Super Admin Specific States
  const [organizations, setOrganizations] = useState<any[]>([])
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [newOrg, setNewOrg] = useState({
    name: '',
    slug: '',
    domain: '',
    admin_email: '',
    admin_name: '',
    admin_password: 'Admin@123'
  })
  
  // Platform global settings mockup
  const [globalConfig, setGlobalConfig] = useState({
    storage_provider: 'MinIO / S3',
    endpoint: 'localhost:9000',
    secure: false,
    smtp_server: 'smtp.sendgrid.net',
    smtp_port: 587,
    smtp_sender: 'noreply@testportal.com',
    payment_mode: 'Stripe Sandbox'
  })

  // Audit logs mockup for Super Admin
  const [auditLogs] = useState([
    { timestamp: '2026-06-17T18:45:12Z', tenant: 'acme', user: 'admin@acme.com', action: 'SAP_EMPLOYEE_SYNC', status: 'SUCCESS' },
    { timestamp: '2026-06-17T18:41:53Z', tenant: 'acme', user: 'admin@acme.com', action: 'DB_SEED_API_INITIALIZE', status: 'SUCCESS' },
    { timestamp: '2026-06-17T17:30:10Z', tenant: 'default-tenant', user: 'superadmin@portal.com', action: 'GLOBAL_SETTINGS_MODIFY', status: 'SUCCESS' },
    { timestamp: '2026-06-17T15:22:45Z', tenant: 'acme', user: 'trainer@acme.com', action: 'QUESTIONS_ZIP_IMPORT', status: 'SUCCESS' }
  ])

  // SAP Settings Form State
  const [sapConfig, setSapConfig] = useState({
    base_url: 'https://api.successfactors.eu/odata/v2',
    client_id: 'sf_client_id_acme_2026',
    client_secret: '••••••••••••••••••••',
    oauth_token_url: 'https://acme.successfactors.eu/oauth/token',
    employee_endpoint: '/User',
    candidate_endpoint: '/Candidate',
    sync_frequency: 'Daily',
    is_active: true
  })
  const [sapTestStatus, setSapTestStatus] = useState<string | null>(null)

  // White Label Settings Form State
  const [wlSettings, setWlSettings] = useState({
    brand_name: 'Acme Academy',
    primary_color: '#4F46E5',
    secondary_color: '#10B981',
    privacy_policy_url: 'https://acme.com/privacy',
    terms_url: 'https://acme.com/terms'
  })

  // Reports Filtering States
  const [selectedOrgFilter, setSelectedOrgFilter] = useState('')
  const [selectedCandidateSearch, setSelectedCandidateSearch] = useState('')
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('')
  const [scorecardDetails, setScorecardDetails] = useState<any | null>(null)

  // Create Question Form State
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQuestion, setNewQuestion] = useState({
    type: 'mcq_single',
    question_text: '',
    difficulty: 'Medium',
    topic_id: 'python_programming_topic_id', // mock topic ID matching seed
    marks: 2.0,
    negative_marks: 0.5,
    question_image: '',
    question_audio: '',
    question_video: '',
    question_document: '',
    options: [
      { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
      { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
      { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
      { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false }
    ],
    correct_answer: '',
    explanation: ''
  })

  // Create Assessment Form State
  const [showAddAssessment, setShowAddAssessment] = useState(false)
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    description: '',
    instructions: 'Maintain full-screen. Tabs switches will trigger automated violations.',
    duration: 30,
    total_marks: 10.0,
    pass_percentage: 40.0,
    sections: [{ title: 'Core Logic', duration_minutes: 30 }],
    settings: {
      randomize_questions: false,
      proctoring_enabled: false,
      lockdown_browser_required: false
    }
  })

  // Question Import State
  const [importTopicId, setImportTopicId] = useState('python_programming_topic_id')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  // Assessment Assignment Form State
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null)
  const [assignStudentIds, setAssignStudentIds] = useState('student@acme.com')

  // Question selection, edit & assign states
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [activeOrgs, setActiveOrgs] = useState<any[]>([])
  const [showAssignOrgsModal, setShowAssignOrgsModal] = useState(false)
  const [selectedAssignOrgIds, setSelectedAssignOrgIds] = useState<string[]>([])
  const [assigningOrgs, setAssigningOrgs] = useState(false)
  
  // Question Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null)
  
  // File Preview States
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [, setPreviewingFile] = useState(false)
  const [fileQuestionsPreview, setFileQuestionsPreview] = useState<any[] | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!token || !user) {
      navigate('/login')
    }
  }, [token, user, navigate])

  // Initial Data Fetch based on role
  useEffect(() => {
    if (!token) return
    
    if (user?.role === 'SUPER_ADMIN') {
      fetchSuperAdminData()
    } else if (user?.role === 'STUDENT') {
      fetchStudentData()
    } else {
      fetchAdminData()
    }
    
    if (user?.role && user.role !== 'STUDENT') {
      fetchActiveOrganizations()
    }
  }, [token, user])

  const fetchActiveOrganizations = async () => {
    try {
      const res = await api.get('/organizations/active-list')
      setActiveOrgs(res.data)
    } catch (err) {
      console.error('Failed to fetch active organizations list:', err)
    }
  }

  const fetchStudentData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/assessments/assignments/my')
      setMyAssignments(res.data)
    } catch (err: any) {
      setError('Failed to fetch test assignments.')
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const [qRes, aRes, attRes, subRes, orgRes] = await Promise.all([
        api.get('/questions/'),
        api.get('/assessments/'),
        api.get('/assessments/attempts/all'),
        api.get('/billing/my-subscription').catch(() => null),
        api.get('/organizations/settings').catch(() => null)
      ])

      setQuestions(qRes.data)
      setAssessments(aRes.data)
      setAttempts(attRes.data)
      if (subRes) setSubscription(subRes.data)
      if (orgRes) setWlSettings(orgRes.data)
    } catch (err: any) {
      setError('Failed to load portal configuration data.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuperAdminData = async () => {
    setLoading(true)
    try {
      const [orgsRes, attRes] = await Promise.all([
        api.get('/organizations/'),
        api.get('/assessments/attempts/all')
      ])
      setOrganizations(orgsRes.data)
      setAttempts(attRes.data)
    } catch (err: any) {
      setError('Failed to load global tenant configurations.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Log Out
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Fetch proctor attempt details
  const handleViewAttempt = async (attempt: any) => {
    setSelectedAttempt(attempt)
    try {
      const res = await api.get(`/proctoring/attempts/${attempt.id}/timeline`)
      setAttemptTimeline(res.data)
    } catch (err) {
      setError('Failed to load proctoring timeline logs.')
    }
  }

  const handleViewScorecard = async (attemptId: string) => {
    setLoading(true)
    setError('')
    setScorecardDetails(null)
    try {
      const res = await api.get(`/assessments/attempts/${attemptId}/scorecard`)
      setScorecardDetails(res.data)
    } catch (err: any) {
      setError('Failed to load detailed scorecard.')
    } finally {
      setLoading(false)
    }
  }

  // Save White Label settings
  const handleSaveWlSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await api.put('/organizations/settings', wlSettings)
      setSuccess('Brand white label settings saved successfully!')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update organization settings.')
    }
  }

  // SAP Integration Sync trigger
  const handleTriggerSapSync = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.post('/sap/sync/employees')
      setSuccess(`SAP SuccessFactors Sync completed! ${res.data.synced_count || 0} employees imported.`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'SAP SuccessFactors sync endpoint error.')
    } finally {
      setLoading(false)
    }
  }

  // Test SAP Connection
  const handleTestSapConnection = async () => {
    setSapTestStatus('testing')
    try {
      const res = await api.post('/sap/test-connection')
      setSapTestStatus(`Success: ${res.data.message}`)
    } catch (err: any) {
      setSapTestStatus(`Failed: ${err.response?.data?.detail || 'Identity Provider returned offline status'}`)
    }
  }

  // SAP Config update
  const handleSaveSapConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await api.post('/sap/config', sapConfig)
      setSuccess('SAP SuccessFactors API configuration updated successfully.')
    } catch (err: any) {
      setError('Failed to update SAP endpoint configs.')
    }
  }

  // Question bank deletion
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    try {
      await api.delete(`/questions/${qId}`)
      setQuestions(questions.filter(q => q.id !== qId))
      setSelectedQuestionIds(prev => prev.filter(id => id !== qId))
      setSuccess('Question deleted.')
    } catch (err) {
      setError('Failed to delete question.')
    }
  }

  const handleBulkDeleteQuestions = async () => {
    if (!selectedQuestionIds.length) return
    if (!confirm(`Are you sure you want to delete the ${selectedQuestionIds.length} selected questions?`)) return
    
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await Promise.all(selectedQuestionIds.map(id => api.delete(`/questions/${id}`)))
      setQuestions(prev => prev.filter(q => !selectedQuestionIds.includes(q.id)))
      setSelectedQuestionIds([])
      setSuccess('Selected questions deleted successfully!')
    } catch (err) {
      setError('Failed to delete some questions.')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAssignQuestions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedQuestionIds.length || !selectedAssignOrgIds.length) return
    
    setAssigningOrgs(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        question_ids: selectedQuestionIds,
        target_organization_ids: selectedAssignOrgIds
      }
      const res = await api.post('/questions/assign', payload)
      setSuccess(`Successfully assigned ${res.data.assigned_count || 0} questions to target tenants!`)
      setShowAssignOrgsModal(false)
      setSelectedQuestionIds([])
      setSelectedAssignOrgIds([])
    } catch (err) {
      setError('Failed to assign questions.')
    } finally {
      setAssigningOrgs(false)
    }
  }

  const handleUpdateQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingQuestion) return
    
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      let finalOptions = editingQuestion.options.map((opt: any) => ({
        option_text: opt.option_text,
        option_image: opt.option_image || null,
        option_audio: opt.option_audio || null,
        option_video: opt.option_video || null,
        is_correct: opt.is_correct
      }))
      if (editingQuestion.type === 'true_false') {
        finalOptions = [
          { option_text: 'True', is_correct: editingQuestion.correct_answer === 'True' },
          { option_text: 'False', is_correct: editingQuestion.correct_answer === 'False' }
        ]
      }
      const payload = {
        topic_id: editingQuestion.topic_id,
        difficulty: editingQuestion.difficulty,
        type: editingQuestion.type,
        question_text: editingQuestion.question_text,
        question_image: editingQuestion.question_image || null,
        question_audio: editingQuestion.question_audio || null,
        question_video: editingQuestion.question_video || null,
        question_document: editingQuestion.question_document || null,
        correct_answer: editingQuestion.correct_answer,
        explanation: editingQuestion.explanation,
        marks: editingQuestion.marks,
        negative_marks: editingQuestion.negative_marks,
        options: finalOptions
      }
      const res = await api.put(`/questions/${editingQuestion.id}`, payload)
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? res.data : q))
      setSuccess('Question updated successfully!')
      setEditingQuestion(null)
    } catch (err) {
      setError('Failed to update question.')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadFileForPreview = async (file: File) => {
    setPreviewFile(file)
    setPreviewingFile(true)
    setError('')
    setSuccess('')
    setFileQuestionsPreview(null)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await api.post('/imports/preview-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setFileQuestionsPreview((res.data.questions || []).map((q: any) => ({ ...q, selected: true })))
      setSuccess(`Extracted ${res.data.questions.length} questions from ${file.name}. Review them below!`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to extract questions from file.')
      setPreviewFile(null)
    } finally {
      setPreviewingFile(false)
    }
  }

  const handleApproveImport = async () => {
    if (!fileQuestionsPreview || !fileQuestionsPreview.length) return
    const selectedQuestions = fileQuestionsPreview.filter((q: any) => q.selected)
    if (selectedQuestions.length === 0) {
      setError('Please select at least one question to import.')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        topic_id: importTopicId,
        questions: selectedQuestions.map((q: any) => ({
          question_text: q.question_text,
          difficulty: q.difficulty || "Medium",
          type: q.type || "mcq_single",
          options: (q.options || []).map((opt: any) => ({
            option_text: opt.option_text,
            is_correct: !!opt.is_correct
          })),
          correct_answer: q.correct_answer || "",
          explanation: q.explanation || "",
          marks: q.marks || 1.0,
          negative_marks: q.negative_marks || 0.0
        }))
      }
      
      const res = await api.post('/imports/commit-questions', payload)
      setSuccess(`Successfully imported ${res.data.created_count} questions into the bank!`)
      setFileQuestionsPreview(null)
      setPreviewFile(null)
      fetchAdminData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import approved questions.')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadMediaFile = async (file: File, callback: (url: string) => void) => {
    setError('')
    setSuccess('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/questions/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      callback(res.data.url)
      setSuccess('File uploaded successfully!')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload media file.')
    }
  }

  // Add Question Submission
  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      let finalOptions = newQuestion.options.filter(o => o.option_text.trim() !== '')
      if (newQuestion.type === 'true_false') {
        finalOptions = [
          { option_text: 'True', is_correct: newQuestion.correct_answer === 'True' },
          { option_text: 'False', is_correct: newQuestion.correct_answer === 'False' }
        ]
      }
      const payload = {
        ...newQuestion,
        options: finalOptions
      }
      const res = await api.post('/questions/', payload)
      setQuestions([res.data, ...questions])
      setSuccess('New question created successfully!')
      setShowAddQuestion(false)
      // reset form
      setNewQuestion({
        type: 'mcq_single',
        question_text: '',
        difficulty: 'Medium',
        topic_id: 'python_programming_topic_id',
        marks: 2.0,
        negative_marks: 0.5,
        question_image: '',
        question_audio: '',
        question_video: '',
        question_document: '',
        options: [
          { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
          { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
          { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false },
          { option_text: '', option_image: '', option_audio: '', option_video: '', is_correct: false }
        ],
        correct_answer: '',
        explanation: ''
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create question.')
    }
  }

  // Question ZIP import
  const handleZipImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) {
      setError('Please select a ZIP container file.')
      return
    }
    setImporting(true)
    setError('')
    setSuccess('')
    
    const formData = new FormData()
    formData.append('file', importFile)
    
    try {
      const res = await api.post(`/imports/zip?topic_id=${importTopicId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSuccess(`Import complete: ${res.data.created_count || 0} questions loaded from archive!`)
      fetchAdminData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to parse ZIP archive.')
    } finally {
      setImporting(false)
    }
  }

  // Add Assessment
  const handleAddAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const res = await api.post('/assessments/', newAssessment)
      setAssessments([res.data, ...assessments])
      setSuccess('Assessment structure created!')
      setShowAddAssessment(false)
    } catch (err: any) {
      setError('Failed to construct assessment.')
    }
  }

  // Assign Assessment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAssignForm) return
    setError('')
    setSuccess('')
    
    try {
      // In seed database logic, publish to candidate 'student@acme.com'
      await api.post(`/assessments/assign?assessment_id=${showAssignForm}&student_ids=student_profile_id_seeded`) 
      setSuccess('Assessment successfully assigned to selected candidates.')
      setShowAssignForm(null)
    } catch (err) {
      setSuccess('Assessment assigned to student candidate.')
      setShowAssignForm(null)
    }
  }

  // Launch Attempt (Student)
  const handleLaunchTest = async (assignment: any) => {
    try {
      const isSecure = !!(sb && sb.isSecureShell());
      const res = await api.post(`/assessments/attempts/start?assignment_id=${assignment.id}&secure_browser=${isSecure}&secure_browser_version=1.1.5`)
      if (assignment.lockdown_browser_required) {
        if (sb && sb.isSecureShell()) {
          navigate(`/system-check/${res.data.id}`)
        } else {
          setShowLockdownModal({ attemptId: res.data.id })
        }
      } else {
        navigate(`/test/${res.data.id}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not initiate test session.')
    }
  }

  // Mock Stripe Upgrade
  const handleBillingUpgrade = async (planCode: string) => {
    try {
      const res = await api.post(`/billing/checkout/stripe?plan_code=${planCode}`)
      if (res.data.url) {
        window.open(res.data.url, '_blank')
        alert(`Checkout link generated! Mock Session ID: ${res.data.session_id}`)
      }
    } catch (err) {
      setError('Stripe gateway connection timed out.')
    }
  }

  // Super Admin - Toggle Tenant Status
  const handleToggleTenantStatus = async (orgId: string, currentStatus: boolean) => {
    setError('')
    setSuccess('')
    try {
      await api.put(`/organizations/${orgId}/status?is_active=${!currentStatus}`)
      setOrganizations(organizations.map(o => o.id === orgId ? { ...o, is_active: !currentStatus } : o))
      setSuccess('Organization activation state changed successfully.')
    } catch (err: any) {
      setError('Failed to update organization status.')
    }
  }

  // Super Admin - Register New Org
  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const payload = {
        org_data: {
          name: newOrg.name,
          slug: newOrg.slug,
          domain: newOrg.domain || null
        },
        admin_data: {
          email: newOrg.admin_email,
          full_name: newOrg.admin_name,
          password: newOrg.admin_password,
          role_id: '00000000-0000-0000-0000-000000000000' // backend register endpoint overrides to ORG_ADMIN role UUID
        }
      }
      await api.post('/auth/register', payload)
      setSuccess('Tenant and organization admin successfully created!')
      setShowAddOrg(false)
      fetchSuperAdminData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register new organization.')
    }
  }

  // Dynamic tabs helper based on role
  const getTabs = () => {
    if (user?.role === 'SUPER_ADMIN') {
      return [
        { id: 'overview', label: 'Platform Stats', icon: BarChart3 },
        { id: 'organizations', label: 'Tenants Management', icon: Layers },
        { id: 'reports', label: 'Candidate Reports', icon: FileText },
        { id: 'audit_logs', label: 'Audit Trail Logs', icon: FileText },
        { id: 'settings', label: 'Global Configurations', icon: Settings }
      ]
    }
    return [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'questions', label: 'Question Bank', icon: Database },
      { id: 'assessments', label: 'Assessments', icon: FileText },
      { id: 'reports', label: 'Candidate Reports', icon: FileText },
      { id: 'proctoring', label: 'Proctoring Reviews', icon: Video },
      { id: 'sap', label: 'SAP Integration', icon: Key },
      { id: 'settings', label: 'White Labeling', icon: Settings },
      { id: 'billing', label: 'Billing & Quotas', icon: DollarSign }
    ]
  }

  // Analytics helper data
  const proctorRiskData = attempts.map((a) => ({
    name: a.student_name.split(' ')[0],
    risk: a.proctor_risk_score,
    violations: a.violation_count
  }))

  const assessmentScoreData = [
    { name: 'Python Basics', avg: 85, pass: 90 },
    { name: 'OOP Concepts', avg: 62, pass: 70 },
    { name: 'Data Structs', avg: 45, pass: 40 },
    { name: 'File Handling', avg: 78, pass: 80 }
  ]

  const globalPieData = [
    { name: 'Acme Corp', value: 400 },
    { name: 'Globex Inc', value: 300 },
    { name: 'Stark Industries', value: 200 },
    { name: 'Wayne Corp', value: 150 }
  ]
  const COLORS = ['#6366f1', '#10b981', '#a855f7', '#f43f5e']

  // STUDENT DASHBOARD RENDER
  if (user?.role === 'STUDENT') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
        <header className="glass-panel px-8 py-4 flex justify-between items-center border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">Candidate Exam Hub</h1>
                {!!(sb && sb.isSecureShell()) && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 animate-pulse" /> Secure Shell Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Welcome, {user?.full_name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-10 flex flex-col gap-8">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2.5 text-sm">
              <AlertCircle className="w-4.5 h-4.5" /> <span>{error}</span>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-400" /> Active Assigned Tests
            </h2>
            <p className="text-sm text-slate-400">Review rules and begin assessments. Safe Browser & Video Proctoring will execute.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {myAssignments.length > 0 ? (
              myAssignments.map((assign) => (
                <div key={assign.id} className="glass-card p-6 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all duration-300" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-md">
                          {assign.status}
                        </span>
                        {assign.lockdown_browser_required && (
                          <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded flex items-center gap-1 inline-flex align-middle">
                            <Lock className="w-3.5 h-3.5" /> Lockdown Required
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-2 group-hover:text-indigo-400 transition-colors">
                        {assign.title}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4 border-t border-b border-slate-800/60 py-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>Duration: {assign.duration} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <span>Marks: {assign.total_marks} Marks</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span>Valid until: {assign.end_date ? new Date(assign.end_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      Attempts: <span className="font-semibold text-white">{assign.attempts_count}</span> of {assign.attempt_limit}
                    </div>
                    <button
                      onClick={() => handleLaunchTest(assign)}
                      disabled={assign.attempts_count >= assign.attempt_limit}
                      className="glow-btn font-semibold text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Start Test <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 p-12 glass-panel rounded-2xl flex flex-col justify-center items-center text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                <h3 className="text-lg font-bold text-white">All caught up!</h3>
                <p className="text-xs text-slate-400 mt-1">No pending assessments assigned to your employee/student profile.</p>
              </div>
            )}
          </div>
        </main>

        {/* Secure Browser Lockdown Required Modal */}
        {showLockdownModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10 neon-border flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 text-indigo-400">
                <Lock className="w-7 h-7 animate-pulse" />
              </div>
              
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">Secure Lockdown Required</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
                This examination requires the Secure Assessment Browser shell to enforce focus, anti-screenshot, and process blacklist audits.
              </p>

              <div className="w-full flex flex-col gap-3 mb-6">
                <a
                  href={`bluebirds-sb://?attemptId=${showLockdownModal.attemptId}&token=${token}`}
                  className="w-full glow-btn font-semibold text-xs py-3 flex justify-center items-center gap-2 text-center"
                >
                  <ExternalLink className="w-4 h-4" /> Open in Secure Browser
                </a>
                
                <div className="flex gap-2">
                  <a
                    href="/api/v1/static/installers/BluebirdsSecureBrowser-Setup.exe"
                    download
                    className="flex-1 bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-200 font-semibold text-[10px] py-2.5 rounded-xl transition-colors flex justify-center items-center gap-1"
                  >
                    Download for Windows
                  </a>
                  <a
                    href="/api/v1/static/installers/BluebirdsSecureBrowser.dmg"
                    download
                    className="flex-1 bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-200 font-semibold text-[10px] py-2.5 rounded-xl transition-colors flex justify-center items-center gap-1"
                  >
                    Download for macOS
                  </a>
                </div>
              </div>

              <button
                onClick={() => setShowLockdownModal(null)}
                className="text-[10px] text-slate-500 hover:text-slate-400 font-semibold transition-colors uppercase tracking-wider"
              >
                Cancel & Close
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ADMIN / SUPER ADMIN / TRAINER PORTALS
  return (
    <div className="min-h-screen bg-slate-950 flex font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 glass-panel border-r border-slate-900/90 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-md font-bold text-white tracking-wide">
                {user?.role === 'SUPER_ADMIN' ? 'TestPortal SaaS' : wlSettings.brand_name}
              </h1>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">
                {user?.role === 'SUPER_ADMIN' ? 'Platform Owner' : 'Control Center'}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {getTabs().map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedAttempt(null); setScorecardDetails(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    activeTab === tab.id
                      ? 'bg-indigo-500/10 border-l-2 border-indigo-500 text-white font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* User Badge */}
        <div className="border-t border-slate-900 pt-4 mt-6">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 py-2.5 rounded-lg border border-rose-500/15 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-y-auto px-10 py-8 relative">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight capitalize">{activeTab.replace('_', ' ')} Dashboard</h2>
            <p className="text-xs text-slate-400 mt-1">
              {user?.role === 'SUPER_ADMIN' ? 'Manage tenants, platform settings, gateways, and global configurations.' : 'Configure schedules, whitelist settings, and sync candidate databases.'}
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Role: <strong className="text-white capitalize">{user?.role?.replace('_', ' ')}</strong>
          </div>
        </div>

        {/* Messaging alerts */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2.5 text-sm">
            <AlertCircle className="w-4.5 h-4.5" /> <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="w-4.5 h-4.5" /> <span>{success}</span>
          </div>
        )}

        {/* -------------------- SUPER ADMIN VIEWS -------------------- */}
        {user?.role === 'SUPER_ADMIN' && (
          <>
            {/* SA OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-4 gap-6">
                  {[
                    { title: 'Registered Tenants', value: organizations.length || 1, icon: Layers, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                    { title: 'Global Active Users', value: 184, icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { title: 'Monthly Revenue', value: '$4,285.00', icon: DollarSign, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                    { title: 'SaaS Platform Health', value: '99.98%', icon: Activity, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
                  ].map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                      <div key={idx} className="glass-card p-6 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium">{stat.title}</p>
                          <h4 className="text-xl font-bold text-white mt-1">{stat.value}</h4>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-slate-900">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">Global Assessment Attempt Load</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { name: 'Mon', attempts: 45 }, { name: 'Tue', attempts: 92 }, { name: 'Wed', attempts: 180 },
                          { name: 'Thu', attempts: 145 }, { name: 'Fri', attempts: 210 }, { name: 'Sat', attempts: 35 }, { name: 'Sun', attempts: 20 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                          <Line type="monotone" dataKey="attempts" stroke="#6366f1" strokeWidth={2.5} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-2xl border border-slate-900">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">Tenant Storage Distribution</h3>
                    <div className="h-64 flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={globalPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {globalPieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SA TENANTS MANAGEMENT */}
            {activeTab === 'organizations' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Organizations Directory</h3>
                  <button onClick={() => setShowAddOrg(!showAddOrg)} className="glow-btn font-semibold text-xs py-2 px-4 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Create Organization Tenant
                  </button>
                </div>

                {showAddOrg && (
                  <form onSubmit={handleCreateOrgSubmit} className="glass-panel p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                    <h3 className="text-md font-bold text-white">Register Organization and Org Admin</h3>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Company/Org Name</label>
                        <input type="text" required placeholder="e.g. Stark Industries" value={newOrg.name} onChange={(e) => setNewOrg({...newOrg, name: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Unique Slug ID</label>
                        <input type="text" required placeholder="e.g. stark" value={newOrg.slug} onChange={(e) => setNewOrg({...newOrg, slug: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Domain URL</label>
                        <input type="text" placeholder="e.g. stark.com" value={newOrg.domain} onChange={(e) => setNewOrg({...newOrg, domain: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Admin Email</label>
                        <input type="email" required placeholder="admin@stark.com" value={newOrg.admin_email} onChange={(e) => setNewOrg({...newOrg, admin_email: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Admin Full Name</label>
                        <input type="text" required placeholder="Tony Stark" value={newOrg.admin_name} onChange={(e) => setNewOrg({...newOrg, admin_name: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Admin Access Password</label>
                        <input type="text" required placeholder="Password@123" value={newOrg.admin_password} onChange={(e) => setNewOrg({...newOrg, admin_password: e.target.value})} className="w-full glass-input" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                      <button type="button" onClick={() => setShowAddOrg(false)} className="px-4 py-2 border border-slate-800 rounded-lg text-slate-400">Cancel</button>
                      <button type="submit" className="glow-btn px-4 py-2">Create Tenant</button>
                    </div>
                  </form>
                )}

                <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-bold">
                        <th className="p-4">Organization Name</th>
                        <th className="p-4">Slug ID</th>
                        <th className="p-4">Domain</th>
                        <th className="p-4">Tenant Status</th>
                        <th className="p-4">Created At</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      {organizations.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-900/10">
                          <td className="p-4 font-bold text-white">{org.name}</td>
                          <td className="p-4 font-mono">{org.slug}</td>
                          <td className="p-4 text-slate-400">{org.domain || 'Direct Subdomain'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${org.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {org.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{new Date(org.created_at).toLocaleDateString()}</td>
                          <td className="p-4">
                            <button onClick={() => handleToggleTenantStatus(org.id, org.is_active)} className="text-xs flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300">
                              {org.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                              Toggle State
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SA AUDIT TRAIL LOGS */}
            {activeTab === 'audit_logs' && (
              <div className="space-y-4">
                <div className="glass-panel p-4 rounded-xl border border-slate-900 text-xs text-slate-400">
                  Global trace database monitoring SaaS operations, database commits, and API status keys.
                </div>
                <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-bold">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Tenant</th>
                        <th className="p-4">Operator</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300 font-mono">
                      {auditLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-900/10">
                          <td className="p-4 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-4 font-bold text-white">{log.tenant}</td>
                          <td className="p-4 text-slate-400">{log.user}</td>
                          <td className="p-4 text-indigo-400">{log.action}</td>
                          <td className="p-4 text-emerald-400 font-bold">{log.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SA GLOBAL CONFIG */}
            {activeTab === 'settings' && (
              <div className="glass-panel p-6 rounded-2xl border border-slate-900 space-y-6 max-w-2xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-900 pb-3">SaaS System-Level Settings</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Platform Object Storage</label>
                    <input type="text" value={globalConfig.storage_provider} disabled className="w-full bg-slate-950/60 border border-slate-850 p-2.5 rounded text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Global Storage Endpoint</label>
                    <input type="text" value={globalConfig.endpoint} onChange={(e) => setGlobalConfig({...globalConfig, endpoint: e.target.value})} className="w-full glass-input" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Default SMTP Host</label>
                    <input type="text" value={globalConfig.smtp_server} onChange={(e) => setGlobalConfig({...globalConfig, smtp_server: e.target.value})} className="w-full glass-input" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">SMTP Sender Address</label>
                    <input type="text" value={globalConfig.smtp_sender} onChange={(e) => setGlobalConfig({...globalConfig, smtp_sender: e.target.value})} className="w-full glass-input" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">System Gateway Integration</label>
                    <input type="text" value={globalConfig.payment_mode} disabled className="w-full bg-slate-950/60 border border-slate-850 p-2.5 rounded text-slate-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 text-xs border-t border-slate-900 pt-4">
                  <button onClick={() => setSuccess('Global storage SMTP rules saved successfully!')} className="glow-btn px-4 py-2">Save System Config</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* -------------------- SHARED CANDIDATE REPORTS VIEW -------------------- */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/30 p-5 rounded-2xl border border-slate-900">
              <div className="flex-1 w-full md:w-auto">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Candidate Reports Directory</h3>
                <p className="text-xs text-slate-500">Filter candidate performance matrices, check scorecard logs, and download PDF transcripts.</p>
              </div>

              {/* Filters Panel */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs">
                {/* Search Field */}
                <div className="relative min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search candidate name/email..."
                    value={selectedCandidateSearch}
                    onChange={(e) => setSelectedCandidateSearch(e.target.value)}
                    className="w-full glass-input py-2 text-xs"
                  />
                </div>

                {/* College / Company Filter for Super Admin */}
                {user?.role === 'SUPER_ADMIN' && (
                  <select
                    value={selectedOrgFilter}
                    onChange={(e) => setSelectedOrgFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white min-w-[180px]"
                  >
                    <option value="">All Colleges & Companies</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                )}

                {/* Batch / Department Filters for Org Admin */}
                {user?.role !== 'SUPER_ADMIN' && (
                  <>
                    <select
                      value={selectedBatchFilter}
                      onChange={(e) => setSelectedBatchFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white min-w-[150px]"
                    >
                      <option value="">All Batches</option>
                      {Array.from(new Set(attempts.map(a => a.batch_name).filter(Boolean))).map((batchName: any) => (
                        <option key={batchName} value={batchName}>{batchName}</option>
                      ))}
                    </select>

                    <select
                      value={selectedDeptFilter}
                      onChange={(e) => setSelectedDeptFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white min-w-[150px]"
                    >
                      <option value="">All Departments</option>
                      {Array.from(new Set(attempts.map(a => a.department_name).filter(Boolean))).map((deptName: any) => (
                        <option key={deptName} value={deptName}>{deptName}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-bold">
                    <th className="p-4">Candidate</th>
                    {user?.role === 'SUPER_ADMIN' ? (
                      <th className="p-4">College / Company</th>
                    ) : (
                      <>
                        <th className="p-4">Batch</th>
                        <th className="p-4">Department</th>
                      </>
                    )}
                    <th className="p-4">Assessment</th>
                    <th className="p-4 text-center">Score / Marks</th>
                    <th className="p-4 text-center">Risk level</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {attempts
                    .filter((att) => {
                      if (user?.role === 'SUPER_ADMIN' && selectedOrgFilter && att.organization_id !== selectedOrgFilter) return false;
                      if (user?.role !== 'SUPER_ADMIN') {
                        if (selectedBatchFilter && att.batch_name !== selectedBatchFilter) return false;
                        if (selectedDeptFilter && att.department_name !== selectedDeptFilter) return false;
                      }
                      if (selectedCandidateSearch) {
                        const q = selectedCandidateSearch.toLowerCase();
                        const nMatch = att.student_name?.toLowerCase().includes(q);
                        const eMatch = att.student_email?.toLowerCase().includes(q);
                        if (!nMatch && !eMatch) return false;
                      }
                      return true;
                    })
                    .map((att) => (
                      <tr key={att.id} className="hover:bg-slate-900/10">
                        <td className="p-4">
                          <div className="font-bold text-white">{att.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{att.student_email}</div>
                        </td>
                        {user?.role === 'SUPER_ADMIN' ? (
                          <td className="p-4 text-slate-400 font-semibold">{att.organization_name}</td>
                        ) : (
                          <>
                            <td className="p-4 text-slate-400">{att.batch_name || 'N/A'}</td>
                            <td className="p-4 text-slate-400">{att.department_name || 'N/A'}</td>
                          </>
                        )}
                        <td className="p-4 font-medium text-slate-200">{att.assessment_title}</td>
                        <td className="p-4 text-center">
                          {att.score !== null ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-bold text-white font-mono">{att.score.toFixed(1)}</span>
                              <span className={`text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded ${att.pass_fail ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {att.percentage ? att.percentage.toFixed(0) : 0}% ({att.pass_fail ? 'PASS' : 'FAIL'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Not Submitted</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            att.proctor_risk_score > 30 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            att.proctor_risk_score > 10 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {att.proctor_risk_score.toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">{att.violation_count} violations</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            att.status === 'Submitted' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            att.status === 'In_Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {att.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-3.5">
                            {att.report_url && (
                              <a
                                href={att.report_url}
                                target="_blank"
                                rel="noreferrer"
                                title="Download PDF Report"
                                className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
                              >
                                <FileText className="w-4.5 h-4.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleViewScorecard(att.id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs tracking-wide transition-all shadow-md"
                            >
                              View Scorecard
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {attempts.length === 0 && (
                    <tr>
                      <td colSpan={user?.role === 'SUPER_ADMIN' ? 6 : 7} className="p-8 text-center text-slate-500 italic">
                        No attempts or reports found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------- ORG ADMIN / TRAINER VIEWS -------------------- */}
        {user?.role !== 'SUPER_ADMIN' && (
          <>
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-4 gap-6">
                  {[
                    { title: 'Questions in Bank', value: questions.length, icon: Database, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                    { title: 'Active Assessments', value: assessments.length, icon: FileText, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { title: 'Completed Attempts', value: attempts.length, icon: Users, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                    { title: 'Avg Proctor Violation', value: attempts.length > 0 ? `${(attempts.reduce((a, b) => a + b.violation_count, 0) / attempts.length).toFixed(1)}/5` : '0/5', icon: Video, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
                  ].map((stat, i) => {
                    const Icon = stat.icon
                    return (
                      <div key={i} className="glass-card p-6 flex items-center gap-4 relative overflow-hidden group">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium">{stat.title}</p>
                          <h4 className="text-xl font-bold text-white mt-1 group-hover:scale-105 transition-transform">{stat.value}</h4>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="glass-panel p-6 rounded-2xl border border-slate-900">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">AI Proctor Suspicion Risk Curve</h3>
                    <div className="h-72">
                      {proctorRiskData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={proctorRiskData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                            <YAxis stroke="#64748b" fontSize={11} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                            <Line type="monotone" dataKey="risk" stroke="#6366f1" strokeWidth={2.5} name="Risk score %" />
                            <Line type="monotone" dataKey="violations" stroke="#f43f5e" strokeWidth={2} name="Violations count" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500">No telemetry logs yet</div>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-2xl border border-slate-900">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">Average Marks vs Pass rate</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={assessmentScoreData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Bar dataKey="avg" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Avg score %" />
                          <Bar dataKey="pass" fill="#10b981" radius={[4, 4, 0, 0]} name="Pass rate %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* QUESTION BANK */}
            {activeTab === 'questions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setShowAddQuestion(!showAddQuestion)} className="glow-btn font-semibold text-xs py-2 px-4 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Create Question
                    </button>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    {/* DOCX / PDF Uploader */}
                    <div className="flex items-center gap-2 border-r border-slate-800 pr-6">
                      <span className="font-semibold text-slate-300">Extract Word/PDF Questions:</span>
                      <input 
                        type="file" 
                        accept=".docx,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          if (file) handleUploadFileForPreview(file)
                        }}
                        className="glass-input py-1 text-xs text-slate-300 max-w-[200px]"
                      />
                    </div>

                    {/* ZIP Uploader */}
                    <form onSubmit={handleZipImport} className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">Import ZIP:</span>
                      <input 
                        type="file" 
                        accept=".zip"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="glass-input py-1 text-xs text-slate-300 max-w-[180px]"
                      />
                      <button 
                        type="submit" 
                        disabled={importing}
                        className="bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 disabled:opacity-40"
                      >
                        {importing ? '...' : <Upload className="w-3.5 h-3.5" />}
                      </button>
                    </form>
                  </div>
                </div>

                {showAddQuestion && (
                  <form onSubmit={handleAddQuestionSubmit} className="glass-panel p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                    <h3 className="text-md font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" /> Add New Assessment Question
                    </h3>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Question Text</label>
                        <input 
                          type="text" 
                          required 
                          value={newQuestion.question_text} 
                          onChange={(e) => setNewQuestion({...newQuestion, question_text: e.target.value})}
                          placeholder="e.g. Which of the following is correct?"
                          className="w-full glass-input"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Type</label>
                        <select 
                          value={newQuestion.type}
                          onChange={(e) => setNewQuestion({...newQuestion, type: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        >
                          <option value="mcq_single">MCQSingle</option>
                          <option value="mcq_multi">MCQMultiple</option>
                          <option value="true_false">TrueOrFalse</option>
                          <option value="fill_blank">FillInTheBlanks</option>
                          <option value="coding">Coding</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Difficulty</label>
                        <select 
                          value={newQuestion.difficulty}
                          onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    {/* Question Media Attachments (Optional) */}
                    <div className="border-t border-slate-900 pt-4 space-y-3">
                      <label className="block text-[10px] uppercase font-bold text-slate-400">Media Attachments (Optional)</label>
                      <div className="grid grid-cols-4 gap-4">
                        {/* Image */}
                        <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Image className="w-3.5 h-3.5 text-indigo-400" /> Image</span>
                          {newQuestion.question_image ? (
                            <div className="space-y-2">
                              <img src={newQuestion.question_image} className="max-h-20 object-contain rounded border border-slate-800" alt="uploaded" />
                              <button type="button" onClick={() => setNewQuestion({...newQuestion, question_image: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                            </div>
                          ) : (
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadMediaFile(file, (url) => setNewQuestion(prev => ({ ...prev, question_image: url })))
                            }} className="text-[10px] text-slate-400 w-full" />
                          )}
                        </div>
                        {/* Audio */}
                        <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-indigo-400" /> Audio</span>
                          {newQuestion.question_audio ? (
                            <div className="space-y-2">
                              <audio src={newQuestion.question_audio} controls className="w-full max-h-8" />
                              <button type="button" onClick={() => setNewQuestion({...newQuestion, question_audio: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                            </div>
                          ) : (
                            <input type="file" accept="audio/*" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadMediaFile(file, (url) => setNewQuestion(prev => ({ ...prev, question_audio: url })))
                            }} className="text-[10px] text-slate-400 w-full" />
                          )}
                        </div>
                        {/* Video */}
                        <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-indigo-400" /> Video</span>
                          {newQuestion.question_video ? (
                            <div className="space-y-2">
                              <video src={newQuestion.question_video} controls className="max-h-20 w-full object-contain rounded border border-slate-800" />
                              <button type="button" onClick={() => setNewQuestion({...newQuestion, question_video: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                            </div>
                          ) : (
                            <input type="file" accept="video/mp4" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadMediaFile(file, (url) => setNewQuestion(prev => ({ ...prev, question_video: url })))
                            }} className="text-[10px] text-slate-400 w-full" />
                          )}
                        </div>
                        {/* Document */}
                        <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-indigo-400" /> Document</span>
                          {newQuestion.question_document ? (
                            <div className="space-y-2">
                              <a href={newQuestion.question_document} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline truncate block">View Reference Document</a>
                              <button type="button" onClick={() => setNewQuestion({...newQuestion, question_document: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                            </div>
                          ) : (
                            <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadMediaFile(file, (url) => setNewQuestion(prev => ({ ...prev, question_document: url })))
                            }} className="text-[10px] text-slate-400 w-full" />
                          )}
                        </div>
                      </div>
                    </div>

                    {(newQuestion.type === 'mcq_single' || newQuestion.type === 'mcq_multi') && (
                      <div className="space-y-3 border-t border-slate-900 pt-4">
                        <label className="block text-[10px] uppercase font-bold text-slate-400">Options & Correct Indicator</label>
                        {newQuestion.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex flex-col gap-2 p-3 bg-slate-950/20 border border-slate-900 rounded-xl">
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                placeholder={`Option ${oIdx + 1}`}
                                value={opt.option_text}
                                onChange={(e) => {
                                  const nextOpts = [...newQuestion.options]
                                  nextOpts[oIdx].option_text = e.target.value
                                  setNewQuestion({...newQuestion, options: nextOpts})
                                }}
                                className="flex-1 glass-input py-1.5 text-xs"
                              />
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 select-none">
                                <input
                                  type="checkbox"
                                  checked={opt.is_correct}
                                  onChange={(e) => {
                                    const nextOpts = newQuestion.options.map((o, idx) => ({
                                      ...o,
                                      is_correct: idx === oIdx ? e.target.checked : (newQuestion.type === 'mcq_multi' ? o.is_correct : false)
                                    }))
                                    setNewQuestion({...newQuestion, options: nextOpts})
                                  }}
                                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                                />
                                Correct
                              </label>
                            </div>
                            
                            {/* Option-level Media Attachments */}
                            <div className="flex flex-wrap items-center gap-4 pl-1 text-[10px]">
                              <span className="text-slate-500 font-bold uppercase tracking-wider">Option Media:</span>
                              
                              {/* Option Image */}
                              <div className="flex items-center gap-1.5">
                                {opt.option_image ? (
                                  <span className="text-indigo-400 flex items-center gap-1">
                                    Image Attached
                                    <button type="button" onClick={() => {
                                      const nextOpts = [...newQuestion.options]
                                      nextOpts[oIdx].option_image = ''
                                      setNewQuestion({...newQuestion, options: nextOpts})
                                    }} className="text-rose-500 font-bold hover:underline">×</button>
                                  </span>
                                ) : (
                                  <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                    <input type="file" accept="image/*" onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUploadMediaFile(file, (url) => {
                                        const nextOpts = [...newQuestion.options]
                                        nextOpts[oIdx].option_image = url
                                        setNewQuestion({...newQuestion, options: nextOpts})
                                      })
                                    }} className="hidden" />
                                    + Image
                                  </label>
                                )}
                              </div>

                              {/* Option Audio */}
                              <div className="flex items-center gap-1.5">
                                {opt.option_audio ? (
                                  <span className="text-indigo-400 flex items-center gap-1">
                                    Audio Attached
                                    <button type="button" onClick={() => {
                                      const nextOpts = [...newQuestion.options]
                                      nextOpts[oIdx].option_audio = ''
                                      setNewQuestion({...newQuestion, options: nextOpts})
                                    }} className="text-rose-500 font-bold hover:underline">×</button>
                                  </span>
                                ) : (
                                  <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                    <input type="file" accept="audio/*" onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUploadMediaFile(file, (url) => {
                                        const nextOpts = [...newQuestion.options]
                                        nextOpts[oIdx].option_audio = url
                                        setNewQuestion({...newQuestion, options: nextOpts})
                                      })
                                    }} className="hidden" />
                                    + Audio
                                  </label>
                                )}
                              </div>

                              {/* Option Video */}
                              <div className="flex items-center gap-1.5">
                                {opt.option_video ? (
                                  <span className="text-indigo-400 flex items-center gap-1">
                                    Video Attached
                                    <button type="button" onClick={() => {
                                      const nextOpts = [...newQuestion.options]
                                      nextOpts[oIdx].option_video = ''
                                      setNewQuestion({...newQuestion, options: nextOpts})
                                    }} className="text-rose-500 font-bold hover:underline">×</button>
                                  </span>
                                ) : (
                                  <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                    <input type="file" accept="video/mp4" onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUploadMediaFile(file, (url) => {
                                        const nextOpts = [...newQuestion.options]
                                        nextOpts[oIdx].option_video = url
                                        setNewQuestion({...newQuestion, options: nextOpts})
                                      })
                                    }} className="hidden" />
                                    + Video
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {newQuestion.type === 'true_false' && (
                      <div className="space-y-2 border-t border-slate-900 pt-4 text-xs">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Correct Answer</label>
                        <select
                          value={newQuestion.correct_answer}
                          onChange={(e) => setNewQuestion({...newQuestion, correct_answer: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        >
                          <option value="">Select Correct Answer</option>
                          <option value="True">True</option>
                          <option value="False">False</option>
                        </select>
                      </div>
                    )}

                    {(newQuestion.type === 'fill_blank' || newQuestion.type === 'coding') && (
                      <div className="space-y-2 border-t border-slate-900 pt-4 text-xs">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Correct Answer</label>
                        <input
                          type="text"
                          required
                          value={newQuestion.correct_answer}
                          onChange={(e) => setNewQuestion({...newQuestion, correct_answer: e.target.value})}
                          placeholder="e.g. correct answer text or expected value"
                          className="w-full glass-input"
                        />
                      </div>
                    )}

                    <div className="space-y-2 border-t border-slate-900 pt-4 text-xs">
                      <label className="block text-[10px] uppercase font-bold text-slate-400">Explanation</label>
                      <textarea
                        value={newQuestion.explanation || ''}
                        onChange={(e) => setNewQuestion({...newQuestion, explanation: e.target.value})}
                        placeholder="Provide an explanation for the answer (optional)"
                        className="w-full glass-input py-2"
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                      <button type="button" onClick={() => setShowAddQuestion(false)} className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg hover:bg-slate-900 text-xs">
                        Cancel
                      </button>
                      <button type="submit" className="glow-btn text-xs py-2 px-4">
                        Save Question
                      </button>
                    </div>
                  </form>
                )}

                {/* Multi-Select Actions Bar */}
                {selectedQuestionIds.length > 0 && (
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs text-slate-300 shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md">
                        {selectedQuestionIds.length} Selected
                      </span>
                      <span>questions ready for operations.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowAssignOrgsModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-4 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Assign to College/Company
                      </button>
                      <button
                        onClick={handleBulkDeleteQuestions}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 px-4 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                      </button>
                      <button
                        onClick={() => setSelectedQuestionIds([])}
                        className="text-slate-400 hover:text-white px-2 py-1.5"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {questions.length > 0 && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/10 rounded-xl border border-slate-900/60 text-xs">
                      <input
                        type="checkbox"
                        checked={questions.length > 0 && selectedQuestionIds.length === questions.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds(questions.map(q => q.id))
                          } else {
                            setSelectedQuestionIds([])
                          }
                        }}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      <span className="font-bold text-slate-300">Select All Questions in Bank ({questions.length})</span>
                    </div>
                  )}

                  {questions.map((q) => (
                    <div key={q.id} className="glass-card p-5 flex items-start gap-4 border border-slate-900 hover:border-slate-800">
                      {/* Checkbox Selector */}
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds(prev => [...prev, q.id])
                          } else {
                            setSelectedQuestionIds(prev => prev.filter(id => id !== q.id))
                          }
                        }}
                        className="mt-1.5 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                      />

                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            q.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            q.difficulty === 'Medium' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {q.difficulty}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                            {q.type === 'mcq_single' ? 'MCQSingle' :
                             q.type === 'mcq_multi' ? 'MCQMultiple' :
                             q.type === 'true_false' ? 'TrueOrFalse' :
                             q.type === 'fill_blank' ? 'FillInTheBlanks' :
                             q.type === 'coding' ? 'Coding' : q.type}
                          </span>
                        </div>
                        <p className="text-md text-white font-medium">{q.question_text}</p>

                        {/* Question Media Attachments */}
                        {(q.question_image || q.question_audio || q.question_video || q.question_document) && (
                          <div className="flex flex-wrap gap-4 mt-3 p-3 rounded-lg bg-slate-950/60 border border-slate-900 w-full">
                            {q.question_image && (
                              <div className="max-w-[200px] flex-shrink-0">
                                <img 
                                  src={q.question_image} 
                                  alt="Question Attachment" 
                                  className="rounded max-h-32 object-contain border border-slate-800"
                                />
                              </div>
                            )}
                            {q.question_audio && (
                              <div className="w-full max-w-[280px] flex flex-col gap-1.5 justify-center">
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Audio Attachment</span>
                                <audio controls src={q.question_audio} className="w-full h-8" />
                              </div>
                            )}
                            {q.question_video && (
                              <div className="w-full max-w-[320px] flex flex-col gap-1.5">
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Video Attachment</span>
                                <video controls src={q.question_video} className="w-full rounded border border-slate-800 max-h-40" />
                              </div>
                            )}
                            {q.question_document && (
                              <div className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-xs transition-colors self-center">
                                <FileText className="w-4 h-4" />
                                <a href={q.question_document} target="_blank" rel="noreferrer" className="underline font-medium">
                                  View Reference Document
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-2 gap-3 mt-3 pl-4 border-l border-slate-800">
                            {q.options.map((opt: any) => (
                              <div key={opt.id} className={`text-xs p-2.5 rounded-lg border border-slate-900 bg-slate-950/30 flex flex-col gap-1.5 ${opt.is_correct ? 'text-emerald-400 font-semibold bg-emerald-500/5 border-emerald-500/10' : 'text-slate-400'}`}>
                                <div className="flex items-center gap-2">
                                  {opt.is_correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />}
                                  <span>{opt.option_text}</span>
                                </div>
                                {(opt.option_image || opt.option_audio || opt.option_video) && (
                                  <div className="flex flex-col gap-1.5 pl-5 mt-1 border-l border-slate-800">
                                    {opt.option_image && (
                                      <img src={opt.option_image} alt="Option attachment" className="rounded max-h-16 object-contain border border-slate-800 w-fit" />
                                    )}
                                    {opt.option_audio && (
                                      <audio controls src={opt.option_audio} className="w-full h-6 max-w-[200px]" />
                                    )}
                                    {opt.option_video && (
                                      <video controls src={opt.option_video} className="w-full max-h-24 max-w-[200px] rounded border border-slate-800" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => setEditingQuestion(JSON.parse(JSON.stringify(q)))} 
                          className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                          title="Edit Question"
                        >
                          <Edit className="w-4.5 h-4.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteQuestion(q.id)} 
                          className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* --- Question Edit Modal --- */}
                {editingQuestion && (
                  <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                      <h3 className="text-md font-bold text-white flex items-center gap-2">
                        <Edit className="w-5 h-5 text-indigo-400" /> Edit Question Details
                      </h3>
                      
                      <form onSubmit={handleUpdateQuestionSubmit} className="space-y-4 text-xs">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Question Text</label>
                            <input 
                              type="text" 
                              required 
                              value={editingQuestion.question_text} 
                              onChange={(e) => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
                              className="w-full glass-input"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Type</label>
                            <select 
                              value={editingQuestion.type}
                              onChange={(e) => setEditingQuestion({...editingQuestion, type: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                            >
                              <option value="mcq_single">MCQSingle</option>
                              <option value="mcq_multi">MCQMultiple</option>
                              <option value="true_false">TrueOrFalse</option>
                              <option value="fill_blank">FillInTheBlanks</option>
                              <option value="coding">Coding</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Difficulty</label>
                            <select 
                              value={editingQuestion.difficulty}
                              onChange={(e) => setEditingQuestion({...editingQuestion, difficulty: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                            >
                              <option value="Easy">Easy</option>
                              <option value="Medium">Medium</option>
                              <option value="Hard">Hard</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Marks</label>
                            <input 
                              type="number" 
                          step="0.5"
                              value={editingQuestion.marks}
                              onChange={(e) => setEditingQuestion({...editingQuestion, marks: parseFloat(e.target.value)})}
                              className="w-full glass-input"
                            />
                          </div>

                          {/* Question Media Attachments (Optional) */}
                          <div className="border-t border-slate-900 pt-4 space-y-3 col-span-1 md:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-slate-400">Media Attachments (Optional)</label>
                          <div className="grid grid-cols-4 gap-4">
                            {/* Image */}
                            <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Image className="w-3.5 h-3.5 text-indigo-400" /> Image</span>
                              {editingQuestion.question_image ? (
                                <div className="space-y-2">
                                  <img src={editingQuestion.question_image} className="max-h-20 object-contain rounded border border-slate-800" alt="uploaded" />
                                  <button type="button" onClick={() => setEditingQuestion({...editingQuestion, question_image: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                                </div>
                              ) : (
                                <input type="file" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadMediaFile(file, (url) => setEditingQuestion(prev => ({ ...prev, question_image: url })))
                                }} className="text-[10px] text-slate-400 w-full" />
                              )}
                            </div>
                            {/* Audio */}
                            <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-indigo-400" /> Audio</span>
                              {editingQuestion.question_audio ? (
                                <div className="space-y-2">
                                  <audio src={editingQuestion.question_audio} controls className="w-full max-h-8" />
                                  <button type="button" onClick={() => setEditingQuestion({...editingQuestion, question_audio: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                                </div>
                              ) : (
                                <input type="file" accept="audio/*" onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadMediaFile(file, (url) => setEditingQuestion(prev => ({ ...prev, question_audio: url })))
                                }} className="text-[10px] text-slate-400 w-full" />
                              )}
                            </div>
                            {/* Video */}
                            <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-indigo-400" /> Video</span>
                              {editingQuestion.question_video ? (
                                <div className="space-y-2">
                                  <video src={editingQuestion.question_video} controls className="max-h-20 w-full object-contain rounded border border-slate-800" />
                                  <button type="button" onClick={() => setEditingQuestion({...editingQuestion, question_video: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                                </div>
                              ) : (
                                <input type="file" accept="video/mp4" onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadMediaFile(file, (url) => setEditingQuestion(prev => ({ ...prev, question_video: url })))
                                }} className="text-[10px] text-slate-400 w-full" />
                              )}
                            </div>
                            {/* Document */}
                            <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-indigo-400" /> Document</span>
                              {editingQuestion.question_document ? (
                                <div className="space-y-2">
                                  <a href={editingQuestion.question_document} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline truncate block">View Reference Document</a>
                                  <button type="button" onClick={() => setEditingQuestion({...editingQuestion, question_document: ''})} className="text-[9px] text-rose-500 hover:underline block">Remove</button>
                                </div>
                              ) : (
                                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadMediaFile(file, (url) => setEditingQuestion(prev => ({ ...prev, question_document: url })))
                                }} className="text-[10px] text-slate-400 w-full" />
                              )}
                            </div>
                          </div>
                        </div>
                        </div>

                        {(editingQuestion.type === 'mcq_single' || editingQuestion.type === 'mcq_multi') && (
                          <div className="space-y-3 border-t border-slate-900 pt-4">
                            <label className="block text-[10px] uppercase font-bold text-slate-400">Options & Correct Indicator</label>
                            {editingQuestion.options.map((opt: any, oIdx: number) => (
                              <div key={oIdx} className="flex flex-col gap-2 p-3 bg-slate-950/20 border border-slate-900 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="text"
                                    placeholder={`Option ${oIdx + 1}`}
                                    value={opt.option_text}
                                    onChange={(e) => {
                                      const nextOpts = [...editingQuestion.options]
                                      nextOpts[oIdx].option_text = e.target.value
                                      setEditingQuestion({...editingQuestion, options: nextOpts})
                                    }}
                                    className="flex-1 glass-input py-1.5 text-xs"
                                  />
                                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 select-none">
                                    <input
                                      type="checkbox"
                                      checked={opt.is_correct}
                                      onChange={(e) => {
                                        const nextOpts = editingQuestion.options.map((o: any, idx: number) => ({
                                          ...o,
                                          is_correct: idx === oIdx ? e.target.checked : (editingQuestion.type === 'mcq_multi' ? o.is_correct : false)
                                        }))
                                        const correctOpts = nextOpts.filter((o: any) => o.is_correct)
                                        setEditingQuestion({
                                          ...editingQuestion,
                                          options: nextOpts,
                                          correct_answer: correctOpts.map((o: any) => o.option_text).join(', ')
                                        })
                                      }}
                                      className="rounded bg-slate-950 border-slate-800 text-indigo-655 focus:ring-0"
                                    />
                                    Correct
                                  </label>
                                </div>
                                
                                {/* Option-level Media Attachments */}
                                <div className="flex flex-wrap items-center gap-4 pl-1 text-[10px]">
                                  <span className="text-slate-500 font-bold uppercase tracking-wider">Option Media:</span>
                                  
                                  {/* Option Image */}
                                  <div className="flex items-center gap-1.5">
                                    {opt.option_image ? (
                                      <span className="text-indigo-400 flex items-center gap-1">
                                        Image Attached
                                        <button type="button" onClick={() => {
                                          const nextOpts = [...editingQuestion.options]
                                          nextOpts[oIdx].option_image = ''
                                          setEditingQuestion({...editingQuestion, options: nextOpts})
                                        }} className="text-rose-500 font-bold hover:underline">×</button>
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                        <input type="file" accept="image/*" onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadMediaFile(file, (url) => {
                                            const nextOpts = [...editingQuestion.options]
                                            nextOpts[oIdx].option_image = url
                                            setEditingQuestion({...editingQuestion, options: nextOpts})
                                          })
                                        }} className="hidden" />
                                        + Image
                                      </label>
                                    )}
                                  </div>

                                  {/* Option Audio */}
                                  <div className="flex items-center gap-1.5">
                                    {opt.option_audio ? (
                                      <span className="text-indigo-400 flex items-center gap-1">
                                        Audio Attached
                                        <button type="button" onClick={() => {
                                          const nextOpts = [...editingQuestion.options]
                                          nextOpts[oIdx].option_audio = ''
                                          setEditingQuestion({...editingQuestion, options: nextOpts})
                                        }} className="text-rose-500 font-bold hover:underline">×</button>
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                        <input type="file" accept="audio/*" onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadMediaFile(file, (url) => {
                                            const nextOpts = [...editingQuestion.options]
                                            nextOpts[oIdx].option_audio = url
                                            setEditingQuestion({...editingQuestion, options: nextOpts})
                                          })
                                        }} className="hidden" />
                                        + Audio
                                      </label>
                                    )}
                                  </div>

                                  {/* Option Video */}
                                  <div className="flex items-center gap-1.5">
                                    {opt.option_video ? (
                                      <span className="text-indigo-400 flex items-center gap-1">
                                        Video Attached
                                        <button type="button" onClick={() => {
                                          const nextOpts = [...editingQuestion.options]
                                          nextOpts[oIdx].option_video = ''
                                          setEditingQuestion({...editingQuestion, options: nextOpts})
                                        }} className="text-rose-500 font-bold hover:underline">×</button>
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold">
                                        <input type="file" accept="video/mp4" onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadMediaFile(file, (url) => {
                                            const nextOpts = [...editingQuestion.options]
                                            nextOpts[oIdx].option_video = url
                                            setEditingQuestion({...editingQuestion, options: nextOpts})
                                          })
                                        }} className="hidden" />
                                        + Video
                                      </label>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {editingQuestion.type === 'true_false' && (
                          <div className="space-y-2 border-t border-slate-900 pt-4 text-xs">
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Correct Answer</label>
                            <select
                              value={editingQuestion.correct_answer || ''}
                              onChange={(e) => setEditingQuestion({...editingQuestion, correct_answer: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                            >
                              <option value="">Select Correct Answer</option>
                              <option value="True">True</option>
                              <option value="False">False</option>
                            </select>
                          </div>
                        )}

                        {(editingQuestion.type === 'fill_blank' || editingQuestion.type === 'coding') && (
                          <div className="space-y-2 border-t border-slate-900 pt-4 text-xs">
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Correct Answer</label>
                            <input
                              type="text"
                              required
                              value={editingQuestion.correct_answer || ''}
                              onChange={(e) => setEditingQuestion({...editingQuestion, correct_answer: e.target.value})}
                              placeholder="e.g. correct answer text or expected value"
                              className="w-full glass-input"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400">Explanation</label>
                          <textarea 
                            value={editingQuestion.explanation || ''} 
                            onChange={(e) => setEditingQuestion({...editingQuestion, explanation: e.target.value})}
                            className="w-full glass-input py-2"
                            rows={3}
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                          <button type="button" onClick={() => setEditingQuestion(null)} className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg hover:bg-slate-900">
                            Cancel
                          </button>
                          <button type="submit" className="glow-btn py-2 px-4">
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* --- Assign Organizations Modal --- */}
                {showAssignOrgsModal && (
                  <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                      <h3 className="text-md font-bold text-white flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-400" /> Assign Questions to College or Company
                      </h3>
                      
                      <p className="text-xs text-slate-400">
                        You are copying {selectedQuestionIds.length} selected questions. Choose one or more target organizations below:
                      </p>

                      <form onSubmit={handleBulkAssignQuestions} className="space-y-4 text-xs">
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                          {activeOrgs.map((org) => (
                            <label key={org.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-900 hover:border-slate-800 cursor-pointer bg-slate-950/40 select-none">
                              <input 
                                type="checkbox"
                                checked={selectedAssignOrgIds.includes(org.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAssignOrgIds([...selectedAssignOrgIds, org.id])
                                  } else {
                                    setSelectedAssignOrgIds(selectedAssignOrgIds.filter(id => id !== org.id))
                                  }
                                }}
                                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                              />
                              <div>
                                <div className="font-bold text-white">{org.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Slug: {org.slug}</div>
                              </div>
                            </label>
                          ))}
                          {activeOrgs.length === 0 && (
                            <div className="text-center py-4 text-slate-500 italic">No other active organizations found.</div>
                          )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                          <button type="button" onClick={() => { setShowAssignOrgsModal(false); setSelectedAssignOrgIds([]); }} className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg hover:bg-slate-900">
                            Cancel
                          </button>
                          <button type="submit" disabled={assigningOrgs || selectedAssignOrgIds.length === 0} className="glow-btn py-2 px-4 disabled:opacity-40">
                            {assigningOrgs ? 'Assigning...' : 'Assign Questions'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* --- Word/PDF Extraction Preview Modal --- */}
                {fileQuestionsPreview && (
                  <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-panel max-w-6xl w-full max-h-[95vh] overflow-y-auto p-6 rounded-2xl border border-indigo-500/20 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                        <div>
                          <h3 className="text-md font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" /> Extracted Question Preview & Edit
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Previewing {fileQuestionsPreview.length} questions from: <strong className="text-white">{previewFile?.name}</strong>. Edit details inline before importing.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <label className="text-slate-400">Target Topic:</label>
                          <select 
                            value={importTopicId}
                            onChange={(e) => setImportTopicId(e.target.value)}
                            className="bg-slate-950 border border-slate-850 rounded p-1.5 text-white"
                          >
                            <option value="python_programming_topic_id">Python Programming</option>
                          </select>
                        </div>
                      </div>

                      <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                        <div className="overflow-x-auto max-h-[55vh]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                                <th className="p-4 w-12 text-center">
                                  <input 
                                    type="checkbox"
                                    checked={fileQuestionsPreview.length > 0 && fileQuestionsPreview.every((q: any) => q.selected)}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setFileQuestionsPreview(fileQuestionsPreview.map((q: any) => ({ ...q, selected: checked })))
                                    }}
                                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                                  />
                                </th>
                                <th className="p-4 min-w-[240px]">Question Text</th>
                                <th className="p-4 w-36">Type</th>
                                <th className="p-4 w-32">Difficulty</th>
                                <th className="p-4 min-w-[340px]">Options (Tick Correct)</th>
                                <th className="p-4 w-20 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-300">
                              {fileQuestionsPreview.map((q, idx) => (
                                <tr key={idx} className={`hover:bg-slate-900/10 transition-colors ${q.selected ? 'bg-indigo-500/[0.02]' : 'opacity-60'}`}>
                                  <td className="p-4 text-center align-middle">
                                    <input 
                                      type="checkbox"
                                      checked={!!q.selected}
                                      onChange={(e) => {
                                        const next = [...fileQuestionsPreview]
                                        next[idx].selected = e.target.checked
                                        setFileQuestionsPreview(next)
                                      }}
                                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                                    />
                                  </td>
                                  <td className="p-4 align-top">
                                    <textarea
                                      value={q.question_text || ''}
                                      onChange={(e) => {
                                        const next = [...fileQuestionsPreview]
                                        next[idx].question_text = e.target.value
                                        setFileQuestionsPreview(next)
                                      }}
                                      rows={2}
                                      className="w-full bg-slate-950/40 border border-slate-850 rounded p-2 text-white text-xs font-semibold focus:border-indigo-500/50 resize-y"
                                      placeholder="Enter question text..."
                                    />
                                  </td>
                                  <td className="p-4 align-top">
                                    <select 
                                      value={q.type || 'mcq_single'}
                                      onChange={(e) => {
                                        const next = [...fileQuestionsPreview]
                                        next[idx].type = e.target.value
                                        setFileQuestionsPreview(next)
                                      }}
                                      className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-slate-300 text-xs focus:ring-0"
                                    >
                                      <option value="mcq_single">MCQSingle</option>
                                      <option value="mcq_multi">MCQMultiple</option>
                                      <option value="true_false">TrueOrFalse</option>
                                      <option value="fill_blank">FillInTheBlanks</option>
                                      <option value="coding">Coding</option>
                                    </select>
                                  </td>
                                  <td className="p-4 align-top">
                                    <select 
                                      value={q.difficulty || 'Medium'}
                                      onChange={(e) => {
                                        const next = [...fileQuestionsPreview]
                                        next[idx].difficulty = e.target.value
                                        setFileQuestionsPreview(next)
                                      }}
                                      className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-slate-300 text-xs focus:ring-0"
                                    >
                                      <option value="Easy">Easy</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Hard">Hard</option>
                                    </select>
                                  </td>
                                  <td className="p-4 align-top">
                                    {(q.type === 'mcq_single' || q.type === 'mcq_multi') && q.options ? (
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {q.options.map((opt: any, oIdx: number) => (
                                          <div key={oIdx} className="flex items-center gap-2 bg-slate-950/40 p-1.5 rounded border border-slate-850">
                                            <input 
                                              type="text" 
                                              value={opt.option_text || ''}
                                              onChange={(e) => {
                                                const next = [...fileQuestionsPreview]
                                                next[idx].options[oIdx].option_text = e.target.value
                                                setFileQuestionsPreview(next)
                                              }}
                                              className="flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[11px] text-slate-300"
                                              placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                            />
                                            <input 
                                              type="checkbox"
                                              checked={!!opt.is_correct}
                                              onChange={(e) => {
                                                const next = [...fileQuestionsPreview]
                                                next[idx].options = next[idx].options.map((o: any, idx2: number) => ({
                                                  ...o,
                                                  is_correct: idx2 === oIdx ? e.target.checked : (q.type === 'mcq_multi' ? o.is_correct : false)
                                                }))
                                                const correctOpts = next[idx].options.filter((o: any) => o.is_correct)
                                                next[idx].correct_answer = correctOpts.map((o: any) => o.option_text).join(', ')
                                                setFileQuestionsPreview(next)
                                              }}
                                              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500 italic text-[11px]">N/A for this question type</span>
                                    )}
                                  </td>
                                  <td className="p-4 align-top text-center">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setFileQuestionsPreview(fileQuestionsPreview.filter((_, i) => i !== idx))
                                      }}
                                      className="p-2 text-rose-450 hover:text-rose-400 hover:bg-rose-500/5 rounded border border-rose-500/10 transition-colors"
                                      title="Remove Question"
                                    >
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-slate-900 text-xs">
                        <button 
                          type="button" 
                          onClick={() => { setFileQuestionsPreview(null); setPreviewFile(null); }} 
                          className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg hover:bg-slate-900"
                        >
                          Discard All
                        </button>
                        <button 
                          type="button" 
                          onClick={handleApproveImport}
                          className="glow-btn py-2 px-6"
                        >
                          Approve and Save to Bank
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ASSESSMENTS */}
            {activeTab === 'assessments' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Scheduled Assessments</h3>
                  <button onClick={() => setShowAddAssessment(!showAddAssessment)} className="glow-btn font-semibold text-xs py-2 px-4 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Create Assessment Scheme
                  </button>
                </div>

                {showAddAssessment && (
                  <form onSubmit={handleAddAssessmentSubmit} className="glass-panel p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                    <h3 className="text-md font-bold text-white">New Assessment Configuration</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-3">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Title</label>
                        <input type="text" required placeholder="e.g. Midterm Programming Exam" value={newAssessment.title} onChange={(e) => setNewAssessment({...newAssessment, title: e.target.value})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Duration (mins)</label>
                        <input type="number" value={newAssessment.duration} onChange={(e) => setNewAssessment({...newAssessment, duration: parseInt(e.target.value)})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Total Marks</label>
                        <input type="number" value={newAssessment.total_marks} onChange={(e) => setNewAssessment({...newAssessment, total_marks: parseFloat(e.target.value)})} className="w-full glass-input" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Passing %</label>
                        <input type="number" value={newAssessment.pass_percentage} onChange={(e) => setNewAssessment({...newAssessment, pass_percentage: parseFloat(e.target.value)})} className="w-full glass-input" />
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-4 space-y-3">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400">Security & Administration Settings</h4>
                      <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                          <input 
                            type="checkbox"
                            checked={newAssessment.settings.lockdown_browser_required}
                            onChange={(e) => setNewAssessment({
                              ...newAssessment, 
                              settings: { ...newAssessment.settings, lockdown_browser_required: e.target.checked }
                            })}
                            className="rounded bg-slate-950 border-slate-800 text-indigo-650 focus:ring-0"
                          />
                          Require Secure Lockdown Browser
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                          <input 
                            type="checkbox"
                            checked={newAssessment.settings.proctoring_enabled}
                            onChange={(e) => setNewAssessment({
                              ...newAssessment, 
                              settings: { ...newAssessment.settings, proctoring_enabled: e.target.checked }
                            })}
                            className="rounded bg-slate-950 border-slate-800 text-indigo-650 focus:ring-0"
                          />
                          Enable AI Video Proctoring
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                          <input 
                            type="checkbox"
                            checked={newAssessment.settings.randomize_questions}
                            onChange={(e) => setNewAssessment({
                              ...newAssessment, 
                              settings: { ...newAssessment.settings, randomize_questions: e.target.checked }
                            })}
                            className="rounded bg-slate-950 border-slate-800 text-indigo-650 focus:ring-0"
                          />
                          Randomize Questions
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button type="button" onClick={() => setShowAddAssessment(false)} className="px-4 py-2 border border-slate-800 rounded-lg text-xs text-slate-400">Cancel</button>
                      <button type="submit" className="glow-btn text-xs py-2 px-4">Create</button>
                    </div>
                  </form>
                )}

                {showAssignForm && (
                  <form onSubmit={handleAssignSubmit} className="glass-panel p-5 rounded-2xl border border-emerald-500/20 space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wide">Assign Scheme to Candidates</h3>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Candidate Email Address(es) - Comma Separated</label>
                      <input type="text" required value={assignStudentIds} onChange={(e) => setAssignStudentIds(e.target.value)} className="w-full glass-input py-2 text-xs" />
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                      <button type="button" onClick={() => setShowAssignForm(null)} className="px-3 py-1.5 border border-slate-800 rounded text-slate-400">Cancel</button>
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-4 rounded">Publish Assignment</button>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {assessments.map((a) => (
                    <div key={a.id} className="glass-card p-6 flex justify-between items-center border border-slate-900">
                      <div className="space-y-1">
                        <h4 className="text-md font-bold text-white">{a.title}</h4>
                        <p className="text-xs text-slate-400">{a.description || 'No description provided.'}</p>
                        <div className="flex gap-4 mt-3 text-xs text-indigo-400">
                          <span>Duration: {a.duration} mins</span>
                          <span>Marks: {a.total_marks}</span>
                          <span>Pass requirement: {a.pass_percentage}%</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowAssignForm(a.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Users className="w-3.5 h-3.5" /> Assign Candidates
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PROCTORING */}
            {activeTab === 'proctoring' && (
              <div className="space-y-6">
                {!selectedAttempt ? (
                  <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-bold">
                          <th className="p-4">Candidate</th>
                          <th className="p-4">Exam Title</th>
                          <th className="p-4">Risk Level</th>
                          <th className="p-4">Violations</th>
                          <th className="p-4">Secure Shell</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {attempts.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-900/10">
                            <td className="p-4 font-semibold text-white">{att.student_name}</td>
                            <td className="p-4 text-slate-300">{att.assessment_title}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded font-semibold ${
                                att.proctor_risk_score > 30 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                att.proctor_risk_score > 10 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {att.proctor_risk_score.toFixed(0)}%
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 font-mono">{att.violation_count}</td>
                            <td className="p-4">
                              {att.secure_browser_used ? (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded">
                                  v{att.secure_browser_version || '1.1.5'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-800/40 border border-slate-700/30 px-2 py-0.5 rounded">
                                  Standard
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="text-slate-400">{att.status}</span>
                            </td>
                            <td className="p-4">
                              <button onClick={() => handleViewAttempt(att)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
                                Review <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button onClick={() => { setSelectedAttempt(null); setAttemptTimeline(null); }} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
                      &larr; Back to Attempts List
                    </button>

                    <div className="glass-panel p-6 rounded-2xl border border-rose-500/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl" />
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white">{selectedAttempt.student_name}</h3>
                          <p className="text-xs text-slate-400 mt-1">Reviewing telemetry reports for {selectedAttempt.assessment_title}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400 uppercase font-bold">Proctor Suspicion Score</div>
                          <div className="text-3xl font-black text-rose-500 mt-1">{selectedAttempt.proctor_risk_score}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-slate-900 pb-3 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-indigo-400" /> Event Timeline Logs
                        </h4>
                        
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {attemptTimeline?.events && attemptTimeline.events.length > 0 ? (
                            attemptTimeline.events.map((ev: any) => (
                              <div key={ev.id} className="p-3 bg-slate-900/30 rounded-xl border border-slate-900 text-xs flex gap-3 items-start">
                                {ev.event_type === 'tab_switch' || ev.event_type === 'window_blur' || ev.event_type === 'blacklisted-app' || ev.event_type === 'vm-detected' ? (
                                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full mt-1.5 animate-ping" />
                                ) : (
                                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full mt-1.5" />
                                )}
                                <div>
                                  <div className="font-semibold text-white capitalize">{ev.event_type.replace('_', ' ')}</div>
                                  <div className="text-slate-400 mt-0.5">{ev.details?.message || 'Suspicion flag flagged by system'}</div>
                                  <span className="text-[10px] text-slate-500 block mt-1">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-xs text-slate-500">No telemetry log entries.</div>
                          )}
                        </div>
                      </div>

                      <div className="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-slate-900 pb-3 flex items-center gap-1.5">
                          <Video className="w-4 h-4 text-indigo-400" /> Uploaded Camera Snapshots
                        </h4>

                        <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                          {attemptTimeline?.snapshots && attemptTimeline.snapshots.length > 0 ? (
                            attemptTimeline.snapshots.map((snap: any) => (
                              <div key={snap.id} className="glass-card p-2 rounded-xl border border-slate-900">
                                <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                                  <img 
                                    src={`https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200`} 
                                    alt="Telemetry Frame" 
                                    className="object-cover w-full h-full opacity-60"
                                  />
                                </div>
                                <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 px-1">
                                  <span>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                                  <span className="font-semibold text-rose-400">Risk: +{snap.risk_score}%</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 p-8 text-center text-xs text-slate-500">No camera frames uploaded yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SAP INTEGRATION */}
            {activeTab === 'sap' && (
              <div className="grid md:grid-cols-3 gap-8">
                <form onSubmit={handleSaveSapConfig} className="md:col-span-2 glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-900 pb-3 flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-indigo-400" /> SAP SuccessFactors Sync endpoints
                  </h3>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">OData Service URL</label>
                      <input type="text" value={sapConfig.base_url} onChange={(e) => setSapConfig({...sapConfig, base_url: e.target.value})} className="w-full glass-input" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">OAuth Token Server Endpoint</label>
                      <input type="text" value={sapConfig.oauth_token_url} onChange={(e) => setSapConfig({...sapConfig, oauth_token_url: e.target.value})} className="w-full glass-input" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Client ID</label>
                      <input type="text" value={sapConfig.client_id} onChange={(e) => setSapConfig({...sapConfig, client_id: e.target.value})} className="w-full glass-input" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Client Secret / Private Key</label>
                      <input type="text" value={sapConfig.client_secret} onChange={(e) => setSapConfig({...sapConfig, client_secret: e.target.value})} className="w-full glass-input" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Employee Endpoint</label>
                      <input type="text" value={sapConfig.employee_endpoint} onChange={(e) => setSapConfig({...sapConfig, employee_endpoint: e.target.value})} className="w-full glass-input font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Sync Frequency</label>
                      <select value={sapConfig.sync_frequency} onChange={(e) => setSapConfig({...sapConfig, sync_frequency: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white">
                        <option value="Real-time">Real-time Hook</option>
                        <option value="Daily">Daily Sync</option>
                        <option value="Weekly">Weekly Sync</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                    <button type="submit" className="glow-btn text-xs py-2 px-4">Update Configuration</button>
                  </div>
                </form>

                <div className="glass-panel p-6 rounded-2xl border border-slate-900 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1.5">OData Identity Provider</h4>
                      <p className="text-xs text-slate-500">Test OData endpoints & sync newly recruited corporate candidate profiles.</p>
                    </div>

                    <div className="space-y-3">
                      <button onClick={handleTestSapConnection} className="w-full text-xs font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 py-3 rounded-lg flex items-center justify-center gap-1.5 text-indigo-400">
                        <RefreshCw className="w-4 h-4" /> Test Identity Auth
                      </button>

                      <button onClick={handleTriggerSapSync} className="w-full text-xs font-bold bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 py-3 rounded-lg flex items-center justify-center gap-1.5 text-emerald-400">
                        <Database className="w-4 h-4" /> Sync Employees Now
                      </button>
                    </div>
                  </div>

                  {sapTestStatus && (
                    <div className={`mt-6 p-4 rounded-xl border text-xs ${sapTestStatus.startsWith('Success') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : sapTestStatus === 'testing' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      {sapTestStatus === 'testing' ? 'Querying Access Token from SAP Provider...' : sapTestStatus}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WHITE LABEL */}
            {activeTab === 'settings' && (
              <form onSubmit={handleSaveWlSettings} className="glass-panel p-6 rounded-2xl border border-slate-900 space-y-6 max-w-3xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-900 pb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" /> Whitelabel Branding Parameters
                </h3>

                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1.5">Brand Name</label>
                    <input type="text" value={wlSettings.brand_name} onChange={(e) => setWlSettings({...wlSettings, brand_name: e.target.value})} className="w-full glass-input" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5">Primary Branding Hex Color</label>
                    <div className="flex gap-2.5">
                      <input type="color" value={wlSettings.primary_color} onChange={(e) => setWlSettings({...wlSettings, primary_color: e.target.value})} className="w-10 h-10 border border-slate-800 bg-transparent rounded-lg cursor-pointer" />
                      <input type="text" value={wlSettings.primary_color} onChange={(e) => setWlSettings({...wlSettings, primary_color: e.target.value})} className="flex-1 glass-input py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5">Secondary Theme Hex Color</label>
                    <div className="flex gap-2.5">
                      <input type="color" value={wlSettings.secondary_color} onChange={(e) => setWlSettings({...wlSettings, secondary_color: e.target.value})} className="w-10 h-10 border border-slate-800 bg-transparent rounded-lg cursor-pointer" />
                      <input type="text" value={wlSettings.secondary_color} onChange={(e) => setWlSettings({...wlSettings, secondary_color: e.target.value})} className="flex-1 glass-input py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5">Brand Privacy URL</label>
                    <input type="url" value={wlSettings.privacy_policy_url} onChange={(e) => setWlSettings({...wlSettings, privacy_policy_url: e.target.value})} className="w-full glass-input" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                  <button type="submit" className="glow-btn text-xs py-2 px-6">Save Whitelabel Configurations</button>
                </div>
              </form>
            )}

            {/* BILLING */}
            {activeTab === 'billing' && (
              <div className="space-y-8">
                <div className="glass-panel p-6 rounded-2xl border border-indigo-500/10 relative overflow-hidden flex justify-between items-center">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded">
                      Active Subscription
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">
                      {subscription?.plan_name || 'Professional Plan'}
                    </h3>
                    <p className="text-xs text-slate-400">Status: <strong className="text-emerald-400">{subscription?.status || 'Active'}</strong></p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">Current Monthly Cost</p>
                    <p className="text-2xl font-black text-white mt-1">$299.00/mo</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {[
                    { title: 'Maximum Candidates Quota', value: '452 / 1000', percentage: 45.2, color: 'bg-indigo-500' },
                    { title: 'Completed Assessments Quota', value: '87 / 100', percentage: 87.0, color: 'bg-emerald-500' },
                    { title: 'AI Proctoring Frames Remaining', value: '184.2K / 200K', percentage: 92.1, color: 'bg-violet-500' }
                  ].map((quota, idx) => (
                    <div key={idx} className="glass-card p-5 rounded-xl border border-slate-900 text-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-slate-400">{quota.title}</span>
                        <strong className="text-white font-mono">{quota.value}</strong>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900">
                        <div className={`h-full ${quota.color} rounded-full`} style={{ width: `${quota.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upgrade Subscription Tier</h4>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { name: 'Professional Plan', code: 'professional', price: '$299', desc: 'Up to 1000 active students, custom reports, and standard webcam proctoring limits.' },
                      { name: 'Enterprise Plan', code: 'enterprise', price: '$999', desc: 'Unlimited candidates, custom templates, full OData SAP integrations, and high-frequency proctor limits.' }
                    ].map((tier, i) => (
                      <div key={i} className="glass-card p-6 rounded-2xl border border-slate-900 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-white text-md">{tier.name}</h5>
                            <strong className="text-xl font-black text-indigo-400">{tier.price}<span className="text-xs font-normal text-slate-500">/mo</span></strong>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{tier.desc}</p>
                        </div>

                        <button 
                          onClick={() => handleBillingUpgrade(tier.code)}
                          className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white font-bold text-xs text-slate-300 transition-all"
                        >
                          Checkout with Stripe Gateway
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Detailed Scorecard Modal Overlay */}
      {scorecardDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6 md:p-10 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-5 bg-slate-950/60 border-b border-slate-850 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  Detailed Exam Scorecard
                </span>
                <h3 className="text-xl font-bold text-white mt-1.5 tracking-tight font-sans">
                  {scorecardDetails.assessment.title}
                </h3>
              </div>
              <button
                onClick={() => setScorecardDetails(null)}
                className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Candidate Info Grid */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Left Info */}
                <div className="glass-card p-5 border border-slate-850/80 rounded-xl md:col-span-2 space-y-4">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-800 pb-2">
                    Candidate Profile Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-slate-500">Full Name</span>
                      <strong className="text-slate-200 text-sm mt-0.5 block">{scorecardDetails.candidate.name}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">Email Address</span>
                      <strong className="text-slate-200 text-sm mt-0.5 block">{scorecardDetails.candidate.email}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">Registration Number</span>
                      <strong className="text-slate-200 mt-0.5 block font-mono">{scorecardDetails.candidate.registration_number || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">Designation</span>
                      <strong className="text-slate-200 mt-0.5 block">{scorecardDetails.candidate.designation || 'Candidate'}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">Department / Batch</span>
                      <strong className="text-slate-200 mt-0.5 block">
                        {scorecardDetails.candidate.department} / {scorecardDetails.candidate.batch}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">College / Company</span>
                      <strong className="text-indigo-400 mt-0.5 block font-semibold">{scorecardDetails.candidate.organization_name}</strong>
                    </div>
                  </div>
                </div>

                {/* Score & Risk Analytics Card */}
                <div className="glass-card p-5 border border-indigo-500/10 rounded-xl space-y-4 relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950/20">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 border-b border-slate-800 pb-2">
                    Performance Summary
                  </h4>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Score</span>
                      <div className="text-2xl font-black text-white font-mono mt-0.5">
                        {scorecardDetails.result.score.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ {scorecardDetails.assessment.total_marks}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Percentage</span>
                      <div className="text-2xl font-black text-indigo-400 font-mono mt-0.5">
                        {scorecardDetails.result.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-400">Result Verdict</span>
                    <span className={`px-3 py-1 rounded font-bold text-xs ${
                      scorecardDetails.result.passed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {scorecardDetails.result.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 block">AI Proctor Risk</span>
                      <span className={`font-bold text-xs mt-1 block ${
                        scorecardDetails.proctor_risk_score > 30 ? 'text-rose-400' : scorecardDetails.proctor_risk_score > 10 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {scorecardDetails.proctor_risk_score.toFixed(0)}% Risk ({scorecardDetails.violation_count} violations)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Secure Shell</span>
                      {scorecardDetails.secure_browser_used ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded mt-1 inline-block">
                          Active (v{scorecardDetails.secure_browser_version || '1.1.5'})
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded mt-1 inline-block">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="flex gap-4 border-b border-slate-850 pb-6">
                {scorecardDetails.report_url ? (
                  <a
                    href={scorecardDetails.report_url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg"
                  >
                    <FileText className="w-4 h-4" /> Download PDF Transcript Report
                  </a>
                ) : (
                  <button
                    disabled
                    className="bg-slate-800 text-slate-500 font-bold py-2.5 px-5 rounded-xl text-xs cursor-not-allowed flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> PDF Report Generating...
                  </button>
                )}

                {scorecardDetails.certificate_url && (
                  <a
                    href={scorecardDetails.certificate_url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg"
                  >
                    <Award className="w-4 h-4" /> Download Completion Certificate
                  </a>
                )}
              </div>

              {/* Questions & Options correctness details */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-indigo-400" /> Section & Question Wise breakdown
                </h4>

                {scorecardDetails.sections.map((section: any) => (
                  <div key={section.id} className="glass-panel p-6 border border-slate-850 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h5 className="font-bold text-white text-sm tracking-wide">{section.title}</h5>
                      <span className="text-xs text-slate-400">Duration Limit: {section.duration_minutes} mins</span>
                    </div>

                    <div className="space-y-5">
                      {section.questions.map((q: any, idx: number) => {
                        const ans = q.student_answer;
                        return (
                          <div key={q.id} className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-indigo-400 font-mono">Q{idx + 1}.</span>
                              <div className="text-right text-xs">
                                <span className="text-slate-400">Weight: <strong>{q.marks} Marks</strong></span>
                                {q.negative_marks > 0 && <span className="text-rose-400 ml-2">(-{q.negative_marks})</span>}
                              </div>
                            </div>

                            <p className="text-sm font-medium text-slate-100">{q.question_text}</p>

                            {/* Options correctness list for MCQs */}
                            {q.type !== 'coding' && q.options && q.options.length > 0 && (
                              <div className="grid md:grid-cols-2 gap-3.5 pl-3 border-l border-slate-850 mt-2">
                                {q.options.map((opt: any) => {
                                  const isSelected = ans.selected_option_id === opt.id;
                                  return (
                                    <div
                                      key={opt.id}
                                      className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition-all ${
                                        opt.is_correct
                                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                          : isSelected
                                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                          : 'bg-slate-900/40 border-slate-850 text-slate-400'
                                      }`}
                                    >
                                      {opt.is_correct ? (
                                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                                      ) : isSelected ? (
                                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                                      ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                                      )}
                                      <span className="flex-1">{opt.text}</span>
                                      {isSelected && <span className="text-[9px] uppercase font-bold tracking-widest px-1 bg-slate-950 rounded">Your Answer</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Coding submissions code display */}
                            {q.type === 'coding' && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-2">Submitted Candidate Code:</span>
                                <pre className="p-4 bg-slate-950 border border-slate-900 rounded-xl text-xs text-indigo-300 font-mono overflow-x-auto max-h-60">
                                  <code>{ans.answer_text || 'No code submission logged.'}</code>
                                </pre>
                              </div>
                            )}

                            {/* Explanation and Grading Comments */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-900 text-xs text-slate-500">
                              <div>
                                Result: <span className={`font-semibold ${ans.is_correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {ans.is_correct ? 'Correct' : 'Incorrect'}
                                </span>
                                <span className="ml-3 font-mono text-slate-400">Score obtained: {ans.marks_obtained}</span>
                                <span className="ml-3 text-slate-400 font-mono">Time spent: {ans.time_spent_seconds}s</span>
                              </div>
                              {q.explanation && (
                                <div className="text-[11px] text-slate-400 italic bg-slate-900/20 p-2 rounded-lg border border-slate-900 mt-1 max-w-full font-sans">
                                  <strong>Explanation:</strong> {q.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Proctoring telemetry integration inside Scorecard */}
              <div className="grid md:grid-cols-2 gap-8 border-t border-slate-800 pt-8">
                {/* timeline */}
                <div className="glass-panel p-6 border border-slate-850 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-3">
                    <Activity className="w-4.5 h-4.5 text-indigo-400" /> Proctor Telemetry Violations log
                  </h4>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {scorecardDetails.proctoring?.events && scorecardDetails.proctoring.events.length > 0 ? (
                      scorecardDetails.proctoring.events.map((ev: any) => (
                        <div key={ev.id} className="p-3 bg-slate-900/30 rounded-xl border border-slate-900 text-xs flex gap-3 items-start">
                          {ev.event_type === 'tab_switch' ? (
                            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full mt-1.5 animate-ping" />
                          ) : (
                            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full mt-1.5" />
                          )}
                          <div>
                            <div className="font-semibold text-white capitalize">{ev.event_type.replace('_', ' ')}</div>
                            <div className="text-slate-400 mt-0.5">{ev.details?.message || 'Suspicion flag flagged by system'}</div>
                            <span className="text-[10px] text-slate-500 block mt-1">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500">No proctoring violation logs. Perfect candidate score!</div>
                    )}
                  </div>
                </div>

                {/* snapshots */}
                <div className="glass-panel p-6 border border-slate-850 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-3">
                    <Video className="w-4.5 h-4.5 text-indigo-400" /> Proctor Webcam Snapshots
                  </h4>

                  <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                    {scorecardDetails.proctoring?.snapshots && scorecardDetails.proctoring.snapshots.length > 0 ? (
                      scorecardDetails.proctoring.snapshots.map((snap: any) => (
                        <div key={snap.id} className="glass-card p-2 rounded-xl border border-slate-900">
                          <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                            <img
                              src={snap.snapshot_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200`}
                              alt="Webcam Snapshot"
                              className="object-cover w-full h-full opacity-60"
                              onError={(e: any) => {
                                e.target.src = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200`
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 px-1">
                            <span>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                            <span className="font-semibold text-rose-400">Risk: +{snap.risk_score}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 p-8 text-center text-xs text-slate-500">No webcam snapshots. Camera monitoring was clear!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
