import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'scan_zone.db');

let db;

const DEFAULT_TEMPLATES = [
  {
    id: 'consultoria-ai-bot',
    name: 'Propuesta de Bots con IA a la Medida',
    subject: 'Impulsa tu negocio con un Asistente de IA personalizado - {{companyName}}',
    bodyHtml:
      "<div style=\"font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);\">\n  <!-- Header con gradiente premium -->\n  <div style=\"background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px 20px; text-align: center; color: #ffffff;\">\n    <h1 style=\"margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;\">Soluciones Digitales Inteligentes</h1>\n    <p style=\"margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;\">Innovación y desarrollo a tu medida</p>\n  </div>\n  \n  <!-- Contenido -->\n  <div style=\"padding: 30px 25px; background-color: #ffffff; color: #334155; line-height: 1.6;\">\n    <h2 style=\"margin-top: 0; color: #1e293b; font-size: 18px;\">Hola, equipo de {{companyName}}</h2>\n    \n    <p>Soy fundador en nuestra consultora de desarrollo de software a medida. Nos especializamos en crear soluciones digitales de alto impacto que automatizan operaciones y multiplican las ventas.</p>\n    \n    <p>Analizando la presencia digital de <strong>{{companyName}}</strong>, vemos una excelente oportunidad para potenciar su atención al cliente y optimizar sus procesos comerciales mediante un <strong>Asistente Virtual con Inteligencia Artificial a la medida</strong>.</p>\n    \n    <!-- Caja destacada -->\n    <div style=\"background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;\">\n      <h3 style=\"margin: 0 0 8px 0; color: #4f46e5; font-size: 15px;\">¿Qué puede hacer un Bot con IA por {{companyName}}?</h3>\n      <ul style=\"margin: 0; padding-left: 20px; font-size: 14px; color: #475569;\">\n        <li style=\"margin-bottom: 6px;\"><strong>Atención 24/7 sin pausas:</strong> Responde dudas, agenda citas y califica prospectos al instante en WhatsApp, Instagram o Facebook.</li>\n        <li style=\"margin-bottom: 6px;\"><strong>Integración con tus sistemas:</strong> Se conecta con tu base de datos o CRM para consultar stock, pedidos o agendas.</li>\n        <li style=\"margin-bottom: 0;\"><strong>Respuestas ultra-personalizadas:</strong> Entrenado con el tono y la información específica de tu negocio.</li>\n      </ul>\n    </div>\n    \n    <p>Además de la Inteligencia Artificial, construimos plataformas web, aplicaciones móviles y software interno que se adapta exactamente al flujo de trabajo de tu empresa, sin que tengas que adaptarte tú a softwares comerciales rígidos.</p>\n    \n    <!-- Llamada a la acción -->\n    <div style=\"text-align: center; margin: 30px 0 20px 0;\">\n      <a href=\"mailto:contacto@tudominio.com?subject=Re: Desarrollo de Bot con IA\" style=\"background-color: #4f46e5; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);\">Agendar Asesoría Gratuita de 15 Minutos</a>\n    </div>\n    \n    <p style=\"font-size: 13px; color: #64748b; text-align: center; margin-top: 25px;\">Sin compromisos. Analizamos tu caso y te proponemos un prototipo inicial sin costo.</p>\n  </div>\n  \n  <!-- Footer -->\n  <div style=\"background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;\">\n    <p style=\"margin: 0;\">Este correo fue enviado de manera personalizada para {{companyName}}.</p>\n    <p style=\"margin: 5px 0 0 0;\">Si deseas que no volvamos a contactarte, puedes responder a este mensaje indicándolo.</p>\n  </div>\n</div>"
  }
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function openDatabase() {
  ensureDataDir();
  if (!db) {
    db = new Database(DB_FILE);
  }
  return db;
}

function cleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/[-]/g, ' ' )
    .replace(/[\r\n\t]+/g, ' ' )
    .replace(/\s+/g, ' ' )
    .trim();
}

