import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLeads, saveLeads, clearLeads, replaceLeads, deleteLeads, updateLeadEmails, updateLeadById } from './database.js';
import { scrapeGoogleMaps } from './scraper.js';
import { crawlWebsite } from './crawler.js';
import {
  openLoginBrowser,
  closeLoginBrowser,
  scrapeWithVision,
  hasSession,
  getLoginStatus,
  loadConfig,
  saveConfig,
} from './social-crawler.js';
import { sendEmail } from './email-sender.js';
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  compileTemplate
} from './templates.js';
import {
  enqueueEmailJob,
  getPendingEmailJobs,
  markEmailJobProcessing,
  markEmailJobSent,
  markEmailJobFailed,
  getEmailQueueStats,
  markLeadEmailSent
} from './sqlite-db.js';
import {
  startAgent,
  stopAgent,
  pauseAgent,
  getAgentStatus,
  onAgentEvent,
} from './agent.js';
import { getJobStats, getProgressByState, getJobs, resetFailedJobs, clearAllJobs, getRecentErrors } from './agent-db.js';
import { DEFAULT_CATEGORIES } from './agent-config.js';
import { getStates, getMunicipalities, getTotalMunicipalities } from './geo-data.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend en producción
app.use(express.static(path.join(__dirname, '../dist')));

// Lista de clientes conectados a Server-Sent Events (SSE)
let sseClients = [];

// Estado global del escaneo actual
let activeScan = {
  running: false,
  query: '',
  limit: 20,
  progress: 0,
  status: 'idle',
  message: 'Listo para escanear'
};

// Flag para solicitar detención del escaneo en curso
let stopRequested = false;

/**
 * Envía un evento a todos los clientes SSE conectados
 */
function broadcast(event, data) {
  sseClients.forEach(client => {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// --- Endpoints de la API ---

// 1. Obtener estado de la transmisión en tiempo real (SSE)
app.get('/api/scan/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Registrar cliente
  sseClients.push(res);
  
  // Enviar estado actual de inmediato
  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify(activeScan)}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// 2. Obtener todos los leads guardados
app.get('/api/leads', (req, res) => {
  res.json(getLeads());
});

// 3. Limpiar todos los leads
app.post('/api/leads/clear', (req, res) => {
  if (activeScan.running) {
    return res.status(400).json({ error: 'No se puede limpiar la base de datos mientras hay un escaneo activo.' });
  }
  const cleared = clearLeads();
  res.json({ message: 'Base de datos limpia con éxito.', leads: cleared });
});

// 3b. Eliminar un lead individual por ID
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const searchId = Number(id);
  const allLeads = getLeads();
  const newLeads = allLeads.filter(l => {
    const leadId = l.placeId || `${l.name}_${l.phone || l.address}`;
    return !(l.id === searchId || leadId === id);
  });
  if (newLeads.length === allLeads.length) {
    return res.status(404).json({ error: 'Lead no encontrado.' });
  }
  const saved = replaceLeads(newLeads);
  broadcast('leads', saved);
  res.json({ message: 'Lead eliminado.', leads: saved });
});

// 3c. Eliminar varios leads seleccionados
app.post('/api/leads/delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No se recibieron IDs de leads para eliminar.' });
  }
  const saved = deleteLeads(ids);
  broadcast('leads', saved);
  res.json({ message: `${ids.length} leads eliminados.`, leads: saved });
});

// 3d. Actualizar emails para un lead individual
app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const { emails, website } = req.body;
  if (emails !== undefined && !Array.isArray(emails)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de emails.' });
  }

  if (website === undefined && emails === undefined) {
    return res.status(400).json({ error: 'No se recibieron datos para actualizar.' });
  }

  const updates = {};
  if (website !== undefined) updates.website = website;
  if (emails !== undefined) updates.emails = emails;

  const updatedLead = updateLeadById(Number(id), updates);
  if (!updatedLead) {
    return res.status(404).json({ error: 'Lead no encontrado o datos inválidos.' });
  }
  broadcast('leads', getLeads());
  res.json({ message: 'Lead actualizado.', lead: updatedLead });
});

