// Single source of truth for the DIT-specification utility legend.
// Shared by the annotation editor (PhotoAnnotator) and the PDF (PhotoReportPdf)
// so on-screen line/text-box colours always match the generated report and legend.

// `key`   - stable identifier used in annotation/pothole records
// `label` - full utility name shown in the legend
// `code`  - short code drawn on text-boxes / used in markings
// `color` - stroke / fill colour (DIT spec)
// `text`  - readable text colour to place on top of `color` for text-boxes
export const UTILITIES = [
  { key: 'gas',        label: 'Gas',                       code: 'G',     color: '#F5A623', text: '#000000' },
  { key: 'telstra',    label: 'Telstra',                   code: 'T',     color: '#FF7F00', text: '#000000' },
  { key: 'electricity',label: 'Electricity (LV and HV)',   code: 'E',     color: '#FF0000', text: '#FFFFFF' },
  { key: 'comms',      label: 'Communications/Fibre Optic',code: 'COMMS', color: '#D9D9D9', text: '#000000' },
  { key: 'water',      label: 'Water',                     code: 'W',     color: '#0000FF', text: '#FFFFFF' },
  { key: 'sewer',      label: 'Sewer',                     code: 'SWR',   color: '#00A651', text: '#FFFFFF' },
  { key: 'stormwater', label: 'Stormwater',                code: 'STW',   color: '#7030A0', text: '#FFFFFF' },
  { key: 'recycled',   label: 'Recycled Water',            code: 'RW',    color: '#7030A0', text: '#FFFFFF' },
  { key: 'unknown',    label: 'Unknown Service',           code: 'UK',    color: '#FF66CC', text: '#000000' },
  { key: 'earth',      label: 'Earth Grid (Substation)',   code: 'EG',    color: '#FFFF00', text: '#000000' },
];

// Quick lookup by key, e.g. UTILITY_BY_KEY.water.color
export const UTILITY_BY_KEY = UTILITIES.reduce((acc, u) => {
  acc[u.key] = u;
  return acc;
}, {});

// Safe accessor: never returns undefined, so the PDF renderer can always read
// .code/.color (falls back to the first utility for unknown/empty keys).
export const getUtility = (key) => UTILITY_BY_KEY[key] || UTILITIES[0];

// Quality levels for potholes / cover "Located to Quality Level".
export const QUALITY_LEVELS = ['A', 'B', 'C', 'D'];

// AS 5488.1:2022 definitions reused verbatim on the legend page of the report.
export const QUALITY_LEVEL_DEFINITIONS = [
  {
    level: 'Quality Level A (QL-A)',
    text: 'Is the highest Quality level accuracy and consists of positive identification of the attribute and location of a subsurface position in three dimensions. It is the only Quality level that defines a subsurface utility has been validated with additional attribute information (e.g. size, material, depth).',
  },
  {
    level: 'Quality Level B (QL-B)',
    text: 'A Quality level that provides relative spatial position of the subsurface utility that has been located in three dimensions (horizontal +/- 300mm & vertical +/- 500mm) by tracing with EMI (electromagnetic induction). Tracing has been achieved by applying an electromagnetic signal along or within the utility and traced to a known or visible end point.',
  },
  {
    level: 'Quality Level C (QL-C)',
    text: 'Surface feature correlation or an interpretation of the approximate location and attributes of a subsurface utility asset using a combination of existing records and a site survey of visible surface features such as marker plates or utility lids with reference to existing records, site investigations. GPR can be used to improve and refine the relative spatial position of a QL-C alignment.',
  },
  {
    level: 'Quality Level D (QL-D)',
    text: 'Lowest of the four levels. This information can be gathered from existing Before-You-Dig plans, other available existing records, Site plans etc however, it has not been possible to accurately locate these subsurface utilities using electromagnetic or GPR techniques within the tolerances set out in AS 5488.1:2022.',
  },
];

// Abbreviations legend box reproduced on every photo page.
export const ABBREVIATIONS = [
  '0.6d = 0.6 meters deep',
  '0.6 Inv = 0.6 meters to invert of pipe',
  '0.6 TOP = 0.6 meters to top of pipe',
  'UTT = Unable to Trace',
  'UTO = Unable to Open',
  'EOT = End of Trace',
  'NDD = Non Destructive Digging',
];

export const PHOTO_DISCLAIMER =
  'All subsurface utilities shown in this photo report should be treated as indicative only and therefore it is strongly recommended that all utilities are potholed prior to any works commencing.';
