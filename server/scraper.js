import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { isBlacklisted } from './blacklist.js';

puppeteer.use(StealthPlugin());

/**
 * Espera un número aleatorio de milisegundos entre min y max
 */
const delay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

/**
 * Función principal de scraping de Google Maps
 * @param {string} query Término de búsqueda (ej. "dentistas madrid")
 * @param {number} limit Límite máximo de resultados a extraer
 * @param {function} onProgress Callback para enviar actualizaciones en tiempo real
 */
export async function scrapeGoogleMaps(query, limit = 20, onProgress = () => {}, shouldStop = () => false, existingKeys = new Set()) {
  console.log(`Iniciando scrape de Google Maps para: "${query}" con límite de ${limit}`);
  onProgress({ status: 'info', message: 'Iniciando navegador automatizado...' });

  const browser = await puppeteer.launch({
    headless: 'new', // Modo headless optimizado
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Navegar a Google Maps con la búsqueda integrada en la URL
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    onProgress({ status: 'info', message: 'Cargando Google Maps...' });
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // 2. Manejar cartel de Cookies / Consentimiento si aparece
    onProgress({ status: 'info', message: 'Verificando diálogos de cookies...' });
    try {
      const cookieButtons = await page.$$('form button, [aria-label*="Aceptar"], [aria-label*="Agree"], button[class*="VfPpkd"]');
      for (const btn of cookieButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (
          text.includes('Aceptar todo') || 
          text.includes('Acepto') || 
          text.includes('Accept all') || 
          text.includes('I agree')
        ) {
          onProgress({ status: 'info', message: 'Aceptando términos de privacidad de Google...' });
          await btn.click();
          await delay(2000, 3000);
          break;
        }
      }
    } catch (err) {
      // Ignorar si no aparece el banner
    }

    // 3. Hacer scroll en la barra lateral izquierda para cargar los resultados solicitados
    onProgress({ status: 'info', message: 'Cargando lista de establecimientos...' });
    
    // El contenedor de la barra lateral suele tener rol "feed"
    const feedSelector = 'div[role="feed"]';
    let feedExists = false;

    try {
      await page.waitForSelector(feedSelector, { timeout: 10000 });
      feedExists = true;
    } catch (e) {
      // A veces no hay rol feed si hay un solo resultado directo o si cambió la estructura
      onProgress({ status: 'warning', message: 'Contenedor de resultados alternativo detectado.' });
    }

    let leadsFound = [];
    
    if (feedExists) {
      let previousCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 30;

      while (scrollAttempts < maxScrollAttempts) {
        // Obtener enlaces cargados en este intento de scroll
        const placeHrefsAndTitles = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
          return anchors.map(a => ({
            href: a.href,
            title: a.getAttribute('aria-label') || ''
          }));
        });

        // Filtrar únicos cargados
        const uniqueInTanda = [];
        const seenHrefsTanda = new Set();
        for (const item of placeHrefsAndTitles) {
          if (!seenHrefsTanda.has(item.href)) {
            seenHrefsTanda.add(item.href);
            uniqueInTanda.push(item);
          }
        }

        // Contar cuántos son nuevos
        let newCount = 0;
        for (const item of uniqueInTanda) {
          let placeId = '';
          const match = item.href.match(/!1s([^!]+)/);
          if (match && match[1]) {
            placeId = match[1];
          }
          const cleanName = item.title.trim();
          const isExisting = (placeId && existingKeys.has(placeId)) || existingKeys.has(cleanName);
          if (!isExisting && !isBlacklisted(cleanName)) {
            newCount++;
          }
        }
        
        onProgress({ 
          status: 'progress', 
          message: `Nuevos detectados: ${newCount}/${limit} (Cargados en total: ${uniqueInTanda.length})`,
          progress: Math.min(50, Math.floor((newCount / limit) * 50)) 
        });

        // Si ya cargamos suficientes elementos NUEVOS, paramos de scrollar
        if (newCount >= limit) {
          break;
        }

        // Hacer scroll hacia abajo en la barra lateral
        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollBy(0, 1000);
          }
        }, feedSelector);

        await delay(1500, 2500);

        // Verificar si llegamos al final de la lista
        const isEnd = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          return bodyText.includes('Has llegado al final') || bodyText.includes("You've reached the end");
        });

        if (isEnd) {
          onProgress({ status: 'info', message: 'Se ha alcanzado el final de los resultados en Google Maps.' });
          break;
        }

        const count = uniqueInTanda.length;
        // Si después de varios intentos no carga más elementos, salimos del bucle
        if (count === previousCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
        previousCount = count;
      }
    }

    // Obtener los enlaces a todos los lugares cargados en la lista
    const placeLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return anchors.map(a => ({
        href: a.href,
        title: a.getAttribute('aria-label') || ''
      }));
    });

    const uniqueLinks = [];
    const seenHrefs = new Set();
    for (const link of placeLinks) {
      if (!seenHrefs.has(link.href)) {
        seenHrefs.add(link.href);
        
        let placeId = '';
        const match = link.href.match(/!1s([^!]+)/);
        if (match && match[1]) {
          placeId = match[1];
        }
        const cleanName = link.title.trim();
        const isExisting = (placeId && existingKeys.has(placeId)) || existingKeys.has(cleanName);

        if (!isExisting && !isBlacklisted(cleanName) && uniqueLinks.length < limit) {
          uniqueLinks.push(link);
        }
      }
    }

    onProgress({ status: 'info', message: `Extrayendo información detallada para ${uniqueLinks.length} establecimientos...` });

    // 4. Visitar o hacer click en cada elemento para extraer la información detallada
    for (let i = 0; i < uniqueLinks.length; i++) {
      // Verificar si el usuario solicitó parar antes de cada lugar
      if (shouldStop()) {
        onProgress({ status: 'warning', message: `Escaneo detenido por el usuario en el elemento ${i + 1}.` });
        break;
      }

      const place = uniqueLinks[i];
      const placeUrl = place.href;

      onProgress({ 
        status: 'scraping', 
        message: `Extrayendo (${i + 1}/${uniqueLinks.length}): ${place.title}`,
        progress: 50 + Math.floor(((i + 1) / uniqueLinks.length) * 50)
      });

      try {
        // Navegar directamente al detalle del lugar en una nueva pestaña o en la misma para ahorrar memoria
        await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(1000, 2000);

        // Extraer los datos mediante selectores de atributos estables (data-item-id)
        const detailData = await page.evaluate(() => {
          // 1. Obtener Nombre (el h1 dentro del panel de detalle)
          const nameEl = document.querySelector('h1');
          const name = nameEl ? nameEl.textContent.trim() : '';

          // 2. Dirección
          const addressEl = document.querySelector('[data-item-id="address"]');
          const address = addressEl ? addressEl.textContent.trim() : '';

          // 3. Teléfono (comienza por phone:tel:)
          const phoneEl = document.querySelector('[data-item-id^="phone:tel:"]');
          const phone = phoneEl ? phoneEl.textContent.trim() : '';

          // 4. Sitio Web (authority)
          const webEl = document.querySelector('[data-item-id="authority"]');
          const website = webEl ? webEl.getAttribute('href') || '' : '';

          // 5. Rating y Reviews
          // Buscamos la clase F7nice que suele contener las estrellas
          const ratingContainer = document.querySelector('div.F7nice');
          let rating = '';
          let reviews = '';
          if (ratingContainer) {
            const spans = ratingContainer.querySelectorAll('span');
            if (spans.length > 0) rating = spans[0].textContent.trim();
            if (spans.length > 1) reviews = spans[1].textContent.trim().replace(/[()]/g, '');
          }

          // Intentar parsear el ID del lugar desde la URL
          return {
            name,
            address,
            phone,
            website,
            rating,
            reviews
          };
        });

        // Extraer el placeId de la URL para usar como clave única
        let placeId = '';
        const match = placeUrl.match(/!1s([^!]+)/);
        if (match && match[1]) {
          placeId = match[1];
        }

        leadsFound.push({
          placeId,
          url: placeUrl,
          ...detailData,
          emails: [], // Se llenará en la siguiente fase
          socials: { facebook: '', instagram: '', linkedin: '', twitter: '' },
          scannedAt: new Date().toISOString()
        });

      } catch (err) {
        console.error(`Error extrayendo detalles para ${place.title}:`, err);
        // Agregar con datos mínimos si falla
        leadsFound.push({
          placeId: '',
          url: placeUrl,
          name: place.title,
          address: '',
          phone: '',
          website: '',
          rating: '',
          reviews: '',
          emails: [],
          socials: { facebook: '', instagram: '', linkedin: '', twitter: '' },
          scannedAt: new Date().toISOString()
        });
      }
    }

    const filteredLeads = leadsFound.filter(lead => {
      const hasWebsite = lead.website && lead.website.trim();
      const hasEmails = Array.isArray(lead.emails) && lead.emails.length > 0;
      // Descartar si está en la lista negra
      if (isBlacklisted(lead.name)) {
        return false;
      }
      // Descartar si no tiene web ni correo (no hay forma de contactar digitalmente)
      if (!hasWebsite && !hasEmails) {
        return false;
      }
      return true;
    });

    onProgress({ status: 'success', message: `Extracción de Google Maps completada con éxito. ${filteredLeads.length} negocios encontrados (${leadsFound.length - filteredLeads.length} descartados por no tener web/correo o estar en lista negra).` });
    return filteredLeads;

  } catch (error) {
    console.error('Error en el proceso de scraping:', error);
    onProgress({ status: 'error', message: `Error en el scraping: ${error.message}` });
    throw error;
  } finally {
    await browser.close();
  }
}