// 4. Detener escaneo en curso
app.post('/api/scan/stop', (req, res) => {
  if (!activeScan.running) {
    return res.status(400).json({ error: 'No hay ningún escaneo activo.' });
  }
  stopRequested = true;
  activeScan.message = 'Detención solicitada, finalizando operación actual...';
  broadcast('status', activeScan);
  res.json({ message: 'Solicitud de detención enviada.' });
});

// 5. Iniciar escaneo de Google Maps y rastreo de correos
app.post('/api/scan', async (req, res) => {
  const { query, limit } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'El término de búsqueda (query) es requerido.' });
  }

  if (activeScan.running) {
    return res.status(400).json({ error: 'Ya hay un escaneo en ejecución.' });
  }

  const limitNumber = parseInt(limit, 10) || 20;

  // Responder inmediatamente que el proceso ha comenzado
  res.json({ message: 'Escaneo iniciado con éxito.' });

  // Ejecutar proceso de scraping en segundo plano
  (async () => {
    stopRequested = false; // Resetear flag al iniciar
    activeScan = {
      running: true,
      query,
      limit: limitNumber,
      progress: 0,
      status: 'scraping',
      message: 'Iniciando navegador automatizado...'
    };
    broadcast('status', activeScan);

    try {
      // Obtener keys existentes en base de datos para no repetirlos
      const existingLeads = getLeads();
      const existingKeys = new Set();
      existingLeads.forEach(lead => {
        if (lead.placeId) existingKeys.add(lead.placeId);
        if (lead.name) existingKeys.add(lead.name.trim());
      });

      // FASE 1: Scrapear Google Maps
      const mapsLeads = await scrapeGoogleMaps(query, limitNumber, (update) => {
        // Callback para actualizar progreso de scraping
        activeScan.message = update.message;
        if (update.progress !== undefined) {
          activeScan.progress = update.progress;
        }
        activeScan.status = update.status === 'success' ? 'crawling' : 'scraping';
        broadcast('status', activeScan);
      }, () => stopRequested, existingKeys); // Pasar verificador de parada y keys existentes

      // Guardar resultados iniciales de Maps (sin emails todavía)
      const savedLeads = saveLeads(mapsLeads);
      broadcast('leads', savedLeads);

      // Finalizar escaneo (solo fase de Maps)
      const wasStoped = stopRequested;
      stopRequested = false;

      // Enviar divisor estético a la consola
      activeScan.message = '==================================================';
      broadcast('status', activeScan);

      const totalLeadsNow = getLeads().length;
      const finalMsg = wasStoped
        ? `🛑 PROCESO DETENIDO POR EL USUARIO. Parada segura. Total leads guardados: ${totalLeadsNow}`
        : `✨ ¡ESCANEO FINALIZADO CON ÉXITO! Base de datos actualizada. Total leads en lista: ${totalLeadsNow}`;

      activeScan = {
        running: false,
        query: '',
        limit: 20,
        progress: wasStoped ? activeScan.progress : 100,
        status: wasStoped ? 'stopped' : 'completed',
        message: finalMsg
      };
      broadcast('status', activeScan);

    } catch (error) {
      console.error('Error durante el proceso de escaneo:', error);
      
      // Enviar divisor estético a la consola
      activeScan.message = '==================================================';
      broadcast('status', activeScan);

      activeScan = {
        running: false,
        query: '',
        limit: 20,
        progress: 0,
        status: 'error',
        message: `❌ ERROR EN EL ESCANEO: ${error.message}`
      };
      broadcast('status', activeScan);
    }
  })();
});

