/**
 * Lista negra de palabras clave para descartar leads.
 * Si el nombre del negocio contiene alguna de estas palabras (insensible a mayúsculas/acentos),
 * el lead es ignorado durante el scraping de Google Maps.
 *
 * Agrega o quita palabras según necesites.
 */
export const BLACKLIST_KEYWORDS = [
  // Cadenas de farmacias / supermercados / tiendas de descuento
  'simi',
  'aurora',
  'aurrera',
  'sams',
  "sam's",
  'walmart',
  'bodega aurrera',
  'chedraui',
  'soriana',
  'oxxo',
  'seven eleven',
  '7-eleven',
  'costco',
  'superama',
  'comercial mexicana',
  'mega',
  'liverpool',
  'sears',
  'suburbia',
  'h&m',
  'zara',
  'sanborns',
  'vips',
  'dominos',
  "domino's",
  'mcdonalds',
  "mcdonald's",
  'subway',
  'starbucks',
  'kfc',
  'burger king',
  'pizza hut',
  'Milano',
  'Modatelas',
  'Merza'
];

/**
 * Verifica si un nombre de negocio está en la lista negra.
 * @param {string} name - Nombre del negocio a verificar
 * @returns {boolean} true si debe ser descartado
 */
export function isBlacklisted(name) {
  if (!name) return false;
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BLACKLIST_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized.includes(normalizedKeyword);
  });
}