function cleanEmail(email) {
  if (!email) return '';
  return String(email)
    .replace(/[\r\n\t]+/g, '')
    .trim()
    .toLowerCase();
}

function extractEmailsFromWebsite(website) {
  if (!website) return { website: '', emails: [] };
  let normalized = String(website).trim();
  if (!normalized) return { website: '', emails: [] };

  if (/^mailto:/i.test(normalized)) {
    normalized = normalized.replace(/^mailto:/i, '');
  }

  const candidateParts = normalized
    .split(/[\s,;|]+/)
    .map(part => part.replace(/^mailto:/i, '').split('?')[0].trim())
    .filter(Boolean);

  const emails = [];
  const websites = [];

    candidateParts.forEach(part => {
    const isUrlLike = /^https?:\/\//i.test(part) || /^www\./i.test(part) || part.includes('/') || part.includes('\\');
    const isEmailLike = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part);

    if (isEmailLike && !isUrlLike) {
      emails.push(cleanEmail(part));
    } else {
      websites.push(part);
    }
  });

  if (emails.length > 0 && websites.length === 0) {
    return { website: '', emails };
  }

  return { website: websites.join(' ').trim() || normalized, emails };
}

function cleanLeadStrings(lead) {
  if (!lead) return lead;
  const websiteValue = lead.website ? String(lead.website).trim() : '';
  const websiteNormalized = extractEmailsFromWebsite(websiteValue);

  return {
    id: lead.id || null,
    placeId: cleanString(lead.placeId),
    name: cleanString(lead.name),
    address: cleanString(lead.address),
    phone: cleanString(lead.phone),
    website: websiteNormalized.website,
    rating: cleanString(lead.rating),
    reviews: cleanString(lead.reviews),
    url: cleanString(lead.url),
        emails: Array.from(new Set([
      ...(lead.emails || []).map(email => cleanEmail(email)).filter(Boolean),
      ...websiteNormalized.emails
    ])),
    socials: lead.socials || {},
    scannedAt: lead.scannedAt || new Date().toISOString(),
    emailSent: lead.emailSent ? 1 : 0,
    emailSentAt: lead.emailSentAt || null,
    lastEmailSent: lead.lastEmailSent || null
  };
}

function parseLeadRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    placeId: row.placeId || '',
    name: row.name || '',
    phone: row.phone || '',
    website: row.website || '',
    address: row.address || '',
    rating: row.rating || '',
    reviews: row.reviews || '',
    url: row.url || '',
    emails: row.emails ? JSON.parse(row.emails) : [],
    socials: row.socials ? JSON.parse(row.socials) : {},
    scannedAt: row.scannedAt || '',
    emailSent: Boolean(row.emailSent),
    emailSentAt: row.emailSentAt || null,
    lastEmailSent: row.lastEmailSent || null
  };
}

function parseQueueRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadKey: row.leadKey,
    recipientEmail: row.recipientEmail,
    templateId: row.templateId,
    customSubject: row.customSubject,
    customBody: row.customBody,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sentAt: row.sentAt
  };
}

function getLeadKeyFromRow(row) {
  if (!row) return '';
  if (row.placeId) return row.placeId;
  return `${row.name}_${row.phone || row.address}`;
}

