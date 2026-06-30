/**
 * Configuración del agente autónomo.
 * 
 * Filosofía: conservador para evitar bans. Preferimos sacar 1,000 leads limpios al día
 * a ser bloqueados. Todos los valores son ajustables desde el API.
 */

// ── Categorías a buscar ──────────────────────────────────────────────────────
// Cada categoría se buscará en cada municipio de cada estado.
// El query final será: "{category} {municipality} {state}"

export const DEFAULT_CATEGORIES = [
  'dentistas',
  'veterinarias',
  'restaurantes',
  'gimnasios',
  'estéticas',
  'talleres mecánicos',
  'clínicas',
  'hoteles',
  'inmobiliarias',
  'escuelas particulares',
];

// ── Delays (en milisegundos) ─────────────────────────────────────────────────
// Todos son rangos [min, max] para aleatorizar y parecer humano.

export const DELAYS = {
  // Entre cada búsqueda en Google Maps (el más importante anti-ban)
  betweenSearches: { min: 45000, max: 90000 },  // 45-90 segundos

  // Entre cada crawl de sitio web para extraer email
  betweenCrawls: { min: 3000, max: 8000 },  // 3-8 segundos

  // Entre cada envío de email
  betweenEmails: { min: 15000, max: 30000 },  // 15-30 segundos

  // Entre cada uso de AI vision (Gemini/Groq)
  betweenVisionCalls: { min: 5000, max: 12000 },  // 5-12 segundos

  // Pausa larga después de N búsquedas consecutivas (simular descanso)
  longBreakAfter: 10,  // cada 10 búsquedas
  longBreakDuration: { min: 120000, max: 300000 },  // 2-5 minutos

  // Pausa extra larga al cambiar de estado (parece sesión nueva)
  stateChangePause: { min: 180000, max: 360000 },  // 3-6 minutos

  // Delay antes de reintentar un job fallido
  retryDelay: { min: 60000, max: 120000 },  // 1-2 minutos
};

// ── Límites diarios ──────────────────────────────────────────────────────────
// El agente se pausa automáticamente al alcanzar cualquiera de estos límites.
// Se resetean a medianoche (basado en hora local del servidor).

export const DAILY_LIMITS = {
  maxSearches: 150,       // Búsquedas de Google Maps por día
  maxEmails: 80,          // Correos enviados por día
  maxCrawls: 500,         // Sitios web crawleados por día
  maxVisionCalls: 100,    // Llamadas a AI vision por día
  maxErrors: 30,          // Si hay más de 30 errores en un día, pausar (algo anda mal)
};

// ── Scraping config ──────────────────────────────────────────────────────────

export const SCRAPING = {
  // Máximo de leads a extraer por búsqueda (Google Maps scroll)
  leadsPerSearch: 15,

  // Timeout para carga de página en Puppeteer (ms)
  pageTimeout: 30000,

  // Máximo de reintentos por job antes de marcarlo como 'failed'
  maxRetries: 3,

  // Si un lead no tiene website NI redes sociales, descartarlo
  requireWebPresence: false,

  // Intentar extraer email con AI vision si no se encontró por crawl normal
  useVisionFallback: true,

  // Solo usar vision si el lead tiene una URL de Facebook/Instagram
  visionRequiresSocialUrl: true,
};

// ── Email config ─────────────────────────────────────────────────────────────

export const EMAIL = {
  // No enviar email si el lead no tiene email válido (obvio, pero explícito)
  requireEmail: true,

  // Estrategia de selección de plantilla:
  // 'random' = rotar aleatoriamente entre las disponibles
  // 'sequential' = usar una tras otra en orden
  // 'category-mapped' = mapear categoría → plantilla específica
  templateStrategy: 'random',

  // Mapeo categoría → templateId (solo si strategy = 'category-mapped')
  categoryTemplateMap: {
    // 'dentistas': 'consultoria-ai-bot',
    // 'restaurantes': 'template-restaurantes',
  },

  // No enviar email a un lead que ya recibió uno
  skipAlreadySent: true,

  // Esperar a tener al menos N leads con email antes de enviar (batch)
  minBatchSize: 1,
};

// ── Horario de operación ─────────────────────────────────────────────────────
// El agente solo opera dentro de este horario (hora local del servidor).
// Fuera de horario se pausa solo y retoma al entrar en horario.

export const SCHEDULE = {
  enabled: true,
  // Hora de inicio (formato 24h)
  startHour: 7,
  // Hora de fin
  endHour: 23,
  // Días de la semana activos (0=Domingo, 1=Lunes, ... 6=Sábado)
  activeDays: [1, 2, 3, 4, 5, 6],  // Lunes a Sábado
};

// ── Utilidades de configuración ──────────────────────────────────────────────

/**
 * Genera un delay aleatorio entre min y max milisegundos.
 */
export function randomDelay(range) {
  const { min, max } = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Verifica si estamos dentro del horario de operación.
 */
export function isWithinSchedule() {
  if (!SCHEDULE.enabled) return true;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (!SCHEDULE.activeDays.includes(day)) return false;
  if (hour < SCHEDULE.startHour || hour >= SCHEDULE.endHour) return false;

  return true;
}

/**
 * Calcula cuántos milisegundos faltan para que inicie el próximo período activo.
 */
export function msUntilNextActiveWindow() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Si estamos fuera de horario pero el día es activo y aún no son las startHour
  if (SCHEDULE.activeDays.includes(day) && hour < SCHEDULE.startHour) {
    const target = new Date(now);
    target.setHours(SCHEDULE.startHour, 0, 0, 0);
    return target - now;
  }

  // Buscar el próximo día activo
  for (let i = 1; i <= 7; i++) {
    const nextDay = (day + i) % 7;
    if (SCHEDULE.activeDays.includes(nextDay)) {
      const target = new Date(now);
      target.setDate(target.getDate() + i);
      target.setHours(SCHEDULE.startHour, 0, 0, 0);
      return target - now;
    }
  }

  // Fallback: esperar 1 hora
  return 60 * 60 * 1000;
}

/**
 * Construye el query de búsqueda para Google Maps.
 */
export function buildSearchQuery(category, municipality, state) {
  // Para CDMX no repetir "Ciudad de México" si ya se incluye
  if (state === 'Ciudad de México') {
    return `${category} ${municipality} CDMX`;
  }
  return `${category} ${municipality} ${state}`;
}
