import {
  getTemplates as sqliteGetTemplates,
  saveTemplate as sqliteSaveTemplate,
  deleteTemplate as sqliteDeleteTemplate,
  compileTemplate as sqliteCompileTemplate
} from './sqlite-db.js';

export function getTemplates() {
  return sqliteGetTemplates();
}

export function saveTemplate(template) {
  return sqliteSaveTemplate(template);
}

export function deleteTemplate(id) {
  return sqliteDeleteTemplate(id);
}

export function compileTemplate(template, lead) {
  return sqliteCompileTemplate(template, lead);
}
