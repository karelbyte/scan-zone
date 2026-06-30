/**
 * Agente Autónomo de Scan Zone.
 * 
 * Orquesta el proceso completo:
 * 1. Toma el siguiente job (categoría + municipio + estado)
 * 2. Busca en Google Maps
 * 3. Filtra con blacklist
 * 4. Crawlea webs para extraer emails
 * 5. Usa AI vision como fallback si hay redes sociales
 * 6. Envía correos con las plantillas disponibles
 * 7. Registra progreso y maneja errores gracefully
 * 
 * Diseñado para correr indefinidamente con pausas inteligentes.
 */

import { scrapeGoogleMaps } from './scraper.js';
import { crawlWebsite } from './crawler.js';
import { scrapeWithVision, hasSession } from './social-crawler.js';
import { isBlacklisted } from './blacklist.js';
import { sendEmail } from './email-sender.js';
import { getTemplates, compileTemplate } from './templates.js';
import { saveLeads, getLeadByKey } from './sqlite-db.js';
import { getAllLocations } from './geo-data.js';
import {
  generateJobs,
  claimNextJob,
  completeJob,
  failJob,
  incrementDailyStat,
  getDailyStat,
  logError,
  startRun,
  stopRun,
  getCurrentRun,
  getJobStats,
  getAgentSummary,
  cleanOldErrors,
} from './agent-db.js';
import {
  DEFAULT_CATEGORIES,
  DELAYS,
  DAILY_LIMITS,
  SCRAPING,
  EMAIL,
  randomDelay,
  isWithinSchedule,
  msUntilNextActiveWindow,
  buildSearchQuery,
} from './agent-config.js';

// ── Estado del agente ────────────────────────────────────────────────────────

let agentRunning = false;
let agentPaused = false;
let stopRequested = false;
let currentRunId = null;
let currentJob = null;
let consecutiveSearches = 0;
let lastState = null;  // Para detectar cambio de estado y hacer pausa larga

// Listeners para eventos del agente (el servidor puede suscribirse)
let eventListeners = [];

function emit(event, data) {
  const payload = { event, data, timestamp: new Date().toISOString() };
  eventListeners.forEach(fn => {
    try { fn(payload); } catch {}
  });
}

export function onAgentEvent(fn) {
  eventListeners.push(fn);
  return () => { eventListeners = eventListeners.filter(l => l !== fn); };
}

// ── Control del agente ───────────────────────────────────────────────────────

export function getAgentStatus() {
  const summary = getAgentSummary();
  return {
    running: agentRunning,
    paused: agentPaused,
    currentJob: currentJob ? {
      id: currentJob.id,
      category: currentJob.category,
      state: currentJob.state,
      municipality: currentJob.municipality,
    } : null,
    runId: currentRunId,
    ...summary,
  };
}

/**
 * Inicia el agente. Si ya está corriendo, no hace nada.
 * @param {Object} options
 * @param {string[]} options.categories - Categorías a buscar (default: DEFAULT_CATEGORIES)
 * @param {boolean} options.regenerateJobs - Si true, regenera la cola de jobs
 */
export async function startAgent(options = {}) {
  if (agentRunning) {
    return { success: false, message: 'El agente ya está corriendo.' };
  }

  const categories = options.categories || DEFAULT_CATEGORIES;

  // Generar jobs si es necesario
  if (options.regenerateJobs || getJobStats().totalJobs === 0) {
    const locations = getAllLocations();
    const inserted = generateJobs(categories, locations);
    emit('jobs_generated', { inserted, total: categories.length * locations.length });
  }

  // Limpiar errores viejos
  cleanOldErrors();

  agentRunning = true;
  agentPaused = false;
  stopRequested = false;
  consecutiveSearches = 0;
  lastState = null;

  currentRunId = startRun();
  emit('started', { runId: currentRunId });

  // Lanzar el loop principal en background (no bloqueante)
  runLoop().catch(err => {
    console.error('[Agent] Error fatal en el loop principal:', err);
    emit('fatal_error', { message: err.message });
    gracefulStop('fatal_error');
  });

  return { success: true, message: 'Agente iniciado.', runId: currentRunId };
}

/**
 * Detiene el agente gracefully (termina el job actual y para).
 */