function initialize() {
  openDatabase();

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.prepare(
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeId TEXT,
      name TEXT,
      phone TEXT,
      website TEXT,
      address TEXT,
      rating TEXT,
      reviews TEXT,
      emails TEXT,
      socials TEXT,
      url TEXT,
      scannedAt TEXT,
      emailSent INTEGER DEFAULT 0,
      emailSentAt TEXT,
      lastEmailSent TEXT
    )`
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_placeId ON leads(placeId)`
  ).run();

  // Add lastEmailSent column when the leads table already exists without it.
  const leadColumns = db.prepare("PRAGMA table_info(leads)").all();
  if (!leadColumns.some(col => col.name === 'lastEmailSent')) {
    db.prepare('ALTER TABLE leads ADD COLUMN lastEmailSent TEXT').run();
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT,
      subject TEXT,
      bodyHtml TEXT
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadKey TEXT,
      recipientEmail TEXT NOT NULL,
      templateId TEXT,
      customSubject TEXT,
      customBody TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      sentAt TEXT
    )`
  ).run();

  migrateJsonData();
}

function migrateJsonData() {
  const templateCount = db.prepare('SELECT COUNT(*) AS count FROM templates').get().count;
  if (templateCount === 0) {
    const stmt = db.prepare('INSERT OR REPLACE INTO templates (id, name, subject, bodyHtml) VALUES (?, ?, ?, ?)');
    const insert = db.transaction((items) => {
      for (const template of items) {
        stmt.run(template.id, template.name, template.subject, template.bodyHtml);
      }
    });
    insert(DEFAULT_TEMPLATES);
  }
}

function getConfig() {
  const rows = db.prepare('SELECT key, value FROM config').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function saveConfig(config) {
  const insert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  const txn = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      insert.run(key, value === undefined || value === null ? '' : String(value));
    }
  });
  txn(config);
  return getConfig();
}

function getTemplates() {
  return db
    .prepare('SELECT id, name, subject, bodyHtml FROM templates ORDER BY name ASC')
    .all();
}

function saveTemplate(template) {
  if (!template.id) {
    template.id = `temp_${Date.now()}`;
  }
  db.prepare(
    `INSERT OR REPLACE INTO templates (id, name, subject, bodyHtml)
     VALUES (?, ?, ?, ?)`
  ).run(template.id, template.name, template.subject, template.bodyHtml);
  return getTemplates();
}

function deleteTemplate(id) {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  return getTemplates();
}

function compileTemplate(template, lead) {
  let subject = template.subject;
  let bodyHtml = template.bodyHtml;
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
}

function getLeads() {
  return db
    .prepare('SELECT * FROM leads ORDER BY scannedAt DESC')
    .all()
    .map(parseLeadRow);
}

function getLeadByKey(key) {
  if (!key) return null;
  // 1. Buscar por placeId exacto
  let row = db.prepare('SELECT * FROM leads WHERE placeId = ?').get(key);
  if (!row) {
    // 2. Buscar por clave compuesta: name_phone (formato usado en enqueue)
    row = db
      .prepare(
        `SELECT * FROM leads WHERE (name || '_' || COALESCE(phone, COALESCE(address, ''))) = ? LIMIT 1`
      )
      .get(key);
  }
  if (!row) {
    // 3. Fallback legacy con tres partes: name_phone_address
    row = db
      .prepare(
        `SELECT * FROM leads WHERE (name || '_' || COALESCE(phone, '') || '_' || COALESCE(address, '')) = ? LIMIT 1`
      )
      .get(key);
  }
  return parseLeadRow(row);
}

function getLeadById(id) {
  if (!id) return null;
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  return parseLeadRow(row);
}

function updateLeadEmails(id, emails) {
  if (!id || !Array.isArray(emails)) return null;
  const existing = getLeadById(id);
  if (!existing) return null;
  const cleanedEmails = Array.from(new Set([
    ...(existing.emails || []),
    ...emails.map(email => cleanEmail(email)).filter(Boolean)
  ]));
  db.prepare('UPDATE leads SET emails = ? WHERE id = ?').run(JSON.stringify(cleanedEmails), Number(id));
  return getLeadById(id);
}

function updateLeadById(id, updates = {}) {
  if (!id || typeof updates !== 'object') return null;
  const existing = getLeadById(id);
  if (!existing) return null;

  // Si se envía emails, reemplazar completamente (sin merge)
  const mergedEmails = Array.isArray(updates.emails)
    ? updates.emails.map(e => String(e).trim()).filter(Boolean)
    : existing.emails || [];

  const updatedLead = {
    ...existing,
    ...updates,
    emails: mergedEmails,
    scannedAt: existing.scannedAt || new Date().toISOString()
  };

  const cleaned = cleanLeadStrings(updatedLead);

  db.prepare(
    `UPDATE leads SET
       placeId = ?,
       name = ?,
       phone = ?,
       website = ?,
       address = ?,
       rating = ?,
       reviews = ?,
       emails = ?,
       socials = ?,
       url = ?,
       scannedAt = ?,
       emailSent = ?,
       emailSentAt = ?,
       lastEmailSent = ?
     WHERE id = ?`
  ).run(
    cleaned.placeId,
    cleaned.name,
    cleaned.phone,
    cleaned.website,
    cleaned.address,
    cleaned.rating,
    cleaned.reviews,
    JSON.stringify(cleaned.emails),
    JSON.stringify(cleaned.socials),
    cleaned.url,
    cleaned.scannedAt,
    cleaned.emailSent,
    cleaned.emailSentAt,
    cleaned.lastEmailSent,
    Number(id)
  );

  return getLeadById(id);
}

function getLeadByUniqueFields(name, phone, address) {
  return parseLeadRow(
    db
      .prepare(
        `SELECT * FROM leads WHERE name = ? AND COALESCE(phone, '') = ? AND COALESCE(address, '') = ? LIMIT 1`
      )
      .get(name || '', phone || '', address || '')
  );
}

function saveLeads(newLeads) {
  const insert = db.prepare(
    `INSERT INTO leads (placeId, name, phone, website, address, rating, reviews, emails, socials, url, scannedAt, emailSent, emailSentAt, lastEmailSent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const update = db.prepare(
    `UPDATE leads SET
       placeId = ?,
       name = ?,
       phone = ?,
       website = ?,
       address = ?,
       rating = ?,
       reviews = ?,
       emails = ?,
       socials = ?,
       url = ?,
       scannedAt = ?,
       emailSent = ?,
       emailSentAt = ?,
       lastEmailSent = ?
     WHERE id = ?`
  );

  const transaction = db.transaction((items) => {
    for (const lead of items) {
      const cleaned = cleanLeadStrings(lead);
      let existing = null;
      if (cleaned.id) {
        existing = getLeadById(cleaned.id);
      }
      if (!existing && cleaned.placeId) {
        existing = getLeadByKey(cleaned.placeId);
      }
      if (!existing && cleaned.name) {
        existing = getLeadByUniqueFields(cleaned.name, cleaned.phone, cleaned.address);
      }

      if (existing) {
        const mergedEmails = Array.from(new Set([...(existing.emails || []), ...(cleaned.emails || [])]));
        const mergedSocials = { ...(existing.socials || {}), ...(cleaned.socials || {}) };
        const emailSent = existing.emailSent || cleaned.emailSent ? 1 : 0;
        const emailSentAt = existing.emailSentAt || cleaned.emailSentAt || null;
        update.run(
          cleaned.placeId || existing.placeId,
          cleaned.name || existing.name,
          cleaned.phone || existing.phone,
          cleaned.website || existing.website,
          cleaned.address || existing.address,
          cleaned.rating || existing.rating,
          cleaned.reviews || existing.reviews,
          JSON.stringify(mergedEmails),
          JSON.stringify(mergedSocials),
          cleaned.url || existing.url,
          existing.scannedAt || cleaned.scannedAt,
          emailSent,
          emailSentAt,
          cleaned.lastEmailSent || existing.lastEmailSent || null,
          existing.id
        );
      } else {
        insert.run(
          cleaned.placeId || null,
          cleaned.name,
          cleaned.phone,
          cleaned.website,
          cleaned.address,
          cleaned.rating,
          cleaned.reviews,
          JSON.stringify(cleaned.emails),
          JSON.stringify(cleaned.socials),
          cleaned.url,
          cleaned.scannedAt,
          cleaned.emailSent,
          cleaned.emailSentAt,
          cleaned.lastEmailSent || null
        );
      }
    }
  });

  transaction(newLeads);
  return getLeads();
}

