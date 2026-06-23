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

// Multiple photos: loop + image tag. The image module requires the {%data} tag to
// be alone in its own <w:t> run, so split the loop across three runs in the paragraph.
xml = xml.replace(/\{photos\}/g,
    '{#photos}</w:t></w:r><w:r><w:t xml:space="preserve">{%data}</w:t></w:r><w:r><w:t xml:space="preserve">{/photos}');

// When DBYD is supplied by the client, skip the whole DBYD table and show a note instead.
// Wrap the DBYD table (its own <w:tbl>) in an inverse section, then add the note after it.
const dStart = xml.indexOf('{dbydjobno}');
const dEnd = xml.indexOf('{plansupply}');
if (dStart >= 0 && dEnd >= 0) {
    const tblStart = xml.lastIndexOf('<w:tbl>', dStart);
    const tblEnd = xml.indexOf('</w:tbl>', dEnd);
    if (tblStart >= 0 && tblEnd >= 0) {
        const end = tblEnd + '</w:tbl>'.length;
        const before = '<w:p><w:r><w:t>{^dbydByClient}</w:t></w:r></w:p>';
        const after = '<w:p><w:r><w:t>{/dbydByClient}</w:t></w:r></w:p>'
            + '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{#dbydByClient}DBYD to be supplied by client{/dbydByClient}</w:t></w:r></w:p>';
        xml = xml.slice(0, tblStart) + before + xml.slice(tblStart, end) + after + xml.slice(end);
    }
}

zip.file('word/document.xml', xml);
fs.writeFileSync(file, zip.generate({ type: 'nodebuffer' }));
fs.writeFileSync(path.join(__dirname, 'prep-template.done'), 'ok ' + new Date().toISOString());