export function stopAgent(reason = 'manual') {
  if (!agentRunning) {
    return { success: false, message: 'El agente no está corriendo.' };
  }
  stopRequested = true;
  emit('stop_requested', { reason });
  return { success: true, message: 'Señal de detención enviada. Terminará el job actual.' };
}

/**
 * Pausa/reanuda el agente.
 */
export function pauseAgent() {
  if (!agentRunning) return { success: false, message: 'El agente no está corriendo.' };
  agentPaused = !agentPaused;
  emit(agentPaused ? 'paused' : 'resumed', {});
  return { success: true, paused: agentPaused };
}

function gracefulStop(reason) {
  agentRunning = false;
  agentPaused = false;
  stopRequested = false;
  if (currentRunId) {
    stopRun(currentRunId, reason);
  }
  currentRunId = null;
  currentJob = null;
  emit('stopped', { reason });
}

// ── Loop principal ───────────────────────────────────────────────────────────

async function runLoop() {
  console.log('[Agent] Loop principal iniciado.');

  while (!stopRequested) {
    try {
      // 1. Verificar si estamos dentro del horario
      if (!isWithinSchedule()) {
        const waitMs = msUntilNextActiveWindow();
        const waitMin = Math.round(waitMs / 60000);
        emit('schedule_pause', { waitMinutes: waitMin });
        console.log(`[Agent] Fuera de horario. Esperando ${waitMin} minutos.`);
        await sleep(Math.min(waitMs, 300000)); // Revisar cada 5 min máximo
        continue;
      }

      // 2. Verificar pausa manual
      if (agentPaused) {
        emit('waiting', { reason: 'paused' });
        await sleep(5000);
        continue;
      }

      // 3. Verificar límites diarios
      const limitHit = checkDailyLimits();
      if (limitHit) {
        emit('daily_limit_reached', { metric: limitHit });
        console.log(`[Agent] Límite diario alcanzado: ${limitHit}. Pausando hasta mañana.`);
        // Esperar hasta medianoche + 1 min
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0);
        const waitMs = tomorrow - now;
        await sleep(Math.min(waitMs, 600000)); // Revisar cada 10 min
        continue;
      }

      // 4. Tomar el siguiente job
      const job = claimNextJob();
      if (!job) {
        emit('all_jobs_done', {});
        console.log('[Agent] No hay más jobs pendientes. Agente completado.');
        gracefulStop('all_jobs_done');
        return;
      }

      currentJob = job;
      emit('job_started', { job: { id: job.id, category: job.category, state: job.state, municipality: job.municipality } });
      console.log(`[Agent] Job #${job.id}: "${job.category}" en ${job.municipality}, ${job.state}`);

      // 5. Pausa si cambiamos de estado
      if (lastState && lastState !== job.state) {
        const pauseMs = randomDelay(DELAYS.stateChangePause);
        console.log(`[Agent] Cambio de estado: ${lastState} → ${job.state}. Pausa de ${Math.round(pauseMs / 1000)}s.`);
        emit('state_change_pause', { from: lastState, to: job.state, pauseMs });
        await sleep(pauseMs);
      }
      lastState = job.state;

      // 6. Ejecutar el job
      const result = await executeJob(job);

      // 7. Marcar completado
      completeJob(job.id, result);
      emit('job_completed', { jobId: job.id, ...result });
      console.log(`[Agent] Job #${job.id} completado: ${result.leadsFound} leads, ${result.leadsWithEmail} con email, ${result.emailsSent} emails enviados.`);

      // 8. Pausa entre búsquedas
      consecutiveSearches++;
      if (consecutiveSearches >= DELAYS.longBreakAfter) {
        const breakMs = randomDelay(DELAYS.longBreakDuration);
        console.log(`[Agent] Descanso largo: ${Math.round(breakMs / 1000)}s después de ${consecutiveSearches} búsquedas.`);
        emit('long_break', { searchesDone: consecutiveSearches, breakMs });
        await sleep(breakMs);
        consecutiveSearches = 0;
      } else {
        const delayMs = randomDelay(DELAYS.betweenSearches);
        await sleep(delayMs);
      }

    } catch (err) {
      // Error inesperado en el loop — no matar el agente
      console.error('[Agent] Error en el loop:', err.message);
      logError(currentJob?.id || null, 'loop', err);
      incrementDailyStat('errors');

      // Si hay demasiados errores consecutivos, pausar
      const dailyErrors = getDailyStat('errors');
      if (dailyErrors >= DAILY_LIMITS.maxErrors) {
        emit('too_many_errors', { count: dailyErrors });
        console.error('[Agent] Demasiados errores hoy. Pausando agente.');
        gracefulStop('too_many_errors');
        return;
      }

      // Esperar antes de reintentar
      await sleep(randomDelay(DELAYS.retryDelay));
    }
  }

  // Se solicitó detención
  gracefulStop('manual');
  console.log('[Agent] Agente detenido correctamente.');
}

