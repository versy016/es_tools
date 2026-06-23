// AWS Lambda handler that emails the Photo Report PDF via SMTP (nodemailer).
// Deploy behind API Gateway and point the frontend's REACT_APP_EMAIL_ENDPOINT at it.
// All SMTP settings come from environment variables — no secrets in code.

const nodemailer = require('nodemailer');

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
};

let transporter;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true', // true for port 465
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporter;
};

const methodOf = (event) =>
    event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);

exports.handler = async (event) => {
    if (methodOf(event) === 'OPTIONS') {
        return { statusCode: 200, headers: CORS, body: '' };
    }

    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
        const { to, subject, text, html, filename, pdfBase64 } = body;

        const recipients = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : []);
        if (recipients.length === 0) {
            return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No recipients provided.' }) };
        }

        const attachments = pdfBase64
            ? [{ filename: filename || 'Photo Report.pdf', content: pdfBase64, encoding: 'base64', contentType: 'application/pdf' }]
            : [];

        await getTransporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipients.join(','),
            subject: subject || 'Photo Report',
            text: text || 'Please find the attached report.',
            html,
            attachments,
        });

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
        console.error('Email send failed:', err);
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
};
