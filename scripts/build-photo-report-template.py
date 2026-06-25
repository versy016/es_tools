# Builds the Photo & Pothole report body (docxtemplater tags) into the unpacked
# letterhead's document.xml, preserving the section properties (header/footer refs).
import re

DOC = r'C:\Users\sverma\Desktop\es_tools\public\templates\_unpacked\word\document.xml'
YELLOW = 'FFC20E'; CHAR = '130C0E'; TINT = 'FBF6E9'; LINE = 'E6E3DD'

UTILS = [  # label, code, fill, textcolor, key — ES utility colour-coding scheme
    ('Gas','G, GM, GS','F6E84F','000000','gas'), ('Telstra','T','FFFFFF','000000','telstra'),
    ('Electricity (LV and HV)','HV, LV, E','F4B183','000000','electricity'), ('Communications / Fibre Optic','COMMS, OF','FFFFFF','000000','comms'),
    ('Water','WS, WM, W','8EAADB','000000','water'), ('Sewer','SWR','FBE4D5','000000','sewer'),
    ('Stormwater','STW','92D050','000000','stormwater'), ('Recycled Water','RW','D777C5','000000','recycled'),
    ('Unknown Service','UK','FF3399','000000','unknown'), ('Earth Grid (Substation)','EG','FFFF00','000000','earth'),
]
QLDEFS = [
    ('Quality Level A (QL-A)','Is the highest Quality level accuracy and consists of positive identification of the attribute and location of a subsurface position in three dimensions. It is the only Quality level that defines a subsurface utility has been validated with additional attribute information (e.g. size, material, depth).'),
    ('Quality Level B (QL-B)','A Quality level that provides relative spatial position of the subsurface utility that has been located in three dimensions (horizontal +/- 300mm and vertical +/- 500mm) by tracing with EMI. Tracing has been achieved by applying an electromagnetic signal along or within the utility and traced to a known or visible end point.'),
    ('Quality Level C (QL-C)','Surface feature correlation or an interpretation of the approximate location and attributes of a subsurface utility asset using a combination of existing records and a site survey of visible surface features such as marker plates or utility lids. GPR can be used to improve and refine the relative spatial position of a QL-C alignment.'),
    ('Quality Level D (QL-D)','Lowest of the four levels. This information can be gathered from existing Before-You-Dig plans, other available existing records and site plans, however it has not been possible to accurately locate these subsurface utilities using electromagnetic or GPR techniques within the tolerances set out in AS 5488.1:2022.'),
]
ABBR = ['0.6d = 0.6 metres deep','0.6 Inv = 0.6 metres to invert of pipe','0.6 TOP = 0.6 metres to top of pipe',
        'UTT = Unable to Trace','UTO = Unable to Open','EOT = End of Trace','NDD = Non Destructive Digging']
DISCLAIMER = 'All subsurface utilities shown in this photo report should be treated as indicative only; it is strongly recommended that all utilities are potholed prior to any works commencing.'

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def rpr(bold=False, sz=20, color=CHAR, italic=False):
    return f'<w:rPr><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>{"<w:b/>" if bold else ""}{"<w:i/>" if italic else ""}<w:color w:val="{color}"/></w:rPr>'
def ctext(text, bold=False, sz=22, color=CHAR, jc='left', italic=False, pbb=False):
    jcx = f'<w:jc w:val="{jc}"/>' if jc != 'left' else ''
    pb = '<w:pageBreakBefore/>' if pbb else ''
    return (f'<w:p><w:pPr>{pb}<w:spacing w:after="0" w:line="252" w:lineRule="auto"/>{jcx}{rpr(bold,sz,color,italic)}</w:pPr>'
            f'<w:r>{rpr(bold,sz,color,italic)}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')
def cell(text, w, fill=None, bold=False, color=CHAR, span=None, jc='left', raw=None):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    gs = f'<w:gridSpan w:val="{span}"/>' if span else ''
    mar = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>'
    inner = raw if raw is not None else ctext(text, bold, 22, color, jc)
    return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{gs}{shd}{mar}<w:vAlign w:val="center"/></w:tcPr>{inner}</w:tc>')
