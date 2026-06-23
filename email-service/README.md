# ES Tools — Email service (SMTP)

A small AWS Lambda that receives a generated Photo Report PDF from the web app and
emails it via SMTP using [nodemailer](https://nodemailer.com/). SMTP credentials are
read from environment variables — nothing secret is committed.

## Request

`POST` JSON:

```json
{
  "to": ["client@example.com", "sverma@engsurveys.com.au"],
  "subject": "Photo Report — 6039 Main South Rd, Yankalilla",
  "text": "Please find attached the photo report.",
  "filename": "Photo Report - Yankalilla.pdf",
  "pdfBase64": "<base64 of the PDF, no data: prefix>"
}
```

Responds `200 { "ok": true }` on success.

## Environment variables

| Var | Example | Notes |
|-----|---------|-------|
| `SMTP_HOST` | `smtp.office365.com` | Your mail server |
| `SMTP_PORT` | `587` | `465` if using TLS-on-connect |
| `SMTP_SECURE` | `false` | `true` only for port 465 |
| `SMTP_USER` | `reports@engsurveys.com.au` | SMTP login |
| `SMTP_PASS` | `••••••` | Password / app password (store as a secret) |
| `SMTP_FROM` | `Engineering Surveys <reports@engsurveys.com.au>` | From header |

See `.env.example`.

## Deploy (AWS Lambda + API Gateway)

```bash
cd email-service
npm install
zip -r function.zip index.js node_modules package.json
```

1. Create a Node.js 18+ Lambda, upload `function.zip`, handler `index.handler`.
2. Set the environment variables above (put `SMTP_PASS` in Secrets Manager / encrypted env).
3. Add an API Gateway trigger (HTTP API, route `POST /send-report`), enable CORS.
4. Copy the invoke URL into the web app:

```
# es_tools/.env
REACT_APP_EMAIL_ENDPOINT=https://<your-api-id>.execute-api.ap-southeast-2.amazonaws.com/send-report
```

Then rebuild the web app. The "Generate & email" button will send to the client email
(if entered) and always copy `sverma@engsurveys.com.au` (change in
`src/tools/PhotoReport.js` → `AUTO_REPORT_RECIPIENT` after testing).

## Note on Amplify / SES
This app runs on AWS Amplify, so you can alternatively swap the transport for **Amazon SES**
(`aws-sdk` `SESv2`/`sendRawEmail`) to avoid managing SMTP credentials — the request/response
shape stays the same. Ask if you'd like that variant instead.
