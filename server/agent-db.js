/**
 * Base de datos del agente autónomo.
 * 
 * Tablas:
 * - agent_jobs: Cada combinación (categoría, estado, municipio) con su estado de progreso.
 * - agent_runs: Historial de ejecuciones del agente (inicio, fin, stats).
 * - agent_daily_stats: Contadores diarios para respetar límites (emails enviados, búsquedas, etc.)
 * - agent_errors: Log de errores para diagnóstico.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'agent.db');

let db;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function openDatabase() {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initialize() {
  openDatabase();

  // Jobs: cada combinación categoría + estado + municipio
  db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      state TEXT NOT NULL,
      municipality TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      leadsFound INTEGER DEFAULT 0,
      leadsWithEmail INTEGER DEFAULT 0,
      emailsSent INTEGER DEFAULT 0,
      errorMessage TEXT,
      attempts INTEGER DEFAULT 0,
      startedAt TEXT,
      completedAt TEXT,
      createdAt TEXT NOT NULL,
      UNIQUE(category, state, municipality)
    )
  `).run();

  // Índices para consultas rápidas
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON agent_jobs(status)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_jobs_category ON agent_jobs(category)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_jobs_state ON agent_jobs(state)`).run();

  // Historial de ejecuciones del agente
  db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'running',
      startedAt TEXT NOT NULL,
      stoppedAt TEXT,
      jobsCompleted INTEGER DEFAULT 0,
      jobsFailed INTEGER DEFAULT 0,
      totalLeadsFound INTEGER DEFAULT 0,
      totalEmailsSent INTEGER DEFAULT 0,
      stopReason TEXT
    )
  `).run();

  // Estadísticas diarias para rate limiting
  db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_daily_stats (
      date TEXT NOT NULL,
      metric TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      PRIMARY KEY(date, metric)
    )
  `).run();

  // Log de errores
  db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER,
      phase TEXT,
      errorType TEXT,
      message TEXT,
      stack TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_errors_date ON agent_errors(createdAt)`).run();
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * Genera jobs para todas las combinaciones categoría × estado × municipio.
 * Solo inserta los que no existan ya (UNIQUE constraint).
 */
export function generateJobs(categories, locations) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO agent_jobs (category, state, municipality, status, createdAt)
    VALUES (?, ?, ?, 'pending', ?)
  `);

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    let inserted = 0;
    for (const category of categories) {
      for (const { state, municipality } of locations) {
        const result = insert.run(category, state, municipality, now);
        if (result.changes > 0) inserted++;
      }
    }
    return inserted;
  });

  return transaction();
}

/**
 * Obtiene el siguiente job pendiente (FIFO), priorizando los que menos intentos tienen.
 * Marca como 'running' de forma atómica.
 */
export function claimNextJob() {
  const now = new Date().toISOString();

  // Primero buscar jobs pendientes; priorizar por menos intentos y orden de creación
  const job = db.prepare(`
    SELECT * FROM agent_jobs 
    WHERE status IN ('pending', 'retry')
    ORDER BY attempts ASC, id ASC
    LIMIT 1
  `).get();

  if (!job) return null;

  db.prepare(`
    UPDATE agent_jobs 
    SET status = 'running', startedAt = ?, attempts = attempts + 1
    WHERE id = ?
  `).run(now, job.id);

  return { ...job, status: 'running', startedAt: now, attempts: job.attempts + 1 };
}

/**
 * Marca un job como completado exitosamente.
 */
export function completeJob(jobId, stats = {}) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE agent_jobs 
    SET status = 'completed', completedAt = ?,
        leadsFound = ?, leadsWithEmail = ?, emailsSent = ?,
        errorMessage = NULL
    WHERE id = ?
  `).run(now, stats.leadsFound || 0, stats.leadsWithEmail || 0, stats.emailsSent || 0, jobId);
}

/**
 * Marca un job como fallido. Si tiene menos de maxRetries intentos, se pone en 'retry'.
 */
export function failJob(jobId, errorMessage, maxRetries = 3) {
  const job = db.prepare('SELECT attempts FROM agent_jobs WHERE id = ?').get(jobId);
  const newStatus = (job && job.attempts < maxRetries) ? 'retry' : 'failed';
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE agent_jobs 
    SET status = ?, errorMessage = ?, completedAt = ?
    WHERE id = ?
  `).run(newStatus, errorMessage, now, jobId);

  return newStatus;
}

/**
 * Resetea jobs fallidos para reintentar.
 */
export function resetFailedJobs() {
  const result = db.prepare(`
    UPDATE agent_jobs SET status = 'pending', attempts = 0, errorMessage = NULL
    WHERE status = 'failed'
  `).run();
  return result.changes;
}

/**
 * Resetea todos los jobs (para empezar de cero).
 */
export function resetAllJobs() {
  db.prepare(`
    UPDATE agent_jobs SET status = 'pending', attempts = 0, errorMessage = NULL,
    leadsFound = 0, leadsWithEmail = 0, emailsSent = 0, startedAt = NULL, completedAt = NULL
  `).run();
}

/**
 * Estadísticas generales de progreso.
 */
export function getJobStats() {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count, 
           SUM(leadsFound) as totalLeads,
           SUM(leadsWithEmail) as totalWithEmail,
           SUM(emailsSent) as totalEmails
    FROM agent_jobs GROUP BY status
  `).all();

  const stats = {
    pending: 0, running: 0, completed: 0, failed: 0, retry: 0,
    totalJobs: 0, totalLeads: 0, totalWithEmail: 0, totalEmails: 0
  };

  for (const row of rows) {
    stats[row.status] = row.count;
    stats.totalJobs += row.count;
    stats.totalLeads += row.totalLeads || 0;
    stats.totalWithEmail += row.totalWithEmail || 0;
    stats.totalEmails += row.totalEmails || 0;
  }

  return stats;
}