// 6. Descubrir emails/redes sociales de un lead específico (manual)
app.post('/api/leads/discover/:id', async (req, res) => {
  const { id } = req.params;
  const searchId = Number(id);
  const allLeads = getLeads();
  const lead = allLeads.find(l => l.id === searchId || l.placeId === id || `${l.name}_${l.phone || l.address}` === id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead no encontrado.' });
  }
  if (!lead.website) {
    return res.status(400).json({ error: 'Este lead no tiene sitio web para rastrear.' });
  }

  // Responder inmediatamente que el proceso ha comenzado
  res.json({ message: 'Descubrimiento iniciado.', leadId: id });

  // Ejecutar crawl en segundo plano y transmitir resultado
  (async () => {
    broadcast('status', {
      ...activeScan,
      message: `🔍 Descubriendo contactos de: ${lead.name} (${lead.website})`
    });

    try {
      const contactInfo = await crawlWebsite(lead.website);

      if (contactInfo._note) {
        // Es una red social — hacer fallback automático a Visión IA
        broadcast('status', {
          ...activeScan,
          message: `📸 "${lead.name}" tiene red social como web. Usando Visión IA automáticamente...`
        });
        try {
          const visionInfo = await scrapeWithVision(lead.website);
          if (visionInfo.emails?.length) lead.emails = visionInfo.emails;
          if (visionInfo.phone && !lead.phone) lead.phone = visionInfo.phone;
          if (visionInfo.address && !lead.address) lead.address = visionInfo.address;
          // Guardar el enlace social en socials
          lead.socials = { ...(lead.socials || {}), ...contactInfo.socials };

          const updatedLeads = saveLeads([lead]);
          broadcast('leads', updatedLeads);

          const found = [
            visionInfo.emails?.length ? `${visionInfo.emails.length} correo(s)` : null,
            visionInfo.phone ? 'teléfono' : null,
          ].filter(Boolean);

          broadcast('status', {
            ...activeScan,
            message: found.length > 0
              ? `✅ Visión IA encontró para "${lead.name}": ${found.join(', ')}.`
              : `⚠️ La IA no detectó información de contacto en la captura de "${lead.name}".`
          });
        } catch (visionErr) {
          // Si no hay sesión o falla visión, guardar al menos el enlace social
          lead.socials = { ...(lead.socials || {}), ...contactInfo.socials };
          saveLeads([lead]);
          broadcast('status', {
            ...activeScan,
            message: `⚠️ "${lead.name}" es red social pero Visión IA no está disponible: ${visionErr.message}`
          });
        }
        return;
      }

      lead.emails = contactInfo.emails;
      lead.socials = contactInfo.socials;

      const updatedLeads = saveLeads([lead]);
      broadcast('leads', updatedLeads);

      const emailsFound = contactInfo.emails.length;
      const hasSocials = Object.values(contactInfo.socials || {}).some(v => v);

      let msg;
      if (emailsFound > 0) {
        msg = `✅ Descubierto para "${lead.name}": ${emailsFound} correo(s) encontrado(s).`;
      } else if (hasSocials) {
        msg = `🔗 Se encontraron redes sociales para "${lead.name}" pero no correos electrónicos.`;
      } else {
        msg = `⚠️ No se encontró información de contacto en el sitio de "${lead.name}".`;
      }

      broadcast('status', { ...activeScan, message: msg });
    } catch (err) {
      console.error(`Error rastreando ${lead.website}:`, err);
      broadcast('status', {
        ...activeScan,
        message: `❌ Error al rastrear "${lead.name}": ${err.message}`
      });
    }
  })();
});

