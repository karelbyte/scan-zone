import axios from 'axios';
import * as cheerio from 'cheerio';

// User-agent para simular un navegador real
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Expresión regular para correos electrónicos válidos
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,20}/g;

// Extensiones de archivos comunes a ignorar en la detección de correos
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.webp', '.pdf', '.zip'];

// Dominios o correos falsos comunes a ignorar
const IGNORED_EMAILS = [
  'sentry.io',
  'bootstrap',
  'jquery',
  'w3.org',
  'example.com',
  'domain.com',
  'email@email.com',
  'correo@correo.com',
  'yourdomain.com'
];

/**
 * Decodifica correos protegidos por Cloudflare Email Protection.
 * Cloudflare aplica XOR con el primer byte como clave sobre la cadena hex en data-cfemail.
 * También puede aparecer en hrefs tipo /cdn-cgi/l/email-protection#HEXDATA
 */
function decodeCloudflareEmail(encodedHex) {
  try {
    const hex = encodedHex.replace(/^#/, '');
    const bytes = hex.match(/.{2}/g);
    if (!bytes || bytes.length < 2) return null;
    const key = parseInt(bytes[0], 16);
    const decoded = bytes.slice(1).map(b => String.fromCharCode(parseInt(b, 16) ^ key)).join('');
    // Verificar que tenga formato de email válido
    if (decoded.includes('@') && decoded.includes('.')) return decoded;
    return null;
  } catch {
    return null;
  }
}

/**
 * Normaliza y limpia una URL asegurando que tenga protocolo
 */
function normalizeUrl(url) {
  if (!url) return null;
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  return cleanUrl;
}

/**
 * Filtra correos válidos descartando extensiones de imagen y correos genéricos de plantillas
 */
function cleanEmails(emails) {
  if (!emails || !emails.length) return [];
  
  return Array.from(new Set(emails.map(e => e.toLowerCase().trim())))
    .filter(email => {
      // Validar longitud razonable
      if (email.length < 5 || email.length > 80) return false;
      
      // Ignorar si termina con extensiones de archivos estáticos
      const hasIgnoredExtension = IGNORED_EXTENSIONS.some(ext => email.endsWith(ext));
      if (hasIgnoredExtension) return false;

      // Ignorar correos genéricos de plantillas
      const isIgnoredEmail = IGNORED_EMAILS.some(ignored => email.includes(ignored));
      if (isIgnoredEmail) return false;

      // Validar formato de dominio básico (debe tener un punto en el dominio)
      const domain = email.split('@')[1];
      if (!domain || !domain.includes('.')) return false;

      return true;
    });
}

/**
 * Extrae redes sociales del HTML parseado
 */
function extractSocials($, baseUrl) {
  const socials = {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
  };

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href').trim();
    if (href.includes('facebook.com')) socials.facebook = href;
    else if (href.includes('instagram.com')) socials.instagram = href;
    else if (href.includes('linkedin.com')) socials.linkedin = href;
    else if (href.includes('twitter.com') || href.includes('x.com')) socials.twitter = href;
  });

  return socials;
}

/**
 * Obtiene links internos de contacto o sobre nosotros
 */
function getContactLinks($, baseUrl) {
  const links = new Set();
  const contactKeywords = ['contact', 'contacto', 'nosotros', 'about', 'quienes', 'quiénes', 'localización', 'donde', 'dónde', 'legal', 'aviso'];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    // Verificar si es un link interno o relativo
    try {
      const resolvedUrl = new URL(href, baseUrl);
      if (resolvedUrl.hostname === new URL(baseUrl).hostname) {
        const pathLower = resolvedUrl.pathname.toLowerCase();
        const textLower = $(element).text().toLowerCase();

        const matchKeyword = contactKeywords.some(keyword => 
          pathLower.includes(keyword) || textLower.includes(keyword)
        );

        if (matchKeyword) {
          links.add(resolvedUrl.href);
        }
      }
    } catch (e) {
      // Ignorar URLs inválidas
    }
  });

  // Limitar a máximo 3 subpáginas para evitar ciclos infinitos y lentitud
  return Array.from(links).slice(0, 3);
}

/**
 * Escanea una sola página web para extraer correos y redes sociales
 */
