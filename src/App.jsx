import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Search, 
  Mail, 
  Phone, 
  Globe, 
  Download, 
  Trash2, 
  Play, 
  Square,
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Star, 
  Database,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  Settings,
  Key,
  Wifi,
  WifiOff,
  Camera,
  X,
  Plus,
  Send,
  Eye,
  Sparkles,
  PlusCircle,
  Trash,
  Bot,
  Pause,
  BarChart3,
  MapPinned,
  Zap,
  Clock,
  Activity
} from 'lucide-react';

export default function App() {
  // Parámetros de búsqueda
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);
  
  // Datos del escaneo
  const [leads, setLeads] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [scanStatus, setScanStatus] = useState({
    running: false,
    query: '',
    limit: 20,
    progress: 0,
    status: 'idle',
    message: 'Listo para iniciar el escaneo.'
  });
  
  // IDs de leads cuyo descubrimiento está en curso
  const [discoveringIds, setDiscoveringIds] = useState(new Set());

  // Configuración: Gemini/Groq API Key, proveedor, estado de sesión y ajustes de correo
  const [socialConfig, setSocialConfig] = useState({
    provider: 'gemini',
    hasGeminiKey: false,
    hasGroqKey: false,
    hasSession: false,
    loginStatus: 'closed',
    emailService: 'resend',
    hasSendgridKey: false,
    sendgridFrom: '',
    hasResendKey: false,
    resendFrom: 'onboarding@resend.dev',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    hasSmtpPass: false,
    smtpFrom: ''
  });
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [savingGroqKey, setSavingGroqKey] = useState(false);
  const [connectingFb, setConnectingFb] = useState(false);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'templates' | 'send-email'
  const [activeSettingsTab, setActiveSettingsTab] = useState('vision'); // 'vision' | 'email'

  // Inputs de Configuración de Correo
  const [sendgridKeyInput, setSendgridKeyInput] = useState('');
  const [sendgridFromInput, setSendgridFromInput] = useState('');
  const [resendApiKeyInput, setResendApiKeyInput] = useState('');
  const [resendFromInput, setResendFromInput] = useState('');
  const [smtpHostInput, setSmtpHostInput] = useState('');
  const [smtpPortInput, setSmtpPortInput] = useState('587');
  const [smtpUserInput, setSmtpUserInput] = useState('');
  const [smtpPassInput, setSmtpPassInput] = useState('');
  const [smtpFromInput, setSmtpFromInput] = useState('');
  const [savingEmailConfig, setSavingEmailConfig] = useState(false);

  // Gestión de Plantillas
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editorTemplate, setEditorTemplate] = useState({ id: '', name: '', subject: '', bodyHtml: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Modal para enviar correo
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendLead, setSendLead] = useState(null);
  const [sendRecipientEmail, setSendRecipientEmail] = useState('');
  const [sendSelectedTemplateId, setSendSelectedTemplateId] = useState('');
  const [sendCustomSubject, setSendCustomSubject] = useState('');
  const [sendCustomBody, setSendCustomBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateLead, setDeleteCandidateLead] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editLeadWebsite, setEditLeadWebsite] = useState('');
  const [editLeadEmailsText, setEditLeadEmailsText] = useState('');
  const [editLeadSaving, setEditLeadSaving] = useState(false);

  const [showSendAllModal, setShowSendAllModal] = useState(false);
  const [sendAllTemplateId, setSendAllTemplateId] = useState('');
  const [sendAllSubject, setSendAllSubject] = useState('');
  const [sendAllBody, setSendAllBody] = useState('');
  const [sendingAllEmails, setSendingAllEmails] = useState(false);
  const [discoveringAll, setDiscoveringAll] = useState(false);
  const [emailQueueStats, setEmailQueueStats] = useState({ pending: 0, processing: 0, sent: 0, failed: 0 });

  // ── Estado del Agente Autónomo ─────────────────────────────────────────────
  const [agentStatus, setAgentStatus] = useState({
    running: false,
    paused: false,
    currentJob: null,
    runId: null,
    jobs: { pending: 0, running: 0, completed: 0, failed: 0, retry: 0, totalJobs: 0, totalLeads: 0, totalWithEmail: 0, totalEmails: 0 },
    daily: {},
    currentRun: null,
    recentErrors: []
  });
  const [agentProgress, setAgentProgress] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [agentStarting, setAgentStarting] = useState(false);
  const agentLogEndRef = useRef(null);

  // Consola de logs
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  // Cargar leads iniciales y configuración
  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads');
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (error) {
      console.error('Error al cargar leads:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setSocialConfig(data);
        setSendgridFromInput(data.sendgridFrom || '');
        setResendFromInput(data.resendFrom || 'onboarding@resend.dev');
        setSmtpHostInput(data.smtpHost || '');
        setSmtpPortInput(String(data.smtpPort || '587'));
        setSmtpUserInput(data.smtpUser || '');
        setSmtpFromInput(data.smtpFrom || '');
      }
    } catch {}
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0]);
          setEditorTemplate(data[0]);
        }
      }
    } catch (err) {
      console.error('Error cargando plantillas:', err);
    }
  };

  const fetchEmailQueueStats = async () => {
    try {
      const res = await fetch('/api/email-queue');
      if (res.ok) {
        const data = await res.json();
        setEmailQueueStats(data);
      }
    } catch (err) {
      console.error('Error cargando estado de la cola:', err);
    }
  };

  // ── Funciones del Agente Autónomo ──────────────────────────────────────────
  const fetchAgentStatus = async () => {
    try {
      const res = await fetch('/api/agent/status');
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data);
      }
    } catch (err) {
      console.error('Error cargando estado del agente:', err);
    }
  };

  const fetchAgentProgress = async () => {
    try {
      const res = await fetch('/api/agent/jobs/progress');
      if (res.ok) {
        const data = await res.json();
        setAgentProgress(data);
      }
    } catch {}
  };

  const handleAgentStart = async (regenerateJobs = false) => {
    setAgentStarting(true);
    try {
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateJobs })
      });
      const data = await res.json();
      if (res.ok) {
        setAgentLogs(prev => [...prev, { text: `▶ Agente iniciado (Run #${data.runId})`, type: 'success', time: new Date().toLocaleTimeString() }]);
        fetchAgentStatus();
      } else {
        setAgentLogs(prev => [...prev, { text: `❌ ${data.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      setAgentLogs(prev => [...prev, { text: `❌ Error de conexión: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
    }
    setAgentStarting(false);
  };

  const handleAgentStop = async () => {
    try {
      const res = await fetch('/api/agent/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      setAgentLogs(prev => [...prev, { text: `⏹ ${data.message}`, type: 'info', time: new Date().toLocaleTimeString() }]);
      setTimeout(fetchAgentStatus, 2000);
    } catch {}
  };

  const handleAgentPause = async () => {
    try {
      const res = await fetch('/api/agent/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      setAgentLogs(prev => [...prev, { text: data.paused ? '⏸ Agente pausado' : '▶ Agente reanudado', type: 'info', time: new Date().toLocaleTimeString() }]);
      fetchAgentStatus();
    } catch {}
  };

  const handleAgentRetryFailed = async () => {
    try {
      const res = await fetch('/api/agent/jobs/retry-failed', { method: 'POST' });
      const data = await res.json();
      setAgentLogs(prev => [...prev, { text: `🔄 ${data.message}`, type: 'info', time: new Date().toLocaleTimeString() }]);
      fetchAgentStatus();
      fetchAgentProgress();
    } catch {}
  };

  const handleOpenSendAllModal = () => {
    setShowSendAllModal(true);
    const defaultTemplate = templates.length > 0 ? templates[0] : null;
    setSendAllTemplateId(defaultTemplate ? defaultTemplate.id : '');
    setSendAllSubject(defaultTemplate ? defaultTemplate.subject : '');
    setSendAllBody(defaultTemplate ? defaultTemplate.bodyHtml : '');
  };

  const handleSendAllTemplateChange = (templateId) => {
    setSendAllTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSendAllSubject(template.subject);
      setSendAllBody(template.bodyHtml);
    }
  };

  const handleSendAll = async () => {
    if (!sendAllTemplateId && (!sendAllSubject.trim() || !sendAllBody.trim())) {
      alert('Selecciona una plantilla o completa asunto y contenido para enviar a todos.');
      return;
    }
    setSendingAllEmails(true);
    try {
      const res = await fetch('/api/leads/enqueue-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: sendAllTemplateId || null,
          customSubject: sendAllTemplateId ? null : sendAllSubject,
          customBody: sendAllTemplateId ? null : sendAllBody
        })
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(prev => [...prev, { text: `📬 Se encolaron ${data.queued} correos para envío masivo.`, type: 'completed', time: new Date().toLocaleTimeString() }]);
        setShowSendAllModal(false);
        fetchEmailQueueStats();
      } else {
        alert(`Error al encolar correos: ${data.error}`);
        setLogs(prev => [...prev, { text: `❌ Error al encolar correos masivos: ${data.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    }
    setSendingAllEmails(false);
  };

  useEffect(() => {
    fetchLeads();
    fetchConfig();
    fetchTemplates();
    fetchEmailQueueStats();
    fetchAgentStatus();
    fetchAgentProgress();

    const eventSource = new EventSource('/api/scan/stream');
    const queueInterval = setInterval(fetchEmailQueueStats, 10000);
    const agentInterval = setInterval(() => { fetchAgentStatus(); fetchAgentProgress(); }, 15000);

    // SSE del agente autónomo
    const agentSSE = new EventSource('/api/agent/stream');
    agentSSE.addEventListener('status', () => { fetchAgentStatus(); });
    const agentEvents = ['job_started', 'job_completed', 'job_failed', 'email_sent', 'started', 'stopped', 'paused', 'resumed', 'daily_limit_reached', 'schedule_pause', 'long_break', 'state_change_pause', 'all_jobs_done', 'too_many_errors', 'jobs_generated', 'email_limit_reached'];
    agentEvents.forEach(evtName => {
      agentSSE.addEventListener(evtName, (event) => {
        const data = JSON.parse(event.data);
        let text = '';
        switch (evtName) {
          case 'job_started': text = `🔍 Buscando: "${data.job?.category}" en ${data.job?.municipality}, ${data.job?.state}`; break;
          case 'job_completed': text = `✅ Completado: ${data.leadsFound} leads, ${data.leadsWithEmail} con email, ${data.emailsSent} enviados`; break;
          case 'job_failed': text = `❌ Falló (${data.phase})${data.retrying ? ' — se reintentará' : ''}`; break;
          case 'email_sent': text = `📧 Email enviado a ${data.to} (${data.lead})`; break;
          case 'started': text = `▶ Agente iniciado`; break;
          case 'stopped': text = `⏹ Agente detenido: ${data.reason}`; break;
          case 'paused': text = `⏸ Agente pausado`; break;
          case 'resumed': text = `▶ Agente reanudado`; break;
          case 'daily_limit_reached': text = `🚫 Límite diario alcanzado: ${data.metric}`; break;
          case 'schedule_pause': text = `🌙 Fuera de horario. Reanuda en ${data.waitMinutes} min`; break;
          case 'long_break': text = `☕ Descanso de ${Math.round((data.breakMs||0)/1000)}s tras ${data.searchesDone} búsquedas`; break;
          case 'state_change_pause': text = `🗺️ Cambiando: ${data.from} → ${data.to}`; break;
          case 'all_jobs_done': text = `🎉 ¡Todos los jobs completados!`; break;
          case 'too_many_errors': text = `🚨 Demasiados errores hoy. Agente detenido.`; break;
          case 'jobs_generated': text = `📋 ${data.inserted} jobs generados (total: ${data.total})`; break;
          case 'email_limit_reached': text = `📧 Límite de emails diarios alcanzado`; break;
          default: text = `${evtName}: ${JSON.stringify(data)}`;
        }
        setAgentLogs(prev => [...prev.slice(-200), { text, type: evtName.includes('fail') || evtName.includes('error') ? 'error' : 'info', time: new Date().toLocaleTimeString() }]);
        if (['job_completed', 'stopped', 'all_jobs_done'].includes(evtName)) {
          fetchAgentStatus();
          fetchAgentProgress();
        }
      });
    });
    agentSSE.onerror = () => {};

    eventSource.addEventListener('status', (event) => {
      const statusData = JSON.parse(event.data);
      setScanStatus(statusData);
      if (statusData.message) {
        setLogs((prev) => [
          ...prev,
          {
            text: statusData.message,
            type: statusData.status,
            time: new Date().toLocaleTimeString()
          }
        ]);
        // Detectar fin del descubrimiento masivo
        if (statusData.message.includes('Descubrimiento masivo finalizado')) {
          setDiscoveringAll(false);
        }
      }
    });

    eventSource.addEventListener('leads', (event) => {
      const leadsData = JSON.parse(event.data);
      setLeads(leadsData);
      setDiscoveringIds(prev => {
        const next = new Set(prev);
        leadsData.forEach(lead => {
          const hasContact = (lead.emails && lead.emails.length > 0) ||
            (lead.socials && Object.values(lead.socials).some(v => v));
          if (hasContact) {
            if (lead.id != null) {
              next.delete(String(lead.id));
            }
            const leadId = lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
            next.delete(leadId);
          }
        });
        return next;
      });
    });

    eventSource.addEventListener('social-status', (event) => {
      const data = JSON.parse(event.data);
      setSocialConfig(prev => ({ ...prev, ...data }));
      if (data.loginStatus === 'logged_in' || data.loginStatus === 'session_saved') {
        setConnectingFb(false);
      }
    });

    eventSource.onerror = (err) => {
      console.error('Error en la conexión SSE:', err);
    };

    return () => {
      eventSource.close();
      agentSSE.close();
      clearInterval(queueInterval);
      clearInterval(agentInterval);
    };
  }, []);

  // Auto-scroll del contenedor de logs al recibir nuevos mensajes
  useEffect(() => {
    if (logEndRef.current) {
      const container = logEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  // Auto-scroll del log del agente
  useEffect(() => {
    if (agentLogEndRef.current) {
      const container = agentLogEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [agentLogs]);

  // Iniciar escaneo
  const handleStartScan = async (e) => {
    e.preventDefault();
    if (!category.trim() || !location.trim()) return;

    setLogs([{ text: 'Solicitando inicio de escaneo al servidor...', type: 'info', time: new Date().toLocaleTimeString() }]);
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${category.trim()} en ${location.trim()}`,
          limit: parseInt(limit, 10) || 20
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        setLogs((prev) => [...prev, { text: `Error al iniciar: ${errData.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      }
    } catch (error) {
      setLogs((prev) => [...prev, { text: `Error de conexión: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
    }
  };

  // Detener escaneo en curso
  const handleStop = async () => {
    try {
      await fetch('/api/scan/stop', { method: 'POST' });
      setLogs((prev) => [...prev, { text: 'Solicitud de detención enviada al servidor...', type: 'warning', time: new Date().toLocaleTimeString() }]);
    } catch (error) {
      setLogs((prev) => [...prev, { text: `Error al detener: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
    }
  };

  // Limpiar base de datos
  const handleClearDatabase = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar todos los leads guardados? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      const response = await fetch('/api/leads/clear', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads);
        setLogs([{ text: 'Base de datos limpia.', type: 'info', time: new Date().toLocaleTimeString() }]);
      }
    } catch (error) {
      console.error('Error al limpiar la base de datos:', error);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    window.open('/api/leads/export', '_blank');
  };

  // Guardar Gemini API Key
  const handleSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiKeyInput.trim() })
      });
      if (res.ok) {
        setSocialConfig(prev => ({ ...prev, hasGeminiKey: true }));
        setGeminiKeyInput('');
        setLogs(prev => [...prev, { text: '✅ Gemini API Key guardada.', type: 'completed', time: new Date().toLocaleTimeString() }]);
      }
    } catch {}
    setSavingKey(false);
  };

  // Guardar Groq API Key
  const handleSaveGroqKey = async () => {
    if (!groqKeyInput.trim()) return;
    setSavingGroqKey(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groqApiKey: groqKeyInput.trim() })
      });
      if (res.ok) {
        setSocialConfig(prev => ({ ...prev, hasGroqKey: true }));
        setGroqKeyInput('');
        setLogs(prev => [...prev, { text: '✅ Groq API Key guardada.', type: 'completed', time: new Date().toLocaleTimeString() }]);
      }
    } catch {}
    setSavingGroqKey(false);
  };

  // Cambiar Proveedor de IA
  const handleProviderChange = async (newProvider) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider })
      });
      if (res.ok) {
        setSocialConfig(prev => ({ ...prev, provider: newProvider }));
        setLogs(prev => [...prev, { text: `🤖 Proveedor de IA cambiado a: ${newProvider === 'gemini' ? 'Google Gemini' : 'Groq (Llama 4 Scout)'}`, type: 'info', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      console.error('Error al cambiar proveedor:', err);
    }
  };

  // Conectar Facebook (abrir navegador visible)
  const handleConnectFacebook = async () => {
    setConnectingFb(true);
    setShowSettings(false);
    setLogs(prev => [...prev, { text: '🌐 Abriendo navegador para login de Facebook... Inicia sesión y luego ciérralo.', type: 'info', time: new Date().toLocaleTimeString() }]);
    try {
      await fetch('/api/social/connect', { method: 'POST' });
    } catch (err) {
      setLogs(prev => [...prev, { text: `❌ Error: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      setConnectingFb(false);
    }
  };

  // Guardar Configuración de Correo
  const handleSaveEmailConfig = async (service, data) => {
    setSavingEmailConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailService: service, ...data })
      });
      if (res.ok) {
        const updated = await res.json();
        setSocialConfig(updated);
        setLogs(prev => [...prev, { text: `✅ Configuración de correo (${service.toUpperCase()}) guardada.`, type: 'completed', time: new Date().toLocaleTimeString() }]);
      } else {
        const err = await res.json();
        setLogs(prev => [...prev, { text: `❌ Error al guardar config de correo: ${err.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      setLogs(prev => [...prev, { text: `❌ Error de conexión: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
    }
    setSavingEmailConfig(false);
  };

  // Guardar/Actualizar Plantilla
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!editorTemplate.name || !editorTemplate.subject || !editorTemplate.bodyHtml) {
      alert('Por favor rellena todos los campos de la plantilla.');
      return;
    }
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editorTemplate)
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMessage = data?.error || data?.message || 'Error al guardar la plantilla.';
        alert(errorMessage);
        console.error('Save template error:', data);
      } else {
        setTemplates(data.templates);
        const updated = data.savedTemplate || data.templates.find(t => t.id === editorTemplate.id) || data.templates[data.templates.length - 1];
        if (updated) {
          setSelectedTemplate(updated);
          setEditorTemplate(updated);
        }
        setLogs(prev => [...prev, { text: `✅ Plantilla "${editorTemplate.name}" guardada con éxito.`, type: 'completed', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      console.error(err);
      alert('No se pudo conectar con el servidor para guardar la plantilla.');
    }
    setSavingTemplate(false);
  };

  // Eliminar Plantilla
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          setSelectedTemplate(data.templates[0]);
          setEditorTemplate(data.templates[0]);
        } else {
          setSelectedTemplate(null);
          setEditorTemplate({ id: '', name: '', subject: '', bodyHtml: '' });
        }
        setLogs(prev => [...prev, { text: '🗑️ Plantilla eliminada.', type: 'info', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper para compilar variables en el frontend
  const compileFrontendTemplate = (template, lead) => {
    if (!template || !lead) return { subject: '', bodyHtml: '' };
    let subject = template.subject || '';
    let bodyHtml = template.bodyHtml || '';
    
    const variables = {
      companyName: lead.name || '',
      phone: lead.phone || '',
      website: lead.website || '',
      address: lead.address || ''
    };

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      subject = subject.replace(regex, value);
      bodyHtml = bodyHtml.replace(regex, value);
    }

    return { subject, bodyHtml };
  };

  // Abrir vista de Envío de Correo
  const handleOpenSendEmailModal = (lead) => {
    setSendLead(lead);
    const defaultEmail = lead.emails && lead.emails.length > 0 ? lead.emails[0] : '';
    setSendRecipientEmail(defaultEmail);
    
    const defaultTemp = templates.length > 0 ? templates[0] : null;
    setSendSelectedTemplateId(defaultTemp ? defaultTemp.id : '');
    
    if (defaultTemp) {
      const compiled = compileFrontendTemplate(defaultTemp, lead);
      setSendCustomSubject(compiled.subject);
      setSendCustomBody(compiled.bodyHtml);
    } else {
      setSendCustomSubject('');
      setSendCustomBody('');
    }
    
    setActiveTab('send-email');
  };

  // Cambiar Plantilla en el Modal
  const handleTemplateChangeInModal = (templateId) => {
    setSendSelectedTemplateId(templateId);
    const temp = templates.find(t => t.id === templateId);
    if (temp && sendLead) {
      const compiled = compileFrontendTemplate(temp, sendLead);
      setSendCustomSubject(compiled.subject);
      setSendCustomBody(compiled.bodyHtml);
    }
  };

  // Enviar Correo
  const handleSendEmail = async () => {
    if (!sendRecipientEmail.trim()) {
      alert('Introduce un correo destinatario.');
      return;
    }
    setSendingEmail(true);
    try {
      const leadId = sendLead.placeId || `${sendLead.name}_${sendLead.phone || sendLead.address}`;
      const res = await fetch('/api/leads/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          templateId: sendSelectedTemplateId,
          customSubject: sendCustomSubject,
          customBody: sendCustomBody,
          recipientEmail: sendRecipientEmail.trim()
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setLogs(prev => [...prev, { text: `✉️ Correo enviado a ${sendRecipientEmail} (${sendLead.name}) con éxito.`, type: 'completed', time: new Date().toLocaleTimeString() }]);
        setLeads(prev => prev.map(l => {
          const id = l.placeId || `${l.name}_${l.phone || l.address}`;
          if (id === leadId) {
            return {
              ...l,
              emailSent: true,
              emailSentAt: new Date().toISOString()
            };
          }
          return l;
        }));
        // Volver a la vista de escaneo tras envío exitoso
        setActiveTab('scan');
        setSendLead(null);
      } else {
        alert(`Error al enviar: ${data.error}`);
        setLogs(prev => [...prev, { text: `❌ Error al enviar correo a ${sendRecipientEmail}: ${data.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    }
    setSendingEmail(false);
  };

  // Eliminar un lead individual
  const handleDeleteLead = (lead) => {
    setDeleteCandidateLead(lead);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteLead = async () => {
    if (!deleteCandidateLead) return;
    const leadId = deleteCandidateLead.id || deleteCandidateLead.placeId || `${deleteCandidateLead.name}_${deleteCandidateLead.phone || deleteCandidateLead.address}`;
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setLogs(prev => [...prev, { text: `🗑️ Lead "${deleteCandidateLead.name}" eliminado.`, type: 'info', time: new Date().toLocaleTimeString() }]);
        setShowDeleteConfirm(false);
        setDeleteCandidateLead(null);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    }
  };

  const cancelDeleteLead = () => {
    setShowDeleteConfirm(false);
    setDeleteCandidateLead(null);
  };

  const handleOpenEditLeadModal = (lead) => {
    setEditLead(lead);
    setEditLeadWebsite(lead?.website || '');
    setEditLeadEmailsText((lead?.emails || []).join('\n'));
    setShowEditLeadModal(true);
  };

  const handleCloseEditLeadModal = () => {
    setShowEditLeadModal(false);
    setEditLead(null);
    setEditLeadWebsite('');
    setEditLeadEmailsText('');
  };

  const handleSaveEditedLeadEmails = async () => {
    if (!editLead) return;
    const emails = editLeadEmailsText
      .split(/[\r\n,;]+/)
      .map(email => email.trim())
      .filter(Boolean);

    setEditLeadSaving(true);
    try {
      const payload = { website: editLeadWebsite.trim() };
      if (emails.length > 0) payload.emails = emails;
      const res = await fetch(`/api/leads/${encodeURIComponent(editLead.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error actualizando los datos del lead.');
        return;
      }
      setLeads(prev => prev.map(l => (l.id === data.lead.id ? data.lead : l)));
      setLogs(prev => [...prev, { text: `✏️ Contacto actualizado para ${data.lead.name}.`, type: 'info', time: new Date().toLocaleTimeString() }]);
      handleCloseEditLeadModal();
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setEditLeadSaving(false);
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = currentItems.map(lead => lead.id);
    const allSelected = visibleIds.every(id => selectedLeadIds.has(id));
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleOpenBulkDeleteConfirm = () => {
    if (selectedLeadIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const handleCancelBulkDelete = () => {
    setShowBulkDeleteConfirm(false);
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedLeadIds.size === 0) {
      setShowBulkDeleteConfirm(false);
      return;
    }

    try {
      const res = await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedLeadIds) })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Error eliminando leads seleccionados.');
        return;
      }

      const data = await res.json();
      setLeads(data.leads);
      setLogs(prev => [...prev, { text: `🗑️ Eliminados ${selectedLeadIds.size} leads seleccionados.`, type: 'info', time: new Date().toLocaleTimeString() }]);
      setSelectedLeadIds(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    }
  };

  // Descubrir con Visión IA (para leads de redes sociales)
  const handleDiscoverSocial = async (lead) => {
    const leadId = lead.id || lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
    setDiscoveringIds(prev => new Set([...prev, leadId]));
    setLogs(prev => [...prev, { text: `📸 Capturando página de ${lead.name}...`, type: 'info', time: new Date().toLocaleTimeString() }]);
    try {
      const res = await fetch(`/api/leads/discover-social/${encodeURIComponent(leadId)}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        setLogs(prev => [...prev, { text: `❌ ${err.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
        setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }
      setTimeout(() => setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; }), 35000);
    } catch (err) {
      setLogs(prev => [...prev, { text: `❌ ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; });
    }
  };

  // Descubrir emails/redes sociales de un lead específico (manual)
  const handleDiscover = async (lead) => {
    const leadId = lead.id || lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
    setDiscoveringIds(prev => new Set([...prev, leadId]));
    setLogs(prev => [
      ...prev,
      { text: `🔍 Descubriendo contactos de: ${lead.name}...`, type: 'info', time: new Date().toLocaleTimeString() }
    ]);

    try {
      const response = await fetch(`/api/leads/discover/${encodeURIComponent(leadId)}`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        setLogs(prev => [...prev, { text: `❌ Error: ${err.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
        setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }
      // El resultado llega vía SSE (evento 'leads'), que actualiza el estado automáticamente
      // Quitar el spinner después de un timeout razonable (el SSE lo actualizará antes)
      setTimeout(() => {
        setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }, 20000);
    } catch (error) {
      setLogs(prev => [...prev, { text: `❌ Error de conexión: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      setDiscoveringIds(prev => { const s = new Set(prev); s.delete(leadId); return s; });
    }
  };

  // Cuando llega un evento SSE de leads, limpiar los IDs en descubrimiento
  // (esto se hace en el useEffect de SSE — los leads actualizados llegarán con emails ya cargados)

  // Descubrir todos los leads con web pero sin email
  const handleDiscoverAll = async () => {
    const pending = leads.filter(l =>
      l.website && l.website.trim() &&
      (!Array.isArray(l.emails) || l.emails.length === 0)
    );
    if (pending.length === 0) {
      setLogs(prev => [...prev, { text: '⚠️ No hay leads con sitio web pendientes de descubrimiento.', type: 'warning', time: new Date().toLocaleTimeString() }]);
      return;
    }
    setDiscoveringAll(true);
    setLogs(prev => [...prev, { text: `🔍 Iniciando descubrimiento masivo de ${pending.length} leads...`, type: 'info', time: new Date().toLocaleTimeString() }]);
    try {
      const res = await fetch('/api/leads/discover-all', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        setLogs(prev => [...prev, { text: `❌ ${err.error}`, type: 'error', time: new Date().toLocaleTimeString() }]);
        setDiscoveringAll(false);
        return;
      }
      // El progreso y resultado llegan por SSE; desactivar el estado cuando llegue el mensaje final
    } catch (err) {
      setLogs(prev => [...prev, { text: `❌ Error de conexión: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
      setDiscoveringAll(false);
    }
  };

  // Paginación y Ordenamiento
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Resetear a la primera página solo cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  // Ordenar y Filtrar leads (los más nuevos primero: scannedAt descendente)
  const filteredAndSortedLeads = React.useMemo(() => {
    const sorted = [...leads].sort((a, b) => {
      const dateA = a.scannedAt ? new Date(a.scannedAt).getTime() : 0;
      const dateB = b.scannedAt ? new Date(b.scannedAt).getTime() : 0;
      return dateB - dateA; // Descendente: más nuevos primero
    });

    const text = filterText.toLowerCase();
    if (!text) return sorted;

    return sorted.filter(lead => {
      return (
        (lead.name || '').toLowerCase().includes(text) ||
        (lead.phone || '').toLowerCase().includes(text) ||
        (lead.website || '').toLowerCase().includes(text) ||
        (lead.address || '').toLowerCase().includes(text) ||
        (lead.emails || []).some(email => email.toLowerCase().includes(text))
      );
    });
  }, [leads, filterText]);

  // Datos paginados
  const totalPages = Math.ceil(filteredAndSortedLeads.length / itemsPerPage) || 1;

  // Si al eliminar leads la página actual queda fuera de rango, ir a la última página válida
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAndSortedLeads.slice(indexOfFirstItem, indexOfLastItem);

  // Estadísticas rápidas
  const totalLeads = leads.length;
  const leadsWithWeb = leads.filter(l => l.website).length;
  const leadsWithEmail = leads.filter(l => l.emails && l.emails.length > 0).length;

  const isSocialUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    const socialPatterns = [
      'facebook.com', 'fb.com',
      'instagram.com', 'instagr.am',
      'linkedin.com',
      'twitter.com', 'x.com',
      'youtube.com', 'youtu.be',
      'tiktok.com'
    ];
    return socialPatterns.some(pattern => lower.includes(pattern));
  };

  // Renderizar estado de escaneo en texto legible
  const getBadgeClass = (status) => {
    switch (status) {
      case 'scraping': return 'badge-scraping';
      case 'crawling': return 'badge-crawling';
      case 'completed': return 'badge-completed';
      case 'stopped': return 'badge-stopped';
      case 'error': return 'badge-error';
      default: return 'badge-idle';
    }
  };

  const getBadgeText = (status) => {
    switch (status) {
      case 'scraping': return 'Buscando en Maps';
      case 'crawling': return 'Rastreando Sitios Web';
      case 'completed': return 'Completado';
      case 'stopped': return 'Detenido';
      case 'error': return 'Error';
      default: return 'Inactivo';
    }
  };

  // Calcular porcentaje del círculo SVG de progreso
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scanStatus.progress / 100) * circumference;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <MapPin size={36} className="logo-icon" />
          <h1 className="logo-text">Scan Zone</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="stat-item">
            <Database size={18} className="text-secondary" />
            <span className="text-secondary">Base de datos local:</span>
            <span className="stat-val">{totalLeads} leads</span>
          </div>
          {/* Indicador de sesión de Facebook */}
          {socialConfig.hasSession ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--success)' }}>
              <Wifi size={14} /> Visión IA lista ({socialConfig.provider === 'gemini' ? 'Gemini' : 'Groq'})
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <WifiOff size={14} /> Sin sesión social
            </span>
          )}
          <div className="stat-item" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Mail size={18} className="text-secondary" />
            <span className="text-secondary">Cola de correo:</span>
            <span className="stat-val">{emailQueueStats.pending} pendientes · {emailQueueStats.processing} en proceso</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={handleOpenSendAllModal}
            disabled={leadsWithEmail === 0}
            title="Enviar correo masivo a todos los leads"
          >
            <Send size={16} />
            Enviar a todos
          </button>
          {/* Botón de ajustes */}
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            onClick={() => setShowSettings(v => !v)}
            title="Ajustes de Visión IA"
          >
            <Settings size={16} />
            Ajustes
          </button>
        </div>
      </header>

      {/* Panel de Ajustes (desplegable) */}
      {showSettings && (
        <section className="card" style={{ background: 'rgba(15,17,30,0.95)', borderColor: 'rgba(99,102,241,0.3)', backdropFilter: 'blur(10px)' }}>
          {/* Sub-tabs de Ajustes */}
          <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: activeSettingsTab === 'vision' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeSettingsTab === 'vision' ? '2px solid var(--accent-primary)' : 'none',
                padding: '0.4rem 0.2rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveSettingsTab('vision')}
            >
              👁️ Visión IA y Sesión
            </button>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: activeSettingsTab === 'email' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeSettingsTab === 'email' ? '2px solid var(--accent-primary)' : 'none',
                padding: '0.4rem 0.2rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveSettingsTab('email')}
            >
              ✉️ Configuración de Correo
            </button>
          </div>

          {activeSettingsTab === 'vision' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Proveedor y Key */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label" style={{ marginBottom: '0.5rem' }}>Proveedor de Visión IA</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className={`btn ${socialConfig.provider === 'gemini' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleProviderChange('gemini')}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                    >
                      Google Gemini
                    </button>
                    <button
                      type="button"
                      className={`btn ${socialConfig.provider === 'groq' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleProviderChange('groq')}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                    >
                      Groq (Llama 4 Scout)
                    </button>
                  </div>
                </div>

                {socialConfig.provider === 'gemini' ? (
                  <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Key size={14} /> Gemini API Key
                      {socialConfig.hasGeminiKey && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ configurada)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="password"
                        className="input-field"
                        placeholder={socialConfig.hasGeminiKey ? 'Introduce nueva key para cambiar...' : 'AIza...'}
                        value={geminiKeyInput}
                        onChange={e => setGeminiKeyInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleSaveGeminiKey}
                        disabled={savingKey || !geminiKeyInput.trim()}
                      >
                        {savingKey ? <Loader2 size={14} className="animate-spin-slow" /> : <Key size={14} />}
                        Guardar
                      </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      Obtén tu key gratuita en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>aistudio.google.com</a>
                    </p>
                  </div>
                ) : (
                  <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Key size={14} /> Groq API Key
                      {socialConfig.hasGroqKey && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ configurada)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="password"
                        className="input-field"
                        placeholder={socialConfig.hasGroqKey ? 'Introduce nueva key para cambiar...' : 'gsk_...'}
                        value={groqKeyInput}
                        onChange={e => setGroqKeyInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleSaveGroqKey}
                        disabled={savingGroqKey || !groqKeyInput.trim()}
                      >
                        {savingGroqKey ? <Loader2 size={14} className="animate-spin-slow" /> : <Key size={14} />}
                        Guardar
                      </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      Obtén tu key en <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>console.groq.com</a>
                    </p>
                  </div>
                )}
              </div>

              {/* Conexión Facebook */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Facebook size={14} /> Sesión de Red Social
                  {socialConfig.hasSession && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ guardada)</span>}
                </label>
                <button
                  type="button"
                  className={`btn ${socialConfig.hasSession ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleConnectFacebook}
                  disabled={connectingFb}
                  style={{ width: 'fit-content' }}
                >
                  {connectingFb ? (
                    <><Loader2 size={16} className="animate-spin-slow" /> Esperando login...</>
                  ) : socialConfig.hasSession ? (
                    <><RefreshCw size={16} /> Reconectar Facebook</>
                  ) : (
                    <><Facebook size={16} /> Conectar Facebook</>
                  )}
                </button>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {socialConfig.hasSession
                    ? 'Sesión guardada. El botón 📸 Capturar usará esta sesión automáticamente.'
                    : 'Haz click, inicia sesión en el navegador que se abre, y ciérralo. La sesión se guarda para siempre.'}
                </p>
              </div>
            </div>
          ) : (
            /* Ajustes de Correo */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label" style={{ marginBottom: '0.5rem' }}>Proveedor de Envío de Correo</label>
                <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '500px' }}>
                  <button
                    type="button"
                    className={`btn ${socialConfig.emailService === 'sendgrid' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSaveEmailConfig('sendgrid', {})}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    SendGrid
                  </button>
                  <button
                    type="button"
                    className={`btn ${socialConfig.emailService === 'resend' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSaveEmailConfig('resend', {})}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    Resend (recomendado)
                  </button>
                  <button
                    type="button"
                    className={`btn ${socialConfig.emailService === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSaveEmailConfig('smtp', {})}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    SMTP Tradicional
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Resend está seleccionado por defecto para envío de correos; SendGrid se mantiene como opción alternativa.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                {socialConfig.emailService === 'sendgrid' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Key size={14} /> SendGrid API Key
                          {socialConfig.hasSendgridKey && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ configurada)</span>}
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder={socialConfig.hasSendgridKey ? 'Introduce nueva key...' : 'SG.xxx...'}
                          value={sendgridKeyInput}
                          onChange={e => setSendgridKeyInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Mail size={14} /> Correo Remitente Autorizado (From)
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: Consultora <hola@miempresa.com>"
                          value={sendgridFromInput}
                          onChange={e => setSendgridFromInput(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: 'fit-content' }}
                        onClick={() => handleSaveEmailConfig('sendgrid', {
                          sendgridApiKey: sendgridKeyInput.trim() || undefined,
                          sendgridFrom: sendgridFromInput.trim()
                        })}
                        disabled={savingEmailConfig}
                      >
                        {savingEmailConfig ? <Loader2 size={14} className="animate-spin-slow" /> : <CheckCircle2 size={14} />}
                        Guardar Configuración SendGrid
                      </button>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <strong>Información de SendGrid:</strong><br />
                        SendGrid requiere que tu API Key tenga permisos de envío de correo ("Mail Send").<br /><br />
                        El remitente debe ser una dirección de correo o un dominio completo previamente verificado en tu panel de SendGrid en la sección de <em>Sender Authentication</em>.
                      </p>
                    </div>
                  </>
                )}

                {socialConfig.emailService === 'resend' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Key size={14} /> Resend API Key
                          {socialConfig.hasResendKey && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ configurada)</span>}
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder={socialConfig.hasResendKey ? 'Introduce nueva key...' : 're_xxx...'}
                          value={resendApiKeyInput}
                          onChange={e => setResendApiKeyInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Mail size={14} /> Correo Remitente (From)
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: onboarding@resend.dev o info@tudominio.com"
                          value={resendFromInput}
                          onChange={e => setResendFromInput(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: 'fit-content' }}
                        onClick={() => handleSaveEmailConfig('resend', {
                          resendApiKey: resendApiKeyInput.trim() || undefined,
                          resendFrom: resendFromInput.trim()
                        })}
                        disabled={savingEmailConfig}
                      >
                        {savingEmailConfig ? <Loader2 size={14} className="animate-spin-slow" /> : <CheckCircle2 size={14} />}
                        Guardar Configuración Resend
                      </button>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <strong>Información de Resend:</strong><br />
                        Si usas la cuenta gratuita y el remitente predeterminado `onboarding@resend.dev`, solo podrás enviar correos de prueba a tu propio email registrado en Resend.<br /><br />
                        Para enviar correos a cualquier prospecto, debes añadir tu propio dominio en el panel de Resend y verificar los registros DNS.
                      </p>
                    </div>
                  </>
                )}

                {socialConfig.emailService === 'smtp' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label className="input-label">Servidor Host SMTP</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: smtp.gmail.com o mail.smtp.com"
                          value={smtpHostInput}
                          onChange={e => setSmtpHostInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Puerto SMTP</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: 587 o 465"
                          value={smtpPortInput}
                          onChange={e => setSmtpPortInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Usuario / Correo</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: tuusuario@gmail.com"
                          value={smtpUserInput}
                          onChange={e => setSmtpUserInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">
                          Contraseña
                          {socialConfig.hasSmtpPass && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(✅ configurada)</span>}
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder={socialConfig.hasSmtpPass ? 'Introduce nueva contraseña...' : '••••••••'}
                          value={smtpPassInput}
                          onChange={e => setSmtpPassInput(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Correo Remitente (From)</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Ej: Mi Consultora <tucorreo@gmail.com>"
                          value={smtpFromInput}
                          onChange={e => setSmtpFromInput(e.target.value)}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSaveEmailConfig('smtp', {
                            smtpHost: smtpHostInput.trim(),
                            smtpPort: parseInt(smtpPortInput, 10) || 587,
                            smtpUser: smtpUserInput.trim(),
                            smtpPass: smtpPassInput.trim() || undefined,
                            smtpFrom: smtpFromInput.trim()
                          })}
                          disabled={savingEmailConfig}
                        >
                          {savingEmailConfig ? <Loader2 size={14} className="animate-spin-slow" /> : <CheckCircle2 size={14} />}
                          Guardar Configuración SMTP
                        </button>
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <strong>Información de SMTP:</strong><br />
                        Puedes conectar servicios como Gmail, Zoho Mail o Outlook.<br /><br />
                        Si utilizas Gmail, recuerda que debes activar la verificación en dos pasos y crear una <em>Contraseña de Aplicación</em> para poder conectarte sin bloqueos de seguridad.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Selector de Pestañas Principal */}
      <div className="tabs-container" style={{ margin: '0 0.5rem' }}>
        <button
          type="button"
          className={`tab-button ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
        >
          <Search size={16} />
          Búsqueda de Leads
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Mail size={16} />
          Plantillas de Correo
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'agent' ? 'active' : ''}`}
          onClick={() => { setActiveTab('agent'); fetchAgentStatus(); fetchAgentProgress(); }}
          style={{ position: 'relative' }}
        >
          <Bot size={16} />
          Agente
          {agentStatus.running && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: agentStatus.paused ? '#f59e0b' : '#22c55e',
              display: 'inline-block', marginLeft: 6,
              animation: agentStatus.paused ? 'none' : 'pulse 1.5s infinite'
            }} />
          )}
        </button>
        {activeTab === 'send-email' && sendLead && (
          <button
            type="button"
            className="tab-button active"
            style={{ color: 'var(--accent-secondary)' }}
          >
            <Send size={16} />
            Enviar a {sendLead.name}
          </button>
        )}
      </div>

      {activeTab === 'scan' ? (
        <>
          {/* Formulario de Búsqueda */}
          <section className="card">
            <form onSubmit={handleStartScan} className="search-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="category">Categoría de Negocio</label>
                <input 
                  id="category"
                  type="text" 
                  placeholder="Ej: dentistas, gimnasios, hoteles..." 
                  className="input-field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={scanStatus.running}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="location">Zona o Ciudad</label>
                <input 
                  id="location"
                  type="text" 
                  placeholder="Ej: Barcelona, Madrid, Bogotá..." 
                  className="input-field"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={scanStatus.running}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="limit">Límite de Leads</label>
                <input 
                  id="limit"
                  type="number" 
                  min="1"
                  max="200"
                  className="input-field"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={scanStatus.running}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={scanStatus.running || !category || !location}
                >
                  {scanStatus.running ? (
                    <>
                      <Loader2 size={18} className="animate-spin-slow" />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Buscar
                    </>
                  )}
                </button>

                {/* Botón Detener */}
                {scanStatus.running && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleStop}
                    title="Detener escaneo"
                  >
                    <Square size={16} fill="currentColor" />
                    Detener
                  </button>
                )}

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleClearDatabase}
                  disabled={scanStatus.running || totalLeads === 0}
                  title="Limpiar base de datos"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </form>
          </section>

          {/* Monitor de Progreso en Vivo */}
          {(scanStatus.running || logs.length > 0) && (
            <section className="monitor-layout">
              {/* Tarjeta de Progreso */}
              <div className="card progress-card">
                <h3>Progreso del Escaneo</h3>
                <div className="progress-circle-container">
                  <svg width="140" height="140">
                    <circle cx="70" cy="70" r={radius} className="progress-circle-bg" />
                    <circle 
                      cx="70" 
                      cy="70" 
                      r={radius} 
                      className="progress-circle-bar" 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="progress-text-center">{scanStatus.progress}%</div>
                </div>
                <div>
                  <span className={`progress-status-badge ${getBadgeClass(scanStatus.status)}`}>
                    {getBadgeText(scanStatus.status)}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', minHeight: '3em' }}>
                  {scanStatus.message}
                </p>
              </div>

              {/* Consola de logs */}
              <div className="card log-card">
                <div className="log-header">
                  <h3>Consola de Actividad</h3>
                  {scanStatus.running && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={12} className="animate-spin-slow" />
                      Actualizando en vivo...
                    </div>
                  )}
                </div>
                <div className="log-container">
                  {logs.map((log, index) => (
                    <div key={index} className={`log-line ${log.type}`}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>[{log.time}]</span>
                      {log.text}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </section>
          )}

          {/* Tabla de Leads Extraídos */}
          <section className="card">
            <div className="table-header-row">
              <div className="table-stats">
                <h2>Resultados Extraídos</h2>
                <div className="stat-item">
                  <Globe size={16} className="text-secondary" />
                  <span>Con Web: <strong className="stat-val">{leadsWithWeb}</strong></span>
                </div>
                <div className="stat-item">
                  <Mail size={16} className="text-secondary" />
                  <span>Con Email: <strong className="stat-val">{leadsWithEmail}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '700px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Filtrar resultados..." 
                  className="input-field table-filter-input"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleExportCSV}
                    disabled={totalLeads === 0}
                  >
                    <Download size={18} />
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDiscoverAll}
                    disabled={discoveringAll || leads.filter(l => l.website && l.website.trim() && (!Array.isArray(l.emails) || l.emails.length === 0)).length === 0}
                    title="Descubrir emails de todos los leads con web pero sin correo"
                  >
                    {discoveringAll ? (
                      <><Loader2 size={18} className="animate-spin-slow" /> Descubriendo...</>
                    ) : (
                      <><Compass size={18} /> Descubrir todos</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {selectedLeadIds.size > 0 && (
              <div className="bulk-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', margin: '1rem 0', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-primary)' }}><strong>{selectedLeadIds.size}</strong> seleccionados</span>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-danger" onClick={handleOpenBulkDeleteConfirm}>
                    <Trash2 size={14} /> Eliminar seleccionados
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedLeadIds(new Set())}>
                    Cancelar selección
                  </button>
                </div>
              </div>
            )}

            {filteredAndSortedLeads.length > 0 ? (
              <>
                <div className="table-wrapper">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={currentItems.length > 0 && currentItems.every(lead => selectedLeadIds.has(lead.id))}
                            onChange={toggleSelectAllVisible}
                          />
                        </th>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Calificación</th>
                        <th>Sitio Web</th>
                        <th>Correos Electrónicos</th>
                        <th>Redes Sociales</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((lead, idx) => (
                        <tr key={lead.placeId || idx}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.has(lead.id)}
                              onChange={() => toggleLeadSelection(lead.id)}
                            />
                          </td>
                          <td className="lead-name-cell">
                            {lead.name}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '0.2rem' }}>
                              {lead.address}
                            </div>
                            {(lead.lastEmailSent || lead.emailSentAt) && (
                              <div style={{ fontSize: '0.72rem', color: 'rgb(96, 165, 250)', fontWeight: 500, marginTop: '0.3rem' }}>
                                Último envío: {new Date(lead.lastEmailSent || lead.emailSentAt).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td>
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Phone size={14} className="text-secondary" />
                                {lead.phone}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            {lead.rating ? (
                              <span className="rating-badge">
                                <Star size={12} fill="currentColor" />
                                {lead.rating}
                                <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>({lead.reviews})</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Globe size={14} />
                                Enlace Web
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No disponible</span>
                            )}
                          </td>
                          <td>
                            {lead.emails && lead.emails.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {lead.emails.map((email, eIdx) => (
                                  <span key={eIdx} className="email-tag">
                                    <Mail size={12} />
                                    {email}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            <div className="social-links">
                              {lead.socials?.facebook && (
                                <a href={lead.socials.facebook} target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="Facebook">
                                  <Facebook size={14} />
                                </a>
                              )}
                              {lead.socials?.instagram && (
                                <a href={lead.socials.instagram} target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="Instagram">
                                  <Instagram size={14} />
                                </a>
                              )}
                              {lead.socials?.linkedin && (
                                <a href={lead.socials.linkedin} target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="LinkedIn">
                                  <Linkedin size={14} />
                                </a>
                              )}
                              {lead.socials?.twitter && (
                                <a href={lead.socials.twitter} target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="Twitter/X">
                                  <Twitter size={14} />
                                </a>
                              )}
                              {!lead.socials?.facebook && !lead.socials?.instagram && !lead.socials?.linkedin && !lead.socials?.twitter && (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'stretch', width: '100%', minWidth: '130px' }}>
                              <a href={lead.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                Ver en Maps
                                <ExternalLink size={12} />
                              </a>
                              {lead.website && (() => {
                                const leadId = lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
                                const isDiscovering = discoveringIds.has(leadId);
                                const isSocial = isSocialUrl(lead.website);
                                return isDiscovering ? (
                                  <span style={{ color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.78rem' }}>
                                    <Loader2 size={12} className="animate-spin-slow" />
                                    Descubriendo...
                                  </span>
                                ) : isSocial ? (
                                  <button
                                    className="btn-discover"
                                    onClick={() => handleDiscoverSocial(lead)}
                                    title="Capturar página de red social y extraer contactos con IA"
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                  >
                                    <Camera size={12} />
                                    Descubrir (Visión)
                                  </button>
                                ) : (
                                  <button
                                    className="btn-discover"
                                    onClick={() => handleDiscover(lead)}
                                    title="Buscar correos y redes sociales en el sitio web"
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                  >
                                    <Compass size={12} />
                                    Descubrir
                                  </button>
                                );
                              })()}
                              <button
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  fontSize: '0.8rem',
                                  borderColor: lead.emailSent ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                                  background: lead.emailSent ? 'rgba(16,185,129,0.05)' : 'transparent',
                                  color: lead.emailSent ? 'var(--success)' : 'var(--text-primary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem'
                                }}
                                onClick={() => handleOpenSendEmailModal(lead)}
                                title="Enviar correo a este negocio"
                              >
                                <Mail size={12} />
                                {lead.emailSent ? 'Reenviar' : 'Enviar correo'}
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  fontSize: '0.8rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem'
                                }}
                                onClick={() => handleOpenEditLeadModal(lead)}
                                title="Agregar o editar correos manualmente"
                              >
                                <PlusCircle size={12} />
                                Editar
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  fontSize: '0.8rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                  borderColor: 'rgba(239,68,68,0.3)',
                                  color: 'rgba(239,68,68,0.85)'
                                }}
                                onClick={() => handleDeleteLead(lead)}
                                title="Eliminar este negocio"
                              >
                                <Trash2 size={12} />
                                Eliminar
                              </button>
                              {lead.emailSent && null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="pagination-container">
                  <div className="pagination-info">
                    Mostrando <strong>{indexOfFirstItem + 1}</strong> a <strong>{Math.min(indexOfLastItem, filteredAndSortedLeads.length)}</strong> de <strong>{filteredAndSortedLeads.length}</strong> leads
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="btn-page" 
                      onClick={() => setCurrentPage(1)} 
                      disabled={currentPage === 1}
                      title="Primera página"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button 
                      className="btn-page" 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                      disabled={currentPage === 1}
                      title="Página anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = Math.max(1, totalPages - 4 + i);
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      if (pageNum < 1 || pageNum > totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          className={`btn-page ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button 
                      className="btn-page" 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                      disabled={currentPage === totalPages}
                      title="Página siguiente"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button 
                      className="btn-page" 
                      onClick={() => setCurrentPage(totalPages)} 
                      disabled={currentPage === totalPages}
                      title="Última página"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                  <div className="pagination-limit">
                    <span>Mostrar:</span>
                    <select 
                      className="select-limit" 
                      value={itemsPerPage} 
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5 por pág.</option>
                      <option value={10}>10 por pág.</option>
                      <option value={25}>25 por pág.</option>
                      <option value={50}>50 por pág.</option>
                      <option value={100}>100 por pág.</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Search size={48} className="empty-state-icon" />
                <h3>No hay leads cargados</h3>
                <p>Ingresa una categoría de negocio y ciudad para iniciar el escaneo de prospectos.</p>
              </div>
            )}
          </section>
        </>
      ) : activeTab === 'templates' ? (
        /* Pestaña de Plantillas */
        <section className="card">
          <div className="templates-layout">
            {/* Sidebar listado */}
            <div className="templates-sidebar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedTemplate(null);
                  setEditorTemplate({ id: '', name: 'Nueva Plantilla', subject: 'Contacto - {{companyName}}', bodyHtml: '<h2>Hola {{companyName}}</h2>\n<p>Escribe tu contenido aquí...</p>' });
                }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Plus size={16} />
                Nueva Plantilla
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', overflowY: 'auto', maxHeight: '500px' }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`template-item ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTemplate(t);
                      setEditorTemplate(t);
                    }}
                  >
                    <span className="template-name">{t.name}</span>
                    <span className="template-subject">{t.subject}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel principal editor / previsualizador */}
            <div className="templates-main">
              <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2>{editorTemplate.id ? 'Editar Plantilla' : 'Crear Nueva Plantilla'}</h2>
                {editorTemplate.id && editorTemplate.id !== 'consultoria-ai-bot' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDeleteTemplate(editorTemplate.id)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    <Trash size={14} />
                    Eliminar
                  </button>
                )}
              </div>

              <div className="template-editor-grid">
                {/* Formulario */}
                <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Nombre de la Plantilla</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ej: Seguimiento o Propuesta Comercial"
                      value={editorTemplate.name}
                      onChange={e => setEditorTemplate(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Asunto (Soporta variables)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ej: Impulsa tu negocio - {{companyName}}"
                      value={editorTemplate.subject}
                      onChange={e => setEditorTemplate(prev => ({ ...prev, subject: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label className="input-label" style={{ display: 'flex', justifyContext: 'space-between', width: '100%' }}>
                      <span>Contenido HTML</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Variables: {"{{companyName}}, {{phone}}, {{website}}, {{address}}"}
                      </span>
                    </label>
                    <textarea
                      className="input-field"
                      style={{ height: '300px', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4', resize: 'vertical' }}
                      placeholder="Escribe tu HTML estructurado aquí..."
                      value={editorTemplate.bodyHtml}
                      onChange={e => setEditorTemplate(prev => ({ ...prev, bodyHtml: e.target.value }))}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingTemplate}
                    style={{ width: 'fit-content', marginTop: '0.5rem' }}
                  >
                    {savingTemplate ? <Loader2 size={16} className="animate-spin-slow" /> : <CheckCircle2 size={16} />}
                    Guardar Plantilla
                  </button>
                </form>

                {/* Previsualización en Vivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Eye size={14} style={{ color: 'var(--accent-primary)' }} />
                    Vista Previa en Vivo (Simulador de Inbox)
                  </label>
                  <div className="email-preview-container">
                    <div className="email-preview-header">
                      <div className="email-preview-field">
                        <span className="email-preview-label">De:</span>
                        <span className="email-preview-value">
                          {socialConfig.emailService === 'sendgrid' ? (socialConfig.sendgridFrom || 'no-configurado@sendgrid.com') : 
                           socialConfig.emailService === 'resend' ? (socialConfig.resendFrom || 'onboarding@resend.dev') : 
                           (socialConfig.smtpFrom || 'no-configurado@smtp.com')}
                        </span>
                      </div>
                      <div className="email-preview-field">
                        <span className="email-preview-label">Para:</span>
                        <span className="email-preview-value">prospecto-ejemplo@correo.com</span>
                      </div>
                      <div className="email-preview-field">
                        <span className="email-preview-label">Asunto:</span>
                        <span className="email-preview-value" style={{ fontWeight: 600 }}>
                          {compileFrontendTemplate(editorTemplate, { name: 'Clinica Dental Sol', phone: '+34 912 345 678', website: 'https://dentalsol.com', address: 'Madrid' }).subject}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: '#fff', border: 'none' }}>
                      <iframe
                        title="Live Email Preview"
                        className="email-preview-iframe"
                        srcDoc={compileFrontendTemplate(editorTemplate, { name: 'Clinica Dental Sol', phone: '+34 912 345 678', website: 'https://dentalsol.com', address: 'Madrid' }).bodyHtml}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {showSendAllModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="card" style={{ width: 'min(900px, 100%)', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Enviar correo a todos los leads</h2>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Encola un correo para cada lead que tenga al menos un email válido.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSendAllModal(false)}>
                <X size={16} /> Cerrar
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label className="input-label">Plantilla</label>
                  <select
                    className="input-field"
                    value={sendAllTemplateId}
                    onChange={e => handleSendAllTemplateChange(e.target.value)}
                  >
                    <option value="">— Sin plantilla (contenido personalizado) —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Asunto</label>
                  <input
                    type="text"
                    className="input-field"
                    value={sendAllSubject}
                    onChange={e => setSendAllSubject(e.target.value)}
                    placeholder="Asunto del correo masivo..."
                  />
                </div>
                <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="input-label">Contenido HTML</label>
                  <textarea
                    className="input-field"
                    style={{ height: '260px', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.5' }}
                    value={sendAllBody}
                    onChange={e => setSendAllBody(e.target.value)}
                    placeholder="Texto HTML o plantilla para el envío masivo..."
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendAll}
                  disabled={sendingAllEmails || leadsWithEmail === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                >
                  {sendingAllEmails ? (
                    <><Loader2 size={16} className="animate-spin-slow" /> Encolando...</>
                  ) : (
                    <><Send size={16} /> Encolar todos</>
                  )}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Resumen de envíos</h3>
                  <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                    Total leads con correo: <strong>{leadsWithEmail}</strong>
                  </p>
                  <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                    Correo seleccionado: <strong>{socialConfig.emailService === 'resend' ? 'Resend' : socialConfig.emailService === 'sendgrid' ? 'SendGrid' : 'SMTP'}</strong>
                  </p>
                  <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                    Cola actual: <strong>{emailQueueStats.pending}</strong> pendientes, <strong>{emailQueueStats.processing}</strong> en proceso, <strong>{emailQueueStats.failed}</strong> fallidos.
                  </p>
                </div>
                <div className="card" style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Notas</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    <li>Si usas Resend en modo gratuito, solo podrás enviar a emails verificados en Resend.</li>
                    <li>Para enviar a todos, asegúrate de que cada lead tenga al menos un correo válido.</li>
                    <li>Los envíos se procesan en segundo plano; revisa la cola para el estado.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="card" style={{ width: 'min(520px, 100%)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Confirmar eliminación</h2>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  ¿Seguro que quieres eliminar el lead “{deleteCandidateLead?.name}”? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelDeleteLead}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteLead}>
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="card" style={{ width: 'min(520px, 100%)', position: 'relative' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Confirmar eliminación masiva</h2>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                ¿Estás seguro de que deseas eliminar <strong>{selectedLeadIds.size}</strong> leads seleccionados? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelBulkDelete}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleBulkDeleteSelected}>
                Eliminar seleccionados
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditLeadModal && editLead && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="card" style={{ width: 'min(520px, 100%)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Editar contacto</h2>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Actualiza el sitio web o los emails del lead. Los emails existentes se conservarán y los nuevos se añadirán.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleCloseEditLeadModal}>
                <X size={16} /> Cerrar
              </button>
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Lead</label>
              <input type="text" className="input-field" value={editLead.name || ''} disabled />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Sitio web</label>
              <input
                type="text"
                className="input-field"
                value={editLeadWebsite}
                onChange={e => setEditLeadWebsite(e.target.value)}
                placeholder="https://empresa.com o mailto:contacto@empresa.com"
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Si el campo contiene un correo, se guardará como email en su lugar.
              </p>
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Emails actuales</label>
              <textarea
                className="input-field"
                style={{ height: '180px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.4' }}
                value={editLeadEmailsText}
                onChange={e => setEditLeadEmailsText(e.target.value)}
                placeholder="Introduce correos separados por salto de línea, coma o punto y coma (opcional)"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCloseEditLeadModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEditedLeadEmails} disabled={editLeadSaving}>
                {editLeadSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agent' && (
        <section className="card" style={{ padding: '1.5rem' }}>
          {/* Header del Agente */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Bot size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Agente Autónomo</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Escaneo automatizado estado por estado, municipio por municipio
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {agentStatus.running ? (
                <>
                  <button className="btn btn-secondary" onClick={handleAgentPause} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {agentStatus.paused ? <Play size={14} /> : <Pause size={14} />}
                    {agentStatus.paused ? 'Reanudar' : 'Pausar'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleAgentStop} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#ef4444' }}>
                    <Square size={14} />
                    Detener
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => handleAgentStart(false)} disabled={agentStarting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {agentStarting ? <Loader2 size={14} className="animate-spin-slow" /> : <Play size={14} />}
                    {agentStatus.jobs.totalJobs > 0 ? 'Continuar' : 'Iniciar'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleAgentStart(true)} disabled={agentStarting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }} title="Regenerar cola de jobs">
                    <RefreshCw size={14} />
                    Reiniciar Cola
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: agentStatus.running ? (agentStatus.paused ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)') : 'rgba(100,116,139,0.1)', border: `1px solid ${agentStatus.running ? (agentStatus.paused ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)') : 'rgba(100,116,139,0.2)'}` }}>
            <Activity size={16} style={{ color: agentStatus.running ? (agentStatus.paused ? '#f59e0b' : '#22c55e') : '#64748b' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: agentStatus.running ? (agentStatus.paused ? '#f59e0b' : '#22c55e') : '#64748b' }}>
              {agentStatus.running ? (agentStatus.paused ? 'Pausado' : 'Ejecutando') : 'Detenido'}
            </span>
            {agentStatus.currentJob && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                — Buscando "{agentStatus.currentJob.category}" en {agentStatus.currentJob.municipality}, {agentStatus.currentJob.state}
              </span>
            )}
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6366f1' }}>{agentStatus.jobs.totalJobs}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Total Jobs</div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{agentStatus.jobs.completed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Completados</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{agentStatus.jobs.pending + agentStatus.jobs.retry}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Pendientes</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{agentStatus.jobs.failed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Fallidos</div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{agentStatus.jobs.totalLeads}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Leads Encontrados</div>
            </div>
            <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a855f7' }}>{agentStatus.jobs.totalEmails}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Emails Enviados</div>
            </div>
          </div>

          {/* Daily Stats */}
          {Object.keys(agentStatus.daily).length > 0 && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Clock size={14} /> Actividad de Hoy
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {agentStatus.daily.searches != null && <span style={{ fontSize: '0.8rem' }}>🔍 Búsquedas: <strong>{agentStatus.daily.searches}/150</strong></span>}
                {agentStatus.daily.emails_sent != null && <span style={{ fontSize: '0.8rem' }}>📧 Emails: <strong>{agentStatus.daily.emails_sent}/80</strong></span>}
                {agentStatus.daily.crawls != null && <span style={{ fontSize: '0.8rem' }}>🌐 Crawls: <strong>{agentStatus.daily.crawls}/500</strong></span>}
                {agentStatus.daily.vision_calls != null && <span style={{ fontSize: '0.8rem' }}>📸 Vision: <strong>{agentStatus.daily.vision_calls}/100</strong></span>}
                {agentStatus.daily.errors != null && <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>❌ Errores: <strong>{agentStatus.daily.errors}/30</strong></span>}
              </div>
            </div>
          )}

          {/* Progress by State */}
          {agentProgress.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <MapPinned size={14} /> Progreso por Estado
              </h3>
              <div style={{ maxHeight: '250px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {agentProgress.map(item => {
                  const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                  return (
                    <div key={item.state} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.8rem', minWidth: '140px', color: 'var(--text-primary)' }}>{item.state}</span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
                        {item.completed}/{item.total}
                      </span>
                      {item.failed > 0 && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>({item.failed} err)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Failed jobs retry button */}
          {agentStatus.jobs.failed > 0 && !agentStatus.running && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                <AlertTriangle size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                {agentStatus.jobs.failed} jobs fallidos
              </span>
              <button className="btn btn-secondary" onClick={handleAgentRetryFailed} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                <RefreshCw size={12} style={{ marginRight: '0.3rem' }} />
                Reintentar
              </button>
            </div>
          )}

          {/* Recent Errors */}
          {agentStatus.recentErrors && agentStatus.recentErrors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={14} /> Errores Recientes
              </h3>
              <div style={{ maxHeight: '150px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.03)' }}>
                {agentStatus.recentErrors.map((err, i) => (
                  <div key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(239,68,68,0.08)', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>[{err.phase}]</span>{' '}
                    <span style={{ color: '#ef4444' }}>{err.message}</span>
                    {err.municipality && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>— {err.municipality}, {err.state}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Logs */}
          <div>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Zap size={14} /> Actividad en Tiempo Real
            </h3>
            <div style={{ height: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '1.6', border: '1px solid rgba(255,255,255,0.06)' }}>
              {agentLogs.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                  Inicia el agente para ver la actividad aquí...
                </p>
              )}
              {agentLogs.map((log, i) => (
                <div key={i} style={{ color: log.type === 'error' ? '#ef4444' : 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{log.time}</span>
                  {log.text}
                </div>
              ))}
              <div ref={agentLogEndRef} />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'send-email' && sendLead && (
        <section className="card">
          {/* Cabecera de la vista */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setActiveTab('scan'); setSendLead(null); }}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ChevronLeft size={16} />
              Volver
            </button>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Mail size={20} style={{ color: 'var(--accent-primary)' }} />
                Enviar Correo
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Destinatario: <strong style={{ color: 'var(--text-primary)' }}>{sendLead.name}</strong>
                {sendLead.address && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>— {sendLead.address}</span>}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendEmail}
              disabled={sendingEmail || !sendRecipientEmail}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.4rem' }}
            >
              {sendingEmail ? (
                <>
                  <Loader2 size={16} className="animate-spin-slow" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Enviar Correo
                </>
              )}
            </button>
          </div>

          {/* Cuerpo en dos columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '2rem', alignItems: 'start' }}>

            {/* Columna Izquierda: Configuración */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Destinatario */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} style={{ color: 'var(--accent-primary)' }} />
                  Correo Destinatario
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="correo@empresa.com"
                  value={sendRecipientEmail}
                  onChange={e => setSendRecipientEmail(e.target.value)}
                />
                {sendLead.emails && sendLead.emails.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Detectados:</span>
                    {sendLead.emails.map(email => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => setSendRecipientEmail(email)}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.6rem',
                          background: sendRecipientEmail === email ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${sendRecipientEmail === email ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '20px',
                          color: sendRecipientEmail === email ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {email}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Plantilla */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent-secondary)' }} />
                  Plantilla
                </label>
                <select
                  className="input-field"
                  value={sendSelectedTemplateId}
                  onChange={e => handleTemplateChangeInModal(e.target.value)}
                >
                  <option value="">— Sin plantilla (contenido personalizado) —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Asunto */}
              <div className="input-group">
                <label className="input-label">Asunto</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Asunto del correo..."
                  value={sendCustomSubject}
                  onChange={e => setSendCustomSubject(e.target.value)}
                />
              </div>

              {/* HTML */}
              <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="input-label">Contenido HTML</label>
                <textarea
                  className="input-field"
                  style={{ height: '340px', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.5', resize: 'vertical' }}
                  value={sendCustomBody}
                  onChange={e => setSendCustomBody(e.target.value)}
                />
              </div>
            </div>

            {/* Columna Derecha: Previsualización */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'sticky', top: '1rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Eye size={14} style={{ color: 'var(--accent-primary)' }} />
                Vista Previa del Correo
              </label>
              <div className="email-preview-container" style={{ flex: 1 }}>
                <div className="email-preview-header">
                  <div className="email-preview-field">
                    <span className="email-preview-label">De:</span>
                    <span className="email-preview-value">
                      {socialConfig.emailService === 'sendgrid' ? (socialConfig.sendgridFrom || 'no configurado') :
                       socialConfig.emailService === 'resend' ? (socialConfig.resendFrom || 'onboarding@resend.dev') :
                       (socialConfig.smtpFrom || 'no configurado')}
                    </span>
                  </div>
                  <div className="email-preview-field">
                    <span className="email-preview-label">Para:</span>
                    <span className="email-preview-value" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                      {sendRecipientEmail || <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>sin destinatario</em>}
                    </span>
                  </div>
                  <div className="email-preview-field">
                    <span className="email-preview-label">Asunto:</span>
                    <span className="email-preview-value" style={{ fontWeight: 600 }}>{sendCustomSubject || '—'}</span>
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                  <iframe
                    title="Vista previa de correo"
                    className="email-preview-iframe"
                    style={{ height: '480px' }}
                    srcDoc={sendCustomBody || '<p style="font-family:sans-serif;color:#888;padding:2rem">El contenido HTML del correo aparecerá aquí...</p>'}
                  />
                </div>
              </div>
            </div>

          </div>
        </section>
      )}
    </div>
  );
}