function replaceLeads(leads) {
  const cleanedLeads = (leads || []).map(cleanLeadStrings);
  const deleteStmt = db.prepare('DELETE FROM leads');
  const insert = db.prepare(
    `INSERT INTO leads (placeId, name, phone, website, address, rating, reviews, emails, socials, url, scannedAt, emailSent, emailSentAt, lastEmailSent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction((items) => {
    deleteStmt.run();
    for (const lead of items) {
      insert.run(
        lead.placeId || null,
        lead.name,
        lead.phone,
        lead.website,
        lead.address,
        lead.rating,
        lead.reviews,
        JSON.stringify(lead.emails),
        JSON.stringify(lead.socials),
        lead.url,
        lead.scannedAt,
        lead.emailSent,
        lead.emailSentAt,
        lead.lastEmailSent || null
      );
    }
  });

  transaction(cleanedLeads);
  return getLeads();
}

function clearLeads() {
  db.prepare('DELETE FROM leads').run();
  return [];
}

function deleteLeads(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return getLeads();
  }

  const deleteStmt = db.prepare('DELETE FROM leads WHERE id = ?');
  const transaction = db.transaction((items) => {
    for (const id of items) {
      deleteStmt.run(Number(id));
    }
  });

  transaction(ids);
  return getLeads();
}

function enqueueEmailJob({ leadKey, recipientEmail, templateId, customSubject, customBody }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO email_queue (leadKey, recipientEmail, templateId, customSubject, customBody, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(leadKey, recipientEmail, templateId || null, customSubject || null, customBody || null, 'pending', now, now);
  return {
    id: info.lastInsertRowid,
    leadKey,
    recipientEmail,
    templateId,
    customSubject,
    customBody,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    sentAt: null
  };
}

function getPendingEmailJobs(limit = 20) {
  return db
    .prepare('SELECT * FROM email_queue WHERE status = ? ORDER BY createdAt ASC LIMIT ?')
    .all('pending', limit)
    .map(parseQueueRow);
}

function markEmailJobProcessing(id) {
  const now = new Date().toISOString();
  db.prepare('UPDATE email_queue SET status = ?, updatedAt = ? WHERE id = ?').run('processing', now, id);
}

function markEmailJobSent(id) {
  const now = new Date().toISOString();
  db.prepare('UPDATE email_queue SET status = ?, updatedAt = ?, sentAt = ? WHERE id = ?').run('sent', now, now, id);
}

function markEmailJobFailed(id, errorMessage) {
  const now = new Date().toISOString();
  db.prepare('UPDATE email_queue SET status = ?, error = ?, updatedAt = ? WHERE id = ?').run('failed', errorMessage || '', now, id);
}

function getEmailQueueStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS count FROM email_queue GROUP BY status').all();
  const stats = { pending: 0, processing: 0, sent: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}

function markLeadEmailSent(leadKey) {
  const existing = getLeadByKey(leadKey);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE leads SET emailSent = ?, emailSentAt = ?, lastEmailSent = ? WHERE id = ?').run(1, now, now, existing.id);
  return getLeadByKey(leadKey);
}

initialize();

export {
  getLeads,
  saveLeads,
  clearLeads,
  replaceLeads,
  deleteLeads,
  updateLeadEmails,
  updateLeadById,
  getLeadByKey,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  compileTemplate,
  getConfig,
  saveConfig,
  enqueueEmailJob,
  getPendingEmailJobs,
  markEmailJobProcessing,
  markEmailJobSent,
  markEmailJobFailed,
  getEmailQueueStats,
  markLeadEmailSent
};
