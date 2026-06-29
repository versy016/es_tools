// Single source of truth for the DIT-specification utility legend.
// Shared by the annotation editor (PhotoAnnotator) and the PDF (PhotoReportPdf)
// so on-screen line/text-box colours always match the generated report and legend.

// `key`   - stable identifier used in annotation/pothole records
// `label` - full utility name shown in the legend
// `code`  - short code drawn on text-boxes / used in markings
// `color` - stroke / fill colour (DIT spec)
// `text`  - readable text colour to place on top of `color` for text-boxes
// Standard DBYD / AS 5488 utility locating colour code. Single source of truth for
// the legend, the annotation editor, the pothole panel and the report tables.
// Communications is white (use black when drawn on a white background).
export const UTILITIES = [
  { key: 'cadastral',    label: 'Cadastral Boundaries', code: 'CAD',       color: '#A6A6A6', text: '#000000' },
  { key: 'water',        label: 'Potable Water Supply', code: 'WS, WM, W', color: '#2E75B6', text: '#FFFFFF' },
  { key: 'stormwater',   label: 'Storm Water',          code: 'STW',       color: '#00B050', text: '#FFFFFF' },
  { key: 'sewer',        label: 'Sewerage',             code: 'SWR',       color: '#F2E2C4', text: '#000000' },
  { key: 'reclaimed',    label: 'Reclaimed Water',      code: 'RW',        color: '#7030A0', text: '#FFFFFF' },
  { key: 'comms',        label: 'Communications',       code: 'COMMS',     color: '#FFFFFF', text: '#000000' },
  { key: 'fire',         label: 'Fire Service',         code: 'FS',        color: '#FF0000', text: '#FFFFFF' },
  { key: 'electrical',   label: 'Electrical',           code: 'HV, LV, E', color: '#ED7D31', text: '#000000' },
  { key: 'gas',          label: 'Gas',                  code: 'G, GM, GS', color: '#FFD500', text: '#000000' },
  { key: 'petroleum',    label: 'Petroleum',            code: 'P',         color: '#974706', text: '#FFFFFF' },
  { key: 'reticulation', label: 'Reticulation',         code: 'RET',       color: '#375623', text: '#FFFFFF' },
  { key: 'unknown',      label: 'Unknown Services',     code: 'UK',        color: '#FF66CC', text: '#000000' },
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