// 6b. Descubrir contactos de TODOS los leads sin email que tengan web (encolado secuencial)
app.post('/api/leads/discover-all', async (req, res) => {
  const allLeads = getLeads();
  const pending = allLeads.filter(l =>
    l.website && l.website.trim() &&
    (!Array.isArray(l.emails) || l.emails.length === 0)
  );

  if (pending.length === 0) {
    return res.status(400).json({ error: 'No hay leads con sitio web pendientes de descubrimiento.' });
  }

  res.json({ message: `Descubrimiento masivo iniciado para ${pending.length} leads.`, total: pending.length });

  (async () => {
    broadcast('status', {
      ...activeScan,
      message: `🔍 Iniciando descubrimiento masivo: ${pending.length} leads pendientes...`
    });

    let found = 0;
    let removed = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const lead = pending[i];
      broadcast('status', {
        ...activeScan,
        message: `🔍 Descubriendo (${i + 1}/${pending.length}): ${lead.name}`
      });

      try {
        const contactInfo = await crawlWebsite(lead.website);

        if (contactInfo._note) {
          // Es red social — intentar Visión IA automáticamente
          broadcast('status', {
            ...activeScan,
            message: `📸 (${i + 1}/${pending.length}) "${lead.name}" es red social. Intentando Visión IA...`
          });
          let gotEmail = false;
          try {
            const visionInfo = await scrapeWithVision(lead.website);
            if (visionInfo.emails?.length) {
              lead.emails = visionInfo.emails;
              gotEmail = true;
            }
            if (visionInfo.phone && !lead.phone) lead.phone = visionInfo.phone;
            if (visionInfo.address && !lead.address) lead.address = visionInfo.address;
            lead.socials = { ...(lead.socials || {}), ...contactInfo.socials };
            saveLeads([lead]);
          } catch (visionErr) {
            // Visión IA no disponible — tratar como sin correo
            lead.socials = { ...(lead.socials || {}), ...contactInfo.socials };
            saveLeads([lead]);
          }

          if (gotEmail) {
            found++;
            const updatedLeads = getLeads();
            broadcast('leads', updatedLeads);
            broadcast('status', {
              ...activeScan,
              message: `✅ (${i + 1}/${pending.length}) Visión IA encontró ${lead.emails.length} correo(s) para "${lead.name}".`
            });
          } else {
            // Sin correo tras intentar visión IA — eliminar lead
            removed++;
            const remainingLeads = deleteLeads([lead.id]);
            broadcast('leads', remainingLeads);
            broadcast('status', {
              ...activeScan,
              message: `🗑️ (${i + 1}/${pending.length}) "${lead.name}" eliminado: sin correo encontrado tras Visión IA.`
            });
          }
          continue;
        }

        // Web normal — resultado del crawler
        if (contactInfo.emails.length > 0) {
          lead.emails = contactInfo.emails;
          lead.socials = { ...(lead.socials || {}), ...contactInfo.socials };
          found++;
          saveLeads([lead]);
          const updatedLeads = getLeads();
          broadcast('leads', updatedLeads);
          broadcast('status', {
            ...activeScan,
            message: `✅ (${i + 1}/${pending.length}) "${lead.name}": ${contactInfo.emails.length} correo(s) encontrado(s).`
          });
        } else {
          // Sin correo — eliminar lead
          removed++;
          const remainingLeads = deleteLeads([lead.id]);
          broadcast('leads', remainingLeads);
          broadcast('status', {
            ...activeScan,
            message: `🗑️ (${i + 1}/${pending.length}) "${lead.name}" eliminado: sin correo en su sitio web.`
          });
        }
      } catch (err) {
        failed++;
        broadcast('status', {
          ...activeScan,
          message: `❌ (${i + 1}/${pending.length}) Error en "${lead.name}": ${err.message}`
        });
      }
    }

    broadcast('status', {
      ...activeScan,
      message: `✨ Descubrimiento masivo finalizado. ${found} con correo · ${removed} eliminados · ${failed} errores · de ${pending.length} procesados.`
    });
  })();
});

