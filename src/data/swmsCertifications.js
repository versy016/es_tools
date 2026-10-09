// Licences, qualifications and certifications surveyors can pick in the SWMS tool
// (section "Staff licenses, qualifications & certifications"). Each entry is printed
// into the generated document exactly as written here, joined with ", ".
// Add new certifications to this list to make them available in the picker.
export const CERTIFICATIONS = [
    'White card (CPCWHS1001)',
    'Confined space (MSAPMPER200, MSAPMPER205, MSAPMPER217)',
    'Provide First Aid (HLTAID009, HLTAID010, HLTAID011)',
    'DBYD Locator Certification',
    'RIW',
];

// Combine the picked certifications and any free-text extra into the single string the
// template's {{license_N_qualifications}} field expects.
export const formatQualifications = (certs = [], other = '') =>
    [...certs, other.trim()].filter(Boolean).join(', ');