def table(rows, widths, borders=True):
    bd = ('<w:tblBorders>' + ''.join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="{LINE}"/>' for s in ['top','left','bottom','right','insideH','insideV']) + '</w:tblBorders>') if borders else ''
    grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths) + '</w:tblGrid>'
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:jc w:val="left"/><w:tblInd w:w="0" w:type="dxa"/>{bd}</w:tblPr>{grid}'
            + ''.join('<w:tr>' + ''.join(r) + '</w:tr>' for r in rows) + '</w:tbl>')
def title_band(text):
    return (f'<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="48" w:space="8" w:color="{YELLOW}"/></w:pBdr>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="{CHAR}"/><w:spacing w:before="40" w:after="180"/>'
            f'<w:ind w:left="140" w:right="140"/>{rpr(True,30,"FFFFFF")}</w:pPr>'
            f'<w:r>{rpr(True,30,"FFFFFF")}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')
def section(title, pbb=False):
    pb = '<w:pageBreakBefore/>' if pbb else ''
    return (f'<w:p><w:pPr>{pb}<w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="{YELLOW}"/></w:pBdr>'
            f'<w:spacing w:before="220" w:after="90"/>{rpr(True,26,CHAR)}</w:pPr>'
            f'<w:r>{rpr(True,26,CHAR)}<w:t xml:space="preserve">{esc(title)}</w:t></w:r></w:p>')
def bullet(text, sz=21, color='333333'):
    # Hanging-indent bulleted paragraph.
    return (f'<w:p><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/>'
            f'<w:ind w:left="360" w:hanging="220"/>{rpr(False,sz,color)}</w:pPr>'
            f'<w:r>{rpr(False,sz,color)}<w:t xml:space="preserve">•  {esc(text)}</w:t></w:r></w:p>')

W4 = [2100, 2943, 2100, 2943]
# ---- Cover ----
proj = table([
    [cell('Locator', W4[0], TINT, True), cell('{locatorName}', W4[1]), cell('Date', W4[2], TINT, True), cell('{date}', W4[3])],
    [cell('DBYD No', W4[0], None, True), cell('{dbydNo}', W4[1]), cell('Ref No', W4[2], None, True), cell('{refNo}', W4[3])],
    [cell('Site Address', W4[0], TINT, True), cell('{siteAddress}', sum(W4[1:]), None, False, CHAR, span=3)],
    [cell('Scope of Works', W4[0], None, True), cell('{scopeOfWorks}', sum(W4[1:]), None, False, CHAR, span=3)],
], W4)
client = table([
    [cell('Client', W4[0], TINT, True), cell('{clientName}', W4[1]), cell('Contact', W4[2], TINT, True), cell('{clientContact}', W4[3])],
    [cell('Mobile', W4[0], None, True), cell('{clientMobile}', W4[1]), cell('DBYD Email', W4[2], None, True), cell('{dbydEmail}', W4[3])],
], W4)
# Utilities-located checklist table (Service-report style): one fixed row per
# utility, coloured by its scheme colour, with quality + comment tags. This table
# is the source of truth for "utilities located".
UTW = [3400, 1700, 4986]   # Service | Quality | Comment (= 10086)
util_rows = [[cell('Service', UTW[0], CHAR, True, 'FFFFFF'), cell('Quality', UTW[1], CHAR, True, 'FFFFFF'), cell('Comment', UTW[2], CHAR, True, 'FFFFFF')]]
for (label, code, fill, tc, key) in UTILS:
    util_rows.append([
        cell(label, UTW[0], (fill if fill != 'FFFFFF' else None), True, tc),
        cell('{%s_quality}' % key, UTW[1], None, False, CHAR, jc='center'),
        cell('{%s_comment}' % key, UTW[2], None),
    ])
util_table = table(util_rows, UTW)

cover = (title_band('POTHOLE REPORT')
         + section('Project details') + proj
         + section('Client details') + client
         + section('Utilities located') + util_table
         + section('Comments') + ctext('{comments}'))

# ---- End-of-report sign-off: "UTILITY LOCATOR : ... <tab> DATE : ..." on one
# line, then "SIGNATURE : <image>" below (signature is inline after the label). ----
def _sr(text, bold=False, sz=24):
    return f'<w:r>{rpr(bold,sz)}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'
