import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfig as getConfigFromDb, saveConfig as saveConfigToDb } from './sqlite-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio donde Chrome guardará la sesión persistente (cookies, localStorage, etc.)
const SESSION_DIR = path.join(__dirname, '../data/chrome-session');

export function loadConfig() {
  return getConfigFromDb();
}

export function saveConfig(config) {
  return saveConfigToDb(config);
}

export function getGeminiApiKey() {
  return loadConfig().geminiApiKey || process.env.GEMINI_API_KEY || null;
}

export function getGroqApiKey() {
  return loadConfig().groqApiKey || process.env.GROQ_API_KEY || null;
}

export function getProvider() {
  return loadConfig().provider || 'gemini';
}

// ── Estado del navegador de login ────────────────────────────────────────────

let loginBrowserInstance = null;
let loginBrowserStatus = 'closed'; // 'closed' | 'open' | 'logged_in'

export function getLoginStatus() {
  return loginBrowserStatus;
}

/**
 * Abre Chrome visible para que el usuario inicie sesión en Facebook.
 * La sesión queda guardada en SESSION_DIR para usos futuros.
 */
export async function openLoginBrowser(onStatusChange) {
  if (loginBrowserInstance) {
    try { await loginBrowserInstance.close(); } catch {}
  }

  fs.mkdirSync(SESSION_DIR, { recursive: true });

  loginBrowserStatus = 'open';
  onStatusChange?.('open');

  loginBrowserInstance = await puppeteer.launch({
    headless: false,
    userDataDir: SESSION_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: null,
  });

  const pages = await loginBrowserInstance.pages();
  const page = pages[0] || await loginBrowserInstance.newPage();

  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });

  // Detectar cuando el usuario ya inició sesión vigilando la URL o el perfil
  const checkLoginInterval = setInterval(async () => {
    try {
      const url = page.url();
      const isLoggedIn = url.includes('facebook.com') &&
        !url.includes('login') &&
        !url.includes('checkpoint');

      if (isLoggedIn) {
        // Verificar que el menú de usuario esté presente
        const profileExists = await page.$('[data-testid="royal_login_form"]').catch(() => null);
        if (!profileExists) {
          clearInterval(checkLoginInterval);
          loginBrowserStatus = 'logged_in';
          onStatusChange?.('logged_in');
        }
      }
    } catch {}
  }, 2000);

  // Limpiar si el usuario cierra el navegador manualmente
  loginBrowserInstance.on('disconnected', () => {
    clearInterval(checkLoginInterval);
    loginBrowserInstance = null;
    if (loginBrowserStatus !== 'logged_in') {
      loginBrowserStatus = 'closed';
      onStatusChange?.('closed');
    } else {
      onStatusChange?.('session_saved');
    }
  });
}

/**
 * Cierra el navegador de login si está abierto.
 */
export async function closeLoginBrowser() {
  if (loginBrowserInstance) {
    try { await loginBrowserInstance.close(); } catch {}
    loginBrowserInstance = null;
  }
  loginBrowserStatus = 'closed';
}

/**
 * Verifica si existe una sesión guardada (el usuario ya se logueó antes).
 */
export function hasSession() {
  return fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0;
}

// ── Scraping con sesión guardada ─────────────────────────────────────────────

/**
 * Navega a una URL de red social, toma un screenshot del área de contacto
 * y usa Visión IA (Gemini o Groq) para extraer los datos de contacto.
 */