/**
 * Obtiene jobs con filtros opcionales y paginación.
 */
export function getJobs({ status, category, state, limit = 50, offset = 0 } = {}) {
  let query = 'SELECT * FROM agent_jobs WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (state) {
    query += ' AND state = ?';
    params.push(state);
  }

  query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Obtiene el progreso por estado.
 */
export function getProgressByState() {
  return db.prepare(`
    SELECT state, 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status IN ('pending', 'retry') THEN 1 ELSE 0 END) as pending
    FROM agent_jobs
    GROUP BY state
    ORDER BY state
  `).all();
}

// ── Runs (historial de ejecuciones) ──────────────────────────────────────────

export function startRun() {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO agent_runs (status, startedAt) VALUES ('running', ?)
  `).run(now);
  return result.lastInsertRowid;
}

export function stopRun(runId, reason = 'manual') {
  const now = new Date().toISOString();

  // Calcular stats del run
  const stats = db.prepare(`
    SELECT COUNT(*) as completed FROM agent_jobs 
    WHERE status = 'completed' AND completedAt >= (SELECT startedAt FROM agent_runs WHERE id = ?)
  `).get(runId);

  db.prepare(`
    UPDATE agent_runs 
    SET status = 'stopped', stoppedAt = ?, stopReason = ?, jobsCompleted = ?
    WHERE id = ?
  `).run(now, reason, stats?.completed || 0, runId);
}

export function getCurrentRun() {
  return db.prepare(`SELECT * FROM agent_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1`).get();
}

// ── Daily Stats (rate limiting) ──────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Incrementa un contador diario.
 */
export function incrementDailyStat(metric, amount = 1) {
  const date = getToday();
  db.prepare(`
    INSERT INTO agent_daily_stats (date, metric, value) VALUES (?, ?, ?)
    ON CONFLICT(date, metric) DO UPDATE SET value = value + ?
  `).run(date, metric, amount, amount);
}

/**
 * Obtiene el valor actual de un contador diario.
 */
export function getDailyStat(metric) {
  const date = getToday();
  const row = db.prepare('SELECT value FROM agent_daily_stats WHERE date = ? AND metric = ?').get(date, metric);
  return row ? row.value : 0;
}

/**
 * Obtiene todas las estadísticas del día.
 */
export function getDailyStats() {
  const date = getToday();
  const rows = db.prepare('SELECT metric, value FROM agent_daily_stats WHERE date = ?').all(date);
  return rows.reduce((acc, row) => {
    acc[row.metric] = row.value;
    return acc;
  }, {});
}

// ── Error Log ────────────────────────────────────────────────────────────────

export function logError(jobId, phase, error) {
  const now = new Date().toISOString();
  const errorType = error.constructor?.name || 'Error';
  const message = error.message || String(error);
  const stack = error.stack || '';

  db.prepare(`
    INSERT INTO agent_errors (jobId, phase, errorType, message, stack, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(jobId, phase, errorType, message, stack.slice(0, 2000), now);
}

export function getRecentErrors(limit = 20) {
  return db.prepare(`
    SELECT e.*, j.category, j.state, j.municipality
    FROM agent_errors e
    LEFT JOIN agent_jobs j ON e.jobId = j.id
    ORDER BY e.createdAt DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Limpia errores antiguos (más de 7 días).
 */
export function cleanOldErrors() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM agent_errors WHERE createdAt < ?').run(cutoff);
}

// ── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Verifica si ya se cubrió un job específico.
 */
export function isJobDone(category, state, municipality) {
  const job = db.prepare(`
    SELECT status FROM agent_jobs WHERE category = ? AND state = ? AND municipality = ?
  `).get(category, state, municipality);
  return job?.status === 'completed';
}

/**
 * Resumen compacto del estado actual del agente.
 */
export function getAgentSummary() {
  const jobStats = getJobStats();
  const dailyStats = getDailyStats();
  const currentRun = getCurrentRun();
  const recentErrors = getRecentErrors(5);

  return {
    jobs: jobStats,
    daily: dailyStats,
    currentRun: currentRun || null,
    recentErrors: recentErrors.map(e => ({
      phase: e.phase,
      message: e.message,
      category: e.category,
      state: e.state,
      municipality: e.municipality,
      createdAt: e.createdAt
    }))
  };
}

/**
 * Elimina todos los jobs (para reconfigurar categorías/ubicaciones).
 */
export function clearAllJobs() {
  db.prepare('DELETE FROM agent_jobs').run();
  db.prepare('DELETE FROM agent_errors').run();
}

// Inicializar al importar
initialize();
