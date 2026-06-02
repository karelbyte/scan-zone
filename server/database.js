import {
  getLeads as sqliteGetLeads,
  saveLeads as sqliteSaveLeads,
  clearLeads as sqliteClearLeads,
  replaceLeads as sqliteReplaceLeads,
  deleteLeads as sqliteDeleteLeads,
  updateLeadEmails as sqliteUpdateLeadEmails,
  updateLeadById as sqliteUpdateLeadById,
  getLeadByKey
} from './sqlite-db.js';

export function getLeads() {
  return sqliteGetLeads();
}

export function saveLeads(newLeads) {
  return sqliteSaveLeads(newLeads);
}

export function clearLeads() {
  return sqliteClearLeads();
}

export function deleteLeads(ids) {
  return sqliteDeleteLeads(ids);
}

export function updateLeadEmails(id, emails) {
  return sqliteUpdateLeadEmails(id, emails);
}

export function updateLeadById(id, updates) {
  return sqliteUpdateLeadById(id, updates);
}

export function replaceLeads(leads) {
  return sqliteReplaceLeads(leads);
}

export { getLeadByKey };