// ── Ejecución de un job individual ───────────────────────────────────────────

async function executeJob(job) {
  const { category, state, municipality } = job;
  const query = buildSearchQuery(category, municipality, state);

  const result = { leadsFound: 0, leadsWithEmail: 0, emailsSent: 0 };

  // ─── Fase 1: Scraping de Google Maps ───────────────────────────────────────
  let rawLeads = [];
  try {
    rawLeads = await scrapeGoogleMaps(
      query,
      SCRAPING.leadsPerSearch,
      (progress) => { /* silencioso en modo agente */ },
      () => stopRequested,
      new Set() // no excluir keys existentes en modo agente — el saveLeads deduplica
    );
    incrementDailyStat('searches');
  } catch (err) {
    logError(job.id, 'scraping', err);
    incrementDailyStat('errors');

    // Si es timeout o error de navegador, marcar para retry
    if (isRetryableError(err)) {
      const status = failJob(job.id, `Scraping: ${err.message}`);
      emit('job_failed', { jobId: job.id, phase: 'scraping', retrying: status === 'retry' });
      return result;
    }
    // Otros errores: continuar sin leads
    throw err;
  }

  // ─── Fase 2: Filtrado con blacklist ────────────────────────────────────────
  const filteredLeads = rawLeads.filter(lead => {
    if (!lead || !lead.name) return false;
    if (isBlacklisted(lead.name)) return false;
    return true;
  });

  result.leadsFound = filteredLeads.length;

  if (filteredLeads.length === 0) {
    return result;
  }

  // ─── Fase 3: Crawl de websites + AI Vision fallback ────────────────────────
  const leadsWithEmails = [];

  for (const lead of filteredLeads) {
    if (stopRequested) break;

    // Verificar límite de crawls
    if (getDailyStat('crawls') >= DAILY_LIMITS.maxCrawls) break;

    let emails = lead.emails || [];
    let updatedLead = { ...lead };

    // 3a. Crawl del sitio web si tiene uno
    if (lead.website && emails.length === 0) {
      try {
        const crawlResult = await crawlWebsite(lead.website);
        if (crawlResult.emails && crawlResult.emails.length > 0) {
          emails = crawlResult.emails;
        }
        // También actualizar redes sociales si se encontraron
        if (crawlResult.socials) {
          updatedLead.socials = { ...(updatedLead.socials || {}), ...crawlResult.socials };
        }
        incrementDailyStat('crawls');
        await sleep(randomDelay(DELAYS.betweenCrawls));
      } catch (err) {
        // Error de crawl no es fatal — continuar con el siguiente lead
        logError(job.id, 'crawl', err);
      }
    }

    // 3b. AI Vision fallback si no encontramos email y tiene red social
    if (emails.length === 0 && SCRAPING.useVisionFallback && hasSession()) {
      const socialUrl = getSocialUrl(updatedLead);
      if (socialUrl) {
        // Verificar límite de vision calls
        if (getDailyStat('vision_calls') < DAILY_LIMITS.maxVisionCalls) {
          try {
            const visionResult = await scrapeWithVision(socialUrl);
            if (visionResult.emails && visionResult.emails.length > 0) {
              emails = visionResult.emails;
            }
            // Actualizar otros datos si vision encontró algo útil
            if (visionResult.phone && !updatedLead.phone) {
              updatedLead.phone = visionResult.phone;
            }
            if (visionResult.website && !updatedLead.website) {
              updatedLead.website = visionResult.website;
            }
            incrementDailyStat('vision_calls');
            await sleep(randomDelay(DELAYS.betweenVisionCalls));
          } catch (err) {
            // Error de vision no es fatal
            logError(job.id, 'vision', err);
          }
        }
      }
    }

    updatedLead.emails = emails;

    // Guardar lead en la DB principal (con o sin email)
    leadsWithEmails.push(updatedLead);

    if (emails.length > 0) {
      result.leadsWithEmail++;
    }
  }

  // ─── Fase 4: Guardar leads en la base de datos principal ───────────────────
  if (leadsWithEmails.length > 0) {
    try {
      saveLeads(leadsWithEmails);
    } catch (err) {
      logError(job.id, 'save_leads', err);
    }
  }

  // ─── Fase 5: Envío de emails ───────────────────────────────────────────────
  const leadsToEmail = leadsWithEmails.filter(lead => {
    if (!lead.emails || lead.emails.length === 0) return false;
    if (EMAIL.skipAlreadySent) {
      // Verificar en DB principal si ya se le envió
      const existing = getLeadByKey(lead.placeId || `${lead.name}_${lead.phone || lead.address}`);
      if (existing && existing.emailSent) return false;
    }
    return true;
  });

  for (const lead of leadsToEmail) {
    if (stopRequested) break;

    // Verificar límite diario de emails
    if (getDailyStat('emails_sent') >= DAILY_LIMITS.maxEmails) {
      emit('email_limit_reached', {});
      break;
    }

    try {
      const sent = await sendEmailToLead(lead);
      if (sent) {
        result.emailsSent++;
        incrementDailyStat('emails_sent');
        await sleep(randomDelay(DELAYS.betweenEmails));
      }
    } catch (err) {
      logError(job.id, 'email', err);
      // No romper el loop por un error de email individual
    }
  }

  return result;
}