signoff_block = (
    section('Sign-off')
    + ('<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="6400"/></w:tabs><w:spacing w:before="120" w:after="360"/></w:pPr>'
       + _sr('UTILITY LOCATOR : ', True) + _sr('{signLocator}')
       + '<w:r><w:tab/></w:r>' + _sr('DATE : ', True) + _sr('{signDate}') + '</w:p>')
    + ('<w:p><w:pPr><w:spacing w:before="160" w:after="0"/></w:pPr>'
       + _sr('SIGNATURE : ', True)
       + '<w:r><w:t>{#hasSign}</w:t></w:r><w:r><w:t xml:space="preserve">{%signImage}</w:t></w:r><w:r><w:t>{/hasSign}</w:t></w:r></w:p>')
)

# ---- Legend page ----
LW = [1900, 8186]   # wider code column for multi-code labels (G, GM, GS)
legrows = [[cell(code, LW[0], fill, True, tc, jc='center'), cell(label, LW[1])] for (label, code, fill, tc, key) in UTILS]
legend = section('Utility legend — DIT specification', pbb=True) + table(legrows, LW)
legend += section('Quality levels explained (AS 5488.1:2022)')
for level, text in QLDEFS:
    legend += ctext(level, bold=True, sz=23) + ctext(text, sz=21, color='333333')

# ---- Photo pages (loop): page break + heading + main image + pothole thumbnail grid ----
# Potholes render as a borderless 5-per-row grid of thumbnails, each with just its
# PH label below (no utility / quality / depth). potholeRows is pre-chunked in JS into
# rows of 5 fixed cells (c0..c4), blank cells padded with a transparent image.
GW = [2017, 2017, 2017, 2017, 2018]   # 5-col grid (= 10086)
def gcell(i):
    pre = '<w:r><w:t>{#potholeRows}</w:t></w:r>' if i == 0 else ''   # row loop opens in 1st cell
    post = '<w:r><w:t>{/potholeRows}</w:t></w:r>' if i == 4 else ''  # ...closes in last cell
    img_p = (f'<w:p><w:pPr><w:spacing w:before="40" w:after="20"/><w:jc w:val="center"/></w:pPr>'
             f'{pre}<w:r><w:t xml:space="preserve">{{%c{i}img}}</w:t></w:r></w:p>')
    lbl_p = (f'<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/>{rpr(True,20,CHAR)}</w:pPr>'
             f'<w:r>{rpr(True,20,CHAR)}<w:t xml:space="preserve">{{c{i}label}}</w:t></w:r>{post}</w:p>')
    return cell('', GW[i], raw=img_p + lbl_p)
pothole_grid = (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(GW)}" w:type="dxa"/><w:jc w:val="left"/><w:tblInd w:w="0" w:type="dxa"/></w:tblPr>'
                + '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in GW) + '</w:tblGrid>'
                + '<w:tr>' + ''.join(gcell(i) for i in range(5)) + '</w:tr></w:tbl>')
photo_block = (
    '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{#photos}</w:t></w:r></w:p>'
    + f'<w:p><w:pPr><w:pageBreakBefore/><w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="{YELLOW}"/></w:pBdr><w:spacing w:before="40" w:after="120"/>{rpr(True,28,CHAR)}</w:pPr><w:r><w:t>Photo </w:t></w:r><w:r><w:t>{{num}}</w:t></w:r></w:p>'
    + f'<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">{{%photo}}</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{#hasPotholes}</w:t></w:r></w:p>'
    + ctext('Potholes', bold=True, sz=22)
    + pothole_grid
    + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{/hasPotholes}</w:t></w:r></w:p>'
)
# abbreviations + disclaimer per photo
abbr_cells = [cell(a, 5043, TINT if i % 2 else None) for i, a in enumerate(ABBR)]
abbr_rows = []
for i in range(0, len(abbr_cells), 2):
    pair = abbr_cells[i:i+2]
    if len(pair) == 1:
        pair.append(cell('', 5043))
    abbr_rows.append(pair)
photo_block += section('Abbreviations') + table(abbr_rows, [5043, 5043])
photo_block += ctext(DISCLAIMER, sz=19, color='666666', italic=True)
photo_block += '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{/photos}</w:t></w:r></w:p>'