export async function scrapeWithVision(socialUrl) {
  const provider = getProvider();
  let apiKey;

  if (provider === 'gemini') {
    apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Se requiere una API Key de Gemini. Configúrala en Ajustes.');
    }
  } else if (provider === 'groq') {
    apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error('Se requiere una API Key de Groq. Configúrala en Ajustes.');
    }
  } else {
    throw new Error(`Proveedor no soportado: ${provider}`);
  }

  if (!hasSession()) {
    throw new Error('No hay sesión de Facebook guardada. Usa "Conectar Facebook" primero.');
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: SESSION_DIR,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,900',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();

    // Evitar detección de bot
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-MX,es;q=0.9' });

    await page.goto(socialUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar a que cargue contenido
    await new Promise(r => setTimeout(r, 3000));

    // Intentar hacer scroll para revelar la sección "Información" en Facebook
    try {
      // Buscar pestaña "Información" y hacer click si existe
      const infoTab = await page.$x('//a[contains(., "Información") or contains(., "About")]');
      if (infoTab.length > 0) {
        await infoTab[0].click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch {}

    // Tomar screenshot completo de la página
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      fullPage: false, // Solo el viewport visible — suficiente para el panel lateral
    });

    // Enviar al proveedor de Visión seleccionado
    let contactInfo;
    if (provider === 'gemini') {
      contactInfo = await extractContactWithGemini(screenshotBuffer, apiKey);
    } else {
      contactInfo = await extractContactWithGroq(screenshotBuffer, apiKey);
    }

    return contactInfo;
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

// ── Extracción con Gemini Vision ─────────────────────────────────────────────

/**
 * Envía un screenshot a Gemini Vision y extrae datos de contacto estructurados.
 */
async function extractContactWithGemini(imageBuffer, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Analiza esta captura de pantalla de una página de red social (Facebook, Instagram, etc.) de un negocio.
Extrae ÚNICAMENTE la información de contacto que sea CLARAMENTE VISIBLE en la imagen.

Responde SOLO con un objeto JSON con esta estructura exacta (sin markdown, sin texto extra):
{
  "emails": ["correo1@ejemplo.com"],
  "phone": "número de teléfono o null",
  "address": "dirección completa o null",
  "whatsapp": "número de WhatsApp o null",
  "website": "URL del sitio web si aparece o null"
}

Si no encuentras algún dato, pon null o array vacío. No inventes datos.`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: 'image/jpeg',
    },
  };

  console.log('[Social][Gemini] Prompt enviado al modelo:');
  console.log(prompt);

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();

  console.log('[Social][Gemini] Respuesta bruta del modelo:');
  console.log(text);

  // Limpiar respuesta de posibles bloques markdown
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    return {
      emails: Array.isArray(parsed.emails) ? parsed.emails.filter(Boolean) : [],
      phone: parsed.phone || null,
      address: parsed.address || null,
      whatsapp: parsed.whatsapp || null,
      website: parsed.website || null,
    };
  } catch (parseError) {
    console.error('[Gemini] Respuesta no parseable:', text);
    console.error('[Gemini] Error de parseo:', parseError.message);
    return { emails: [], phone: null, address: null, whatsapp: null, website: null };
  }
}

// ── Extracción con Groq Vision (Llama 4 Scout) ───────────────────────────────────────
/**
 * Envía un screenshot a Groq Vision y extrae datos de contacto estructurados.
 */
async function extractContactWithGroq(imageBuffer, apiKey) {
  const imageBase64 = imageBuffer.toString('base64');
  const prompt = `Analiza esta captura de pantalla de una página de red social (Facebook, Instagram, etc.) de un negocio.
Extrae ÚNICAMENTE la información de contacto que sea CLARAMENTE VISIBLE en la imagen.

Responde SOLO con un objeto JSON con esta estructura exacta:
{
  "emails": ["correo1@ejemplo.com"],
  "phone": "número de teléfono o null",
  "address": "dirección completa o null",
  "whatsapp": "número de WhatsApp o null",
  "website": "URL del sitio web si aparece o null"
}

Si no encuentras algún dato, pon null o array vacío. No inventes datos.`;

  console.log('[Social][Groq] Prompt enviado al modelo:');
  console.log(prompt);

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content.trim();
    console.log('[Social][Groq] Respuesta bruta del modelo:');
    console.log(text);

    const parsed = JSON.parse(text);
    return {
      emails: Array.isArray(parsed.emails) ? parsed.emails.filter(Boolean) : [],
      phone: parsed.phone || null,
      address: parsed.address || null,
      whatsapp: parsed.whatsapp || null,
      website: parsed.website || null,
    };
  } catch (error) {
    console.error('[Groq] Error parseando respuesta o llamando a la API:', error.response?.data || error.message);
    return { emails: [], phone: null, address: null, whatsapp: null, website: null };
  }
}
