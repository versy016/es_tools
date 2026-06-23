// Dev helper: normalise the Service Location .docx template for docxtemplater.
// 1) Collapse tags that Word split across runs (e.g. {Tele…} → one run).
// 2) Turn the single {photos} placeholder into an image loop {#photos}{%data}{/photos}.
// Run after replacing the template:  node scripts/prep-template.js
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const file = path.join(__dirname, '..', 'public', 'templates', 'service-location.docx');
const zip = new PizZip(fs.readFileSync(file));
let xml = zip.file('word/document.xml').asText();

// Collapse any run-boundary XML (and stray whitespace) that sits inside { … }.
xml = xml.replace(/\{[^{}]*\}/g, (m) => m.replace(/<[^>]+>/g, '').replace(/\s+/g, ''));

// Multiple photos: loop + image tag.
xml = xml.replace(/\{photos\}/g, '{#photos}{%data}{/photos}');

zip.file('word/document.xml', xml);
fs.writeFileSync(file, zip.generate({ type: 'nodebuffer' }));
fs.writeFileSync(path.join(__dirname, 'prep-template.done'), 'ok ' + new Date().toISOString());