// ── Envío de email a un lead ─────────────────────────────────────────────────

async function sendEmailToLead(lead) {
  const templates = getTemplates();
  if (!templates || templates.length === 0) {
    console.warn('[Agent] No hay plantillas de email configuradas.');
    return false;
  }

  // Seleccionar plantilla
  const template = selectTemplate(templates, lead);
  if (!template) return false;

  // Compilar plantilla con datos del lead
  const { subject, bodyHtml } = compileTemplate(template, lead);

  // Usar el primer email disponible del lead
  const recipientEmail = lead.emails[0];
  if (!recipientEmail) return false;

  // Enviar
  await sendEmail({ to: recipientEmail, subject, html: bodyHtml });

  // Marcar lead como enviado en la DB principal
  try {
    const leadKey = lead.placeId || `${lead.name}_${lead.phone || lead.address}`;
    const existing = getLeadByKey(leadKey);
    if (existing) {
      const { updateLeadById } = await import('./sqlite-db.js');
      updateLeadById(existing.id, { 
        emailSent: true, 
        emailSentAt: new Date().toISOString(),
        lastEmailSent: template.id 
      });
    }
  } catch {}

  emit('email_sent', { to: recipientEmail, lead: lead.name, template: template.name });
  return true;
}

function selectTemplate(templates, lead) {
  if (EMAIL.templateStrategy === 'category-mapped') {
    // Buscar por mapeo de categoría (necesitaríamos saber la categoría del job actual)
    const mappedId = EMAIL.categoryTemplateMap[currentJob?.category];
    if (mappedId) {
      const found = templates.find(t => t.id === mappedId);
      if (found) return found;
    }
  }

  if (EMAIL.templateStrategy === 'sequential') {
    // Rotar en base al contador de emails enviados hoy
    const sent = getDailyStat('emails_sent');
    const idx = sent % templates.length;
    return templates[idx];
  }

  // Default: random
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function getSocialUrl(lead) {
  const socials = lead.socials || {};

  // Priorizar Facebook (más info de contacto visible)
  let url = null;
  if (socials.facebook) url = socials.facebook;
  else if (socials.instagram) url = socials.instagram;
  else if (lead.url && lead.url.includes('facebook.com')) url = lead.url;

  if (!url) return null;

  // Normalizar URLs sin protocolo (protocol-relative "//www.facebook.com/...")
  url = url.trim();
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  return url;
}

function checkDailyLimits() {
  if (getDailyStat('searches') >= DAILY_LIMITS.maxSearches) return 'searches';
  if (getDailyStat('emails_sent') >= DAILY_LIMITS.maxEmails) return 'emails';
  if (getDailyStat('errors') >= DAILY_LIMITS.maxErrors) return 'errors';
  return null;
}

function isRetryableError(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('navigation') ||
    msg.includes('net::') ||
    msg.includes('protocol') ||
    msg.includes('session closed') ||
    msg.includes('target closed') ||
    msg.includes('browser') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up')
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