// 7. Exportar Leads a CSV
app.get('/api/leads/export', (req, res) => {
  try {
    const leads = getLeads();
    
    // Encabezados del CSV
    const headers = ['Nombre', 'Teléfono', 'Sitio Web', 'Correos Electrónicos', 'Dirección', 'Calificación', 'Reseñas', 'Facebook', 'Instagram', 'LinkedIn', 'Twitter/X', 'Enlace Google Maps', 'Fecha de Escaneo'];
    
    // Filas de datos
    const rows = leads.map(lead => [
      `"${(lead.name || '').replace(/"/g, '""')}"`,
      `"${(lead.phone || '').replace(/"/g, '""')}"`,
      `"${(lead.website || '').replace(/"/g, '""')}"`,
      `"${(lead.emails || []).join(', ')}"`,
      `"${(lead.address || '').replace(/"/g, '""')}"`,
      `"${lead.rating || ''}"`,
      `"${lead.reviews || ''}"`,
      `"${(lead.socials?.facebook || '').replace(/"/g, '""')}"`,
      `"${(lead.socials?.instagram || '').replace(/"/g, '""')}"`,
      `"${(lead.socials?.linkedin || '').replace(/"/g, '""')}"`,
      `"${(lead.socials?.twitter || '').replace(/"/g, '""')}"`,
      `"${lead.url || ''}"`,
      `"${lead.scannedAt || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Agregar UTF-8 BOM (\uFEFF) al inicio del archivo para garantizar la compatibilidad con acentos y caracteres especiales en Excel
    const bomCsvContent = '\uFEFF' + csvContent;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_scan_zone.csv');
    res.send(bomCsvContent);
  } catch (error) {
    console.error('Error al exportar CSV:', error);
    res.status(500).json({ error: 'Error al generar la exportación CSV.' });
  }
});

// 8. Obtener configuración (Gemini/Groq API key, proveedor, estado de sesión y ajustes de correo)
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json({
    provider: config.provider || 'gemini',
    hasGeminiKey: !!config.geminiApiKey,
    hasGroqKey: !!config.groqApiKey,
    hasSession: hasSession(),
    loginStatus: getLoginStatus(),
    // Ajustes de Correo
    emailService: config.emailService || 'resend',
    hasSendgridKey: !!config.sendgridApiKey,
    sendgridFrom: config.sendgridFrom || '',
    hasResendKey: !!config.resendApiKey,
    resendFrom: config.resendFrom || 'onboarding@resend.dev',
    smtpHost: config.smtpHost || '',
    smtpPort: config.smtpPort || 587,
    smtpUser: config.smtpUser || '',
    hasSmtpPass: !!config.smtpPass,
    smtpFrom: config.smtpFrom || ''
  });
});

// 9. Guardar configuración (Gemini/Groq API key, proveedor, ajustes de correo)
app.post('/api/config', (req, res) => {
  const {
    geminiApiKey,
    groqApiKey,
    provider,
    emailService,
    sendgridApiKey,
    sendgridFrom,
    resendApiKey,
    resendFrom,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom
  } = req.body;

  const updates = {};
  if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey;
  if (groqApiKey !== undefined) updates.groqApiKey = groqApiKey;
  if (provider !== undefined) updates.provider = provider;

  // Correo
  if (emailService !== undefined) updates.emailService = emailService;
  if (sendgridApiKey !== undefined) updates.sendgridApiKey = sendgridApiKey;
  if (sendgridFrom !== undefined) updates.sendgridFrom = sendgridFrom;
  if (resendApiKey !== undefined) updates.resendApiKey = resendApiKey;
  if (resendFrom !== undefined) updates.resendFrom = resendFrom;
  if (smtpHost !== undefined) updates.smtpHost = smtpHost;
  if (smtpPort !== undefined) updates.smtpPort = smtpPort;
  if (smtpUser !== undefined) updates.smtpUser = smtpUser;
  if (smtpPass !== undefined) updates.smtpPass = smtpPass;
  if (smtpFrom !== undefined) updates.smtpFrom = smtpFrom;

  const saved = saveConfig(updates);
  res.json({
    message: 'Configuración guardada.',
    provider: saved.provider || 'gemini',
    hasGeminiKey: !!saved.geminiApiKey,
    hasGroqKey: !!saved.groqApiKey,
    emailService: saved.emailService || 'resend',
    hasSendgridKey: !!saved.sendgridApiKey,
    sendgridFrom: saved.sendgridFrom || '',
    hasResendKey: !!saved.resendApiKey,
    resendFrom: saved.resendFrom || 'onboarding@resend.dev',
    smtpHost: saved.smtpHost || '',
    smtpPort: saved.smtpPort || 587,
    smtpUser: saved.smtpUser || '',
    hasSmtpPass: !!saved.smtpPass,
    smtpFrom: saved.smtpFrom || ''
  });
});

// 10. Abrir navegador visible para login de Facebook
app.post('/api/social/connect', async (req, res) => {
  try {
    res.json({ message: 'Abriendo navegador para login...' });
    await openLoginBrowser((status) => {
      broadcast('social-status', { loginStatus: status, hasSession: hasSession() });
      if (status === 'logged_in' || status === 'session_saved') {
        broadcast('status', {
          ...activeScan,
          message: '✅ Sesión de Facebook guardada. Ya puedes usar Descubrir en páginas de redes sociales.'
        });
      }
    });
  } catch (err) {
    console.error('[Social] Error abriendo navegador:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. Cerrar navegador de login
app.post('/api/social/disconnect', async (req, res) => {
  await closeLoginBrowser();
  res.json({ message: 'Navegador cerrado.' });
});

// 12. Descubrir contactos de un lead de red social con Puppeteer + Gemini Vision
app.post('/api/leads/discover-social/:id', async (req, res) => {
  const { id } = req.params;
  const searchId = Number(id);
  const allLeads = getLeads();
  const lead = allLeads.find(l => l.id === searchId || l.placeId === id || `${l.name}_${l.phone || l.address}` === id);

  if (!lead) return res.status(404).json({ error: 'Lead no encontrado.' });
  if (!lead.website) return res.status(400).json({ error: 'Este lead no tiene sitio web.' });

  res.json({ message: 'Iniciando descubrimiento visual...', leadId: id });

  (async () => {
    broadcast('status', {
      ...activeScan,
      message: `📸 Capturando página de red social: ${lead.name}...`
    });

    try {
      const contactInfo = await scrapeWithVision(lead.website);

      // Enriquecer el lead con los datos encontrados
      if (contactInfo.emails?.length) lead.emails = contactInfo.emails;
      if (contactInfo.phone && !lead.phone) lead.phone = contactInfo.phone;
      if (contactInfo.address && !lead.address) lead.address = contactInfo.address;

      const updatedLeads = saveLeads([lead]);
      broadcast('leads', updatedLeads);

      const found = [
        contactInfo.emails?.length ? `${contactInfo.emails.length} correo(s)` : null,
        contactInfo.phone ? 'teléfono' : null,
        contactInfo.address ? 'dirección' : null,
      ].filter(Boolean);

      broadcast('status', {
        ...activeScan,
        message: found.length > 0
          ? `✅ Vision IA encontró para "${lead.name}": ${found.join(', ')}.`
          : `⚠️ La IA no detectó información de contacto en la captura de "${lead.name}".`
      });
    } catch (err) {
      console.error('[Social] Error:', err);
      broadcast('status', {
        ...activeScan,
        message: `❌ Error al capturar "${lead.name}": ${err.message}`
      });
    }
  })();
});

// 13. Obtener plantillas de correo
app.get('/api/templates', (req, res) => {
  res.json(getTemplates());
});

// 14. Guardar/Actualizar plantilla de correo
app.post('/api/templates', (req, res) => {
  let { id, name, subject, bodyHtml } = req.body;
  if (!name || !subject || !bodyHtml) {
    return res.status(400).json({ error: 'Nombre, asunto y contenido HTML son requeridos.' });
  }

  if (!id || String(id).trim() === '') {
    id = `temp_${Date.now()}`;
  }

  const updatedTemplates = saveTemplate({ id, name, subject, bodyHtml });
  const savedTemplate = updatedTemplates.find(t => t.id === id);
  res.json({ message: 'Plantilla guardada con éxito.', templates: updatedTemplates, savedTemplate });
});

// 15. Eliminar plantilla de correo
app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const updatedTemplates = deleteTemplate(id);
  res.json({ message: 'Plantilla eliminada con éxito.', templates: updatedTemplates });
});

// 16. Enviar correo a un lead (encolar)
app.post('/api/leads/send-email', async (req, res) => {
  const { leadId, templateId, customSubject, customBody, recipientEmail } = req.body;

  if (!leadId) {
    return res.status(400).json({ error: 'El ID del lead es requerido.' });
  }
  if (!recipientEmail) {
    return res.status(400).json({ error: 'El correo electrónico destinatario es requerido.' });
  }

  const allLeads = getLeads();
  const lead = allLeads.find(l => l.placeId === leadId || `${l.name}_${l.phone || l.address}` === leadId);

  if (!lead) {
    return res.status(404).json({ error: 'Lead no encontrado.' });
  }

  if (!templateId && (!customSubject || !customBody)) {
    return res.status(400).json({ error: 'Se requiere una plantilla o contenido personalizado.' });
  }

  if (templateId) {
    const template = getTemplates().find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada.' });
    }
  }

  try {
    const job = enqueueEmailJob({
      leadKey: leadId,
      recipientEmail: recipientEmail.trim(),
      templateId,
      customSubject: customSubject || null,
      customBody: customBody || null
    });

    broadcast('status', {
      ...activeScan,
      message: `📨 Correo encolado para ${recipientEmail}.`
    });

    res.json({ message: 'Correo encolado para envío. Se procesará en segundo plano.', lead, queueId: job.id });
  } catch (err) {
    console.error('[Email] Error al encolar correo:', err);
    res.status(500).json({ error: err.message });
  }
});

// 17. Encolar correo a todos los leads con email
app.post('/api/leads/enqueue-all', (req, res) => {
  const { templateId, customSubject, customBody } = req.body;

  if (!templateId && (!customSubject || !customBody)) {
    return res.status(400).json({ error: 'Se requiere una plantilla o contenido personalizado para enviar a todos.' });
  }

  if (templateId) {
    const template = getTemplates().find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada.' });
    }
  }

  // Fecha de hoy en formato YYYY-MM-DD (comparación por día, no por hora)
  const todayStr = new Date().toISOString().slice(0, 10);

  const leads = getLeads().filter(lead => {
    if (!Array.isArray(lead.emails) || lead.emails.length === 0) return false;
    // Incluir si nunca se le ha enviado correo, o si el último envío fue antes de hoy
    if (!lead.lastEmailSent) return true;
    const sentDateStr = new Date(lead.lastEmailSent).toISOString().slice(0, 10);
    return sentDateStr !== todayStr;
  });

  // Ordenar por fecha de escaneo descendente (más nuevos primero)
  leads.sort((a, b) => {
    const dateA = a.scannedAt ? new Date(a.scannedAt).getTime() : 0;
    const dateB = b.scannedAt ? new Date(b.scannedAt).getTime() : 0;
    return dateB - dateA;
  });

  if (leads.length === 0) {
    return res.status(400).json({ error: 'No hay leads elegibles: todos los que tienen correo ya recibieron un envío hoy.' });
  }

  const queued = leads.map((lead) => {
    const leadKey = lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
    const recipientEmail = lead.emails[0].trim();
    enqueueEmailJob({
      leadKey,
      recipientEmail,
      templateId,
      customSubject: customSubject || null,
      customBody: customBody || null
    });
    return recipientEmail;
  });

  broadcast('status', {
    ...activeScan,
    message: `📬 Se han encolado ${queued.length} correos para todos los leads con email.`
  });

  res.json({ message: `Se encolaron ${queued.length} correos para envío masivo.`, queued: queued.length });
});

app.get('/api/email-queue', (req, res) => {
  res.json(getEmailQueueStats());
});

async function processEmailQueue() {
  try {
    const jobs = getPendingEmailJobs(5);
    if (!jobs.length) return;

    for (const job of jobs) {
      markEmailJobProcessing(job.id);
      const lead = getLeads().find(l => l.placeId === job.leadKey || `${l.name}_${l.phone || l.address}` === job.leadKey);

      let subject = job.customSubject;
      let html = job.customBody;

      if ((!subject || !html) && job.templateId) {
        const template = getTemplates().find(t => t.id === job.templateId);
        if (!template) {
          markEmailJobFailed(job.id, 'Plantilla no encontrada para el envío.');
          continue;
        }
        const compiled = lead ? compileTemplate(template, lead) : { subject: template.subject, bodyHtml: template.bodyHtml };
        subject = subject || compiled.subject;
        html = html || compiled.bodyHtml;
      }

      if (!subject || !html) {
        markEmailJobFailed(job.id, 'Faltan asunto o cuerpo de correo para enviar.');
        continue;
      }

      try {
        console.log(`[Queue] Enviando correo desde cola -> ${job.recipientEmail} (job ${job.id})`);
        await sendEmail({ to: job.recipientEmail, subject, html });
        console.log(`[Queue] Correo enviado correctamente -> ${job.recipientEmail} (job ${job.id})`);
        markEmailJobSent(job.id);
        if (lead) {
          markLeadEmailSent(job.leadKey);
          broadcast('leads', getLeads());
        }
        broadcast('status', {
          ...activeScan,
          message: `✅ Correo enviado a ${job.recipientEmail}`
        });
      } catch (err) {
        console.error(`[Queue] Error enviando a ${job.recipientEmail} (job ${job.id}):`, err.message || err);
        markEmailJobFailed(job.id, err.message || 'Error desconocido');
        broadcast('status', {
          ...activeScan,
          message: `❌ Error enviando a ${job.recipientEmail}: ${err.message || 'Error desconocido'}`
        });
      }
    }
  } catch (err) {
    console.error('[Queue] Error procesando cola:', err);
  }
}

setInterval(() => {
  processEmailQueue().catch(err => console.error('[Queue] worker inesperado:', err));
}, 5000);

processEmailQueue().catch(err => console.error('[Queue] inicio:', err));

// ── Endpoints del Agente Autónomo ─────────────────────────────────────────────

// SSE para eventos del agente en tiempo real
app.get('/api/agent/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Enviar estado actual
  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify(getAgentStatus())}\n\n`);

  // Suscribirse a eventos del agente
  const unsubscribe = onAgentEvent((payload) => {
    res.write(`event: ${payload.event}\n`);
    res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// Obtener estado completo del agente
app.get('/api/agent/status', (req, res) => {
  res.json(getAgentStatus());
});

// Iniciar el agente
app.post('/api/agent/start', async (req, res) => {
  const { categories, regenerateJobs } = req.body || {};
  try {
    const result = await startAgent({
      categories: categories || DEFAULT_CATEGORIES,
      regenerateJobs: regenerateJobs || false,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Detener el agente
app.post('/api/agent/stop', (req, res) => {
  const { reason } = req.body || {};
  const result = stopAgent(reason || 'manual');
  res.json(result);
});

// Pausar/reanudar el agente
app.post('/api/agent/pause', (req, res) => {
  const result = pauseAgent();
  res.json(result);
});

// Obtener estadísticas de jobs
app.get('/api/agent/jobs/stats', (req, res) => {
  res.json(getJobStats());
});

// Obtener progreso por estado
app.get('/api/agent/jobs/progress', (req, res) => {
  res.json(getProgressByState());
});

// Listar jobs con filtros
app.get('/api/agent/jobs', (req, res) => {
  const { status, category, state, limit, offset } = req.query;
  const jobs = getJobs({
    status,
    category,
    state,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(jobs);
});

// Reintentar jobs fallidos
app.post('/api/agent/jobs/retry-failed', (req, res) => {
  const count = resetFailedJobs();
  res.json({ message: `${count} jobs marcados para reintento.`, count });
});

// Limpiar todos los jobs (para reconfigurar)
app.post('/api/agent/jobs/clear', (req, res) => {
  const status = getAgentStatus();
  if (status.running) {
    return res.status(400).json({ error: 'No se puede limpiar mientras el agente está corriendo.' });
  }
  clearAllJobs();
  res.json({ message: 'Todos los jobs eliminados.' });
});

// Obtener errores recientes
app.get('/api/agent/errors', (req, res) => {
  const { limit } = req.query;
  res.json(getRecentErrors(parseInt(limit) || 20));
});

// Obtener info geográfica disponible
app.get('/api/agent/geo', (req, res) => {
  const states = getStates();
  res.json({
    totalStates: states.length,
    totalMunicipalities: getTotalMunicipalities(),
    states: states.map(s => ({ name: s, municipalities: getMunicipalities(s).length })),
  });
});

// Obtener categorías disponibles
app.get('/api/agent/categories', (req, res) => {
  res.json({ categories: DEFAULT_CATEGORIES });
});

// Enlazar rutas comodín para servir el frontend de React en producción
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de API corriendo en http://localhost:${PORT}`);
});