# ---- Service location quality (Category A–D) + Terms and conditions (end-matter, own pages) ----
QUALITY = [
    ('(Category A) Direct Services Location', [
        'Direct Service location is the highest accuracy order of service location. It refers to services which are openly visible and can be surveyed by direct measurement to the object.',
        'Examples include: exposed pipes, open cable trenches and exposed drainage where invert/obvert measurement is possible.',
    ]),
    ('(Category B) Active Services Location', [
        'Active Services are to be located using Location methods whereby services are traced using an electromagnetic signal emitted from the transmitter and received by the service detection device.',
        'Examples of Active Location methods include using a Direct Connection or Induction Clamp. Readings are required to be marked on the ground surface.',
        'Active Location methods are suitable for metal conduits, cables that are welded, soldered, or braided together or where a tracing wire/cathodic protection is present. This method is mandatory for rail services.',
    ]),
    ('(Category C) Passive Services Location', [
        'Passive Services Location uses passive methods which do not involve the use of an electromagnetic signal, transponders, or sondes. In this class the service detection device is used as a standalone.',
        'Examples of Passive Service Location capture include radiolocation or GPR. These methods are commonly used for materials such as cast iron or steel pipes where active induction is not possible. Readings are required to be marked on the ground surface.',
    ]),
    ('(Category D) Unverified Services Location', [
        'Unverified Services are services that have been located without confirmation by any of the above-mentioned methods. Unverified Services can include service locations approximated from DBYD plans or by joining top stones. The resulting services will be determined as unverified services.',
        'Unverified location methods are commonly used for materials such as plastic poly tubing, clay, concrete, or uninsulated/rubber jointed cast iron pipes where other methods are not possible.',
    ]),
]
TERMS_INTRO = ('Engineering Surveys accepts no responsibility for damage occurring to Underground services, other than '
               'as a direct result of its negligence. All Engineering Surveys employees undertake regular Training and '
               'compliance with industry standards.')
TERMS_LEAD = 'Engineering Surveys will not accept responsibility for damage under the following:'
TERMS = [
    'Damage to any services outside the area designated by the client, as is the entire area in which work will be carried out, and/or',
    'Damage to any service which has not been indicated, or incorrectly indicated on plans obtained through dial before you dig, or from any other source, and/or',
    'Where the spray marker is no longer visible/legible, and/or',
    'Failure by the client to physically expose (by non-destructive potholing methods) any marked services to confirm alignment and depth. Refer to affected asset owners ‘Duty of care’ for safe approach distance requirements, and/or',
    'Non-conductive services are not detectable with equipment currently available. No responsibility is taken for any damage incurred to any non-conductive services (i.e. poly, pvc, concrete, and earthenware etc.), and/or',
    'Where no visible signs or reasonable access to a conductive service is known, and/or',
    'If conductive continuity is not maintained through the service being located.',
    'Engineering Surveys accepts no responsibility for damage to services that have not been verified by ‘potholing’. In the event of damage to services:',
    'All damage must be reported to Engineering Surveys prior to any repairs occurring, and/or further earthworks being conducted.',
    'An Engineering Surveys representative is to carry out site inspection within a reasonable time period that will not delay necessary repair work.',
]
quality = section('Service location quality', pbb=True)
for _head, _paras in QUALITY:
    quality += ctext(_head, bold=True, sz=21)
    for _p in _paras:
        quality += bullet(_p)
terms = section('Terms and conditions') + ctext(TERMS_INTRO) + ctext(TERMS_LEAD, bold=True)
for _t in TERMS:
    terms += bullet(_t)

body = cover + legend + photo_block + quality + terms + signoff_block

xml = open(DOC, encoding='utf-8').read()
xml = re.sub(r'(<w:body>).*?(<w:sectPr)', lambda m: m.group(1) + body + m.group(2), xml, count=1, flags=re.S)
xml = xml.replace('w:top="851"', 'w:top="2240"')
open(DOC, 'w', encoding='utf-8').write(xml)
need = ['{#photos}','{%photo}','{#potholeRows}','{%c0img}','{c0label}','{%c4img}','{/potholeRows}','{gas_quality}','{gas_comment}','{unknown_comment}','{signLocator}','{#hasSign}','{%signImage}','{signDate}','{siteAddress}']
print('done; tags ok:', all(t in xml for t in need), 'len', len(xml))
