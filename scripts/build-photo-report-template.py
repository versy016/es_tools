# Builds the Photo & Pothole report body (docxtemplater tags) into the unpacked
# letterhead's document.xml, preserving the section properties (header/footer refs).
import re

DOC = r'C:\Users\sverma\Desktop\es_tools\public\templates\_unpacked\word\document.xml'
YELLOW = 'FFC20E'; CHAR = '130C0E'; TINT = 'FBF6E9'; LINE = 'E6E3DD'

UTILS = [  # label, code, fill, textcolor
    ('Gas','G','F5A623','000000'), ('Telstra','T','FF7F00','000000'),
    ('Electricity (LV and HV)','E','FF0000','FFFFFF'), ('Communications / Fibre Optic','COMMS','D9D9D9','000000'),
    ('Water','W','0000FF','FFFFFF'), ('Sewer','SWR','00A651','FFFFFF'),
    ('Stormwater','STW','7030A0','FFFFFF'), ('Recycled Water','RW','7030A0','FFFFFF'),
    ('Unknown Service','UK','FF66CC','000000'), ('Earth Grid (Substation)','EG','FFFF00','000000'),
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
def ctext(text, bold=False, sz=20, color=CHAR, jc='left', italic=False, pbb=False):
    jcx = f'<w:jc w:val="{jc}"/>' if jc != 'left' else ''
    pb = '<w:pageBreakBefore/>' if pbb else ''
    return (f'<w:p><w:pPr>{pb}<w:spacing w:after="0" w:line="252" w:lineRule="auto"/>{jcx}{rpr(bold,sz,color,italic)}</w:pPr>'
            f'<w:r>{rpr(bold,sz,color,italic)}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')
def cell(text, w, fill=None, bold=False, color=CHAR, span=None, jc='left', raw=None):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    gs = f'<w:gridSpan w:val="{span}"/>' if span else ''
    mar = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>'
    inner = raw if raw is not None else ctext(text, bold, 20, color, jc)
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
            f'<w:spacing w:before="220" w:after="90"/>{rpr(True,24,CHAR)}</w:pPr>'
            f'<w:r>{rpr(True,24,CHAR)}<w:t xml:space="preserve">{esc(title)}</w:t></w:r></w:p>')

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
utils_line = (f'<w:p><w:pPr><w:spacing w:after="0"/>{rpr(False,21)}</w:pPr>'
              f'<w:r><w:t>{{#utilities}}</w:t></w:r><w:r>{rpr(True,21)}<w:t xml:space="preserve">{{label}}</w:t></w:r>'
              f'<w:r>{rpr(False,21)}<w:t xml:space="preserve">    </w:t></w:r><w:r><w:t>{{/utilities}}</w:t></w:r>'
              f'<w:r>{rpr(False,21,"888888")}<w:t>{{^utilities}}None recorded.{{/utilities}}</w:t></w:r></w:p>')
signoff = ('<w:p><w:pPr><w:spacing w:before="160"/></w:pPr><w:r><w:t>{#hasSignoff}</w:t></w:r></w:p>'
           + ctext('Located and reported by', bold=True, sz=18, color='666666')
           + f'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t xml:space="preserve">{{%signature}}</w:t></w:r></w:p>'
           + ctext('{signName}', bold=True, sz=22) + ctext('{signMeta}', sz=18, color='444444')
           + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{/hasSignoff}</w:t></w:r></w:p>')

cover = (title_band('PHOTO REPORT')
         + section('Project details') + proj
         + section('Client details') + client
         + section('Utilities located') + utils_line
         + section('Located to quality level (AS 5488.1:2022)') + ctext('{qlLevels}')
         + section('Comments') + ctext('{comments}')
         + signoff)

# ---- Legend page ----
LW = [1400, 8686]
legrows = [[cell(code, LW[0], fill, True, tc, jc='center'), cell(label, LW[1])] for (label, code, fill, tc) in UTILS]
legend = section('Utility legend — DIT specification', pbb=True) + table(legrows, LW)
legend += section('Quality levels explained (AS 5488.1:2022)')
for level, text in QLDEFS:
    legend += ctext(level, bold=True, sz=21) + ctext(text, sz=19, color='333333')

# ---- Photo pages (loop): page break + heading + image + pothole table per photo ----
PW = [1500, 8586]
photo_block = (
    '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{#photos}</w:t></w:r></w:p>'
    + f'<w:p><w:pPr><w:pageBreakBefore/><w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="{YELLOW}"/></w:pBdr><w:spacing w:before="40" w:after="120"/>{rpr(True,28,CHAR)}</w:pPr><w:r><w:t>Photo </w:t></w:r><w:r><w:t>{{num}}</w:t></w:r></w:p>'
    + f'<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">{{%photo}}</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{#hasPotholes}</w:t></w:r></w:p>'
    + ctext('Potholes', bold=True, sz=22)
    + table([
        [cell('', PW[0], CHAR, True, 'FFFFFF', jc='center', raw=ctext('Pothole', True, 18, 'FFFFFF', 'center')), cell('Details', PW[1], CHAR, True, 'FFFFFF')],
        [cell('', PW[0], None, False, CHAR, jc='center', raw='<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:t>{#potholes}</w:t></w:r><w:r><w:t xml:space="preserve">{%data}</w:t></w:r></w:p>'),
         cell('', PW[1], raw=(ctext('{label}  —  {code}  ·  QL {ql}', bold=True, sz=20) + ctext('Depth: {depth}', sz=19, color='444444')
              + f'<w:p><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/>{rpr(False,19,"444444")}</w:pPr><w:r>{rpr(False,19,"444444")}<w:t xml:space="preserve">{{comment}}</w:t></w:r><w:r><w:t>{{/potholes}}</w:t></w:r></w:p>'))],
    ], PW)
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
photo_block += ctext(DISCLAIMER, sz=17, color='666666', italic=True)
photo_block += '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>{/photos}</w:t></w:r></w:p>'

body = cover + legend + photo_block

xml = open(DOC, encoding='utf-8').read()
xml = re.sub(r'(<w:body>).*?(<w:sectPr)', lambda m: m.group(1) + body + m.group(2), xml, count=1, flags=re.S)
xml = xml.replace('w:top="851"', 'w:top="2240"')
open(DOC, 'w', encoding='utf-8').write(xml)
need = ['{#photos}','{%photo}','{#potholes}','{%data}','{#utilities}','{label}','{%signature}','{qlLevels}','{siteAddress}','{#hasSignoff}']
print('done; tags ok:', all(t in xml for t in need), 'len', len(xml))
