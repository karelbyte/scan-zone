import axios from 'axios';
import { loadConfig } from './social-crawler.js';

/**
 * Envía un correo utilizando el proveedor configurado (SendGrid, Resend o SMTP).
 * @param {Object} params
 * @param {string} params.to - Correo destinatario
 * @param {string} params.subject - Asunto del correo
 * @param {string} params.html - Cuerpo del correo en HTML
 */
export async function sendEmail({ to, subject, html }) {
  const config = loadConfig();
  const service = config.emailService || 'resend'; // Por defecto Resend

  if (service === 'sendgrid') {
    const apiKey = config.sendgridApiKey || process.env.SENDGRID_API_KEY;
    const from = config.sendgridFrom || process.env.SENDGRID_FROM;

    if (!apiKey) {
      throw new Error('No se ha configurado la API Key de SendGrid en Ajustes.');
    }
    if (!from) {
      throw new Error('No se ha configurado el correo remitente (From) de SendGrid.');
    }

    // Estructura de remitente: "Nombre <email@dom.com>" o simplemente "email@dom.com"
    let fromEmail = from;
    let fromName = 'Scan Zone';
    const match = from.match(/^(.*?)\s*<(.*?)>$/);
    if (match) {
      fromName = match[1].trim();
      fromEmail = match[2].trim();
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: to }]
        }
      ],
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: subject,
      content: [
        {
          type: 'text/html',
          value: html
        }
      ]
    };

    try {
      await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return { success: true, provider: 'sendgrid' };
    } catch (err) {
      console.error('[SendGrid] Error enviando correo:', err.response?.data || err.message);
      const errors = err.response?.data?.errors;
      const errorMsg = errors ? errors.map(e => e.message).join(', ') : err.message;
      throw new Error(`Error de SendGrid: ${errorMsg}`);
    }

  } else if (service === 'resend') {
    const apiKey = config.resendApiKey || process.env.RESEND_API_KEY;
    const from = config.resendFrom || process.env.RESEND_FROM || 'onboarding@resend.dev';

    if (!apiKey) {
      throw new Error('No se ha configurado la API Key de Resend en Ajustes.');
    }

    const payload = {
      from: from,
      to: [to],
      subject: subject,
      html: html
    };

    try {
      await axios.post('https://api.resend.com/emails', payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return { success: true, provider: 'resend' };
    } catch (err) {
      console.error('[Resend] Error enviando correo:', err.response?.data || err.message);
      throw new Error(`Error de Resend: ${err.response?.data?.message || err.message}`);
    }

  } else if (service === 'smtp') {
    const host = config.smtpHost;
    const port = parseInt(config.smtpPort) || 587;
    const user = config.smtpUser;
    const pass = config.smtpPass;
    const from = config.smtpFrom;

    if (!host || !user || !pass || !from) {
      throw new Error('Faltan parámetros de configuración SMTP (Host, User, Pass o From).');
    }

    try {
      // Importamos nodemailer dinámicamente. Si no está instalado, fallará con un mensaje claro.
      let nodemailer;
      try {
        nodemailer = await import('nodemailer');
      } catch (e) {
        throw new Error('El módulo "nodemailer" no está instalado. Ejecuta "npm install nodemailer" en la terminal del proyecto para habilitar SMTP.');
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true para puerto 465, false para otros
        auth: {
          user,
          pass
        }
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        html
      });

      return { success: true, provider: 'smtp' };
    } catch (err) {
      console.error('[SMTP] Error enviando correo:', err.message);
      throw new Error(`Error de SMTP: ${err.message}`);
    }
  } else {
    throw new Error(`Proveedor de correo no soportado: ${service}`);
  }
}