async function fetchPageData(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
      validateStatus: () => true, // Procesar respuestas redirect o errores de forma controlada
    });

    if (response.status >= 400) {
      return { html: '', emails: [], socials: {} };
    }

    const html = response.data;
    if (typeof html !== 'string') return { html: '', emails: [], socials: {} };

    const $ = cheerio.load(html);
    
    // Buscar emails en el texto completo y en los atributos href (ej. mailto:contacto@...)
    const foundEmails = [];
    const textContent = $('body').text() || '';
    const bodyMatches = textContent.match(EMAIL_REGEX) || [];
    foundEmails.push(...bodyMatches);

    $('a[href^="mailto:"]').each((_, el) => {
      const mailto = $(el).attr('href');
      const email = mailto.replace(/mailto:\s*/i, '').split('?')[0];
      foundEmails.push(email);
    });

    // Decodificar correos protegidos por Cloudflare Email Protection
    // Caso 1: <span data-cfemail="HEX">
    $('[data-cfemail]').each((_, el) => {
      const encoded = $(el).attr('data-cfemail');
      if (encoded) {
        const decoded = decodeCloudflareEmail(encoded);
        if (decoded) foundEmails.push(decoded);
      }
    });
    // Caso 2: href="/cdn-cgi/l/email-protection#HEX"
    $('a[href*="/cdn-cgi/l/email-protection"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const hashIdx = href.indexOf('#');
      if (hashIdx !== -1) {
        const encoded = href.slice(hashIdx + 1);
        const decoded = decodeCloudflareEmail(encoded);
        if (decoded) foundEmails.push(decoded);
      }
    });

    const cleaned = cleanEmails(foundEmails);
    const socials = extractSocials($, url);

    return { html, emails: cleaned, socials, cheerioInstance: $ };
  } catch (error) {
    // console.log(`Error escaneando url ${url}:`, error.message);
    return { html: '', emails: [], socials: {} };
  }
}

/**
 * Detecta si una URL pertenece a una red social conocida
 * Devuelve { isSocial: true, platform, socials } o { isSocial: false }
 */
function detectSocialUrl(url) {
  const lower = url.toLowerCase();
  const platforms = [
    { key: 'facebook',  patterns: ['facebook.com', 'fb.com'] },
    { key: 'instagram', patterns: ['instagram.com', 'instagr.am'] },
    { key: 'linkedin',  patterns: ['linkedin.com'] },
    { key: 'twitter',   patterns: ['twitter.com', 'x.com'] },
    { key: 'youtube',   patterns: ['youtube.com', 'youtu.be'] },
    { key: 'tiktok',    patterns: ['tiktok.com'] },
  ];

  for (const { key, patterns } of platforms) {
    if (patterns.some(p => lower.includes(p))) {
      const socials = { facebook: '', instagram: '', linkedin: '', twitter: '' };
      if (key in socials) socials[key] = url;
      return { isSocial: true, platform: key, socials };
    }
  }
  return { isSocial: false };
}

/**
 * Función principal interna para escanear un sitio web completo (Home + Subpáginas de contacto)
 */
async function crawlWebsiteLogic(targetUrl) {
  const normalized = normalizeUrl(targetUrl);
  if (!normalized) return { emails: [], socials: {} };

  // Detectar si la URL es directamente una red social (Facebook, Instagram, etc.)
  // Estas plataformas bloquean scrapers y requieren JavaScript — no se puede extraer correos de ellas
  const socialCheck = detectSocialUrl(normalized);
  if (socialCheck.isSocial) {
    console.log(`[Crawler] URL de red social detectada (${socialCheck.platform}): ${normalized} — omitiendo scraping.`);
    return {
      emails: [],
      socials: socialCheck.socials,
      _note: `Sitio web es una página de ${socialCheck.platform}. Los correos deben buscarse manualmente.`
    };
  }

  // 1. Escanear la página de inicio
  const homeResult = await fetchPageData(normalized);
  let allEmails = [...homeResult.emails];
  const socials = { ...homeResult.socials };

  // 2. Si tiene éxito y encontramos el cheerio de la home, buscar subpáginas de contacto
  if (homeResult.cheerioInstance) {
    const contactLinks = getContactLinks(homeResult.cheerioInstance, normalized);
    
    // Escanear páginas de contacto en paralelo con límite de tiempo
    const subpagesPromises = contactLinks.map(async (link) => {
      const pageResult = await fetchPageData(link);
      return pageResult.emails;
    });

    try {
      const subpagesEmails = await Promise.all(subpagesPromises);
      subpagesEmails.forEach(emails => {
        allEmails.push(...emails);
      });
    } catch (e) {
      // Ignorar fallos en subpáginas
    }
  }

  return {
    emails: cleanEmails(allEmails),
    socials
  };
}

/**
 * Función principal expuesta con un timeout absoluto e inviolable de 15 segundos
 */
export async function crawlWebsite(targetUrl) {
  try {
    return await Promise.race([
      crawlWebsiteLogic(targetUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout absoluto de 15s superado')), 15000))
    ]);
  } catch (error) {
    console.warn(`[Crawler] Advertencia en ${targetUrl}: ${error.message}`);
    return {
      emails: [],
      socials: { facebook: '', instagram: '', linkedin: '', twitter: '' }
    };
  }
}
