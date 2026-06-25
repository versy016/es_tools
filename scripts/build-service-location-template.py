# Builds the Prototype C report body (with docxtemplater tags) into the unpacked
# letterhead's document.xml, leaving the section properties (header/footer refs) intact.
import re

DOC = r'C:\Users\sverma\Desktop\es_tools\public\templates\_unpacked\word\document.xml'
YELLOW = 'FFC20E'; CHAR = '130C0E'; TINT = 'FBF6E9'; LINE = 'E6E3DD'

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def rpr(bold=False, sz=20, color=CHAR):
    return f'<w:rPr><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>{"<w:b/>" if bold else ""}<w:color w:val="{color}"/></w:rPr>'

def ctext(text, bold=False, sz=22, color=CHAR, jc='left'):
    jcx = f'<w:jc w:val="{jc}"/>' if jc != 'left' else ''
    return (f'<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>{jcx}{rpr(bold,sz,color)}</w:pPr>'
            f'<w:r>{rpr(bold,sz,color)}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>')

def cell(text, w, fill=None, bold=False, color=CHAR, span=None, jc='left', raw=None):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    gs = f'<w:gridSpan w:val="{span}"/>' if span else ''
    mar = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>'
    inner = raw if raw is not None else ctext(text, bold, 22, color, jc)
    return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{gs}{shd}{mar}<w:vAlign w:val="center"/></w:tcPr>{inner}</w:tc>')

def table(rows, widths):
    bd = '<w:tblBorders>' + ''.join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="{LINE}"/>' for s in ['top','left','bottom','right','insideH','insideV']) + '</w:tblBorders>'
    grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths) + '</w:tblGrid>'
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:jc w:val="left"/>'
            f'<w:tblInd w:w="0" w:type="dxa"/>{bd}</w:tblPr>{grid}' + ''.join('<w:tr>' + ''.join(r) + '</w:tr>' for r in rows) + '</w:tbl>')

def spacer(h=80): return f'<w:p><w:pPr><w:spacing w:after="{h}" w:line="60" w:lineRule="auto"/></w:pPr></w:p>'

def title_band(text):
    return (f'<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="48" w:space="8" w:color="{YELLOW}"/></w:pBdr>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="{CHAR}"/><w:spacing w:before="40" w:after="180"/>'
            f'<w:ind w:left="140" w:right="140"/>{rpr(True,30,"FFFFFF")}</w:pPr>'
            f'<w:r>{rpr(True,30,"FFFFFF")}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>')

def section(title, pbb=False):
    pb = '<w:pageBreakBefore/>' if pbb else ''
    return (f'<w:p><w:pPr>{pb}<w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="{YELLOW}"/></w:pBdr>'
            f'<w:spacing w:before="220" w:after="90"/>{rpr(True,26,CHAR)}</w:pPr>'
            f'<w:r>{rpr(True,26,CHAR)}<w:t xml:space="preserve">{title}</w:t></w:r></w:p>')

def bullet(text, sz=21, color='333333'):
    # Hanging-indent bulleted paragraph.
    return (f'<w:p><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/>'
            f'<w:ind w:left="360" w:hanging="220"/>{rpr(False,sz,color)}</w:pPr>'
            f'<w:r>{rpr(False,sz,color)}<w:t xml:space="preserve">•  {esc(text)}</w:t></w:r></w:p>')

# ---- Job details (4-col) ----
W4 = [2100, 2943, 2100, 2943]   # = 10086
jd = table([
    [cell('Date', W4[0], TINT, True), cell('{date}', W4[1]), cell('Contact', W4[2], TINT, True), cell('{contact}', W4[3])],
    [cell('Client / Project', W4[0], None, True), cell('{clientOrProject}', W4[1]), cell('Contact Mob.', W4[2], None, True), cell('{contactMob}', W4[3])],
    [cell('Locater', W4[0], TINT, True), cell('{surveyor}', W4[1]), cell('Locater Mob.', W4[2], TINT, True), cell('{locaterMob}', W4[3])],
    [cell('Job Location', W4[0], None, True), cell('{jobLocation}', W4[1] + W4[2] + W4[3], None, False, CHAR, span=3)],
], W4)

# ---- Checklist (3-col) ----
W3 = [3400, 1700, 4986]   # = 10086
# name, tag-prefix, asset-cell fill, asset-cell text colour (utility colours matched
# exactly to the original ES template).
ASSETS = [('Gas','Gas','F6E84F','130C0E'), ('Sewer','Sewer','FBE4D5','130C0E'),
          ('Stormwater','Stormwater','92D050','130C0E'), ('Telecommunications','Telecommunications','FFFFFF','130C0E'),
          ('SAPN / Electrical','SAPN','F4B083','130C0E'), ('Traffic Signals','Traffic','F4B083','130C0E'),
          ('Street Lighting','Street','F4B083','130C0E'), ('Water','Water','8EAADB','130C0E'),
          ('Fire Main','Fire','C45911','FFFFFF'), ('Optic Fibre','Optic','FFFFFF','130C0E'),
          ('Reclaimed Water','Reclaimed','D777C5','130C0E'), ('Unknown Services','Unknown','FF3399','130C0E')]
rows = [[cell('Asset type', W3[0], CHAR, True, 'FFFFFF'), cell('Quality', W3[1], CHAR, True, 'FFFFFF'), cell('Comment', W3[2], CHAR, True, 'FFFFFF')]]
for (name, pfx, fill, tc) in ASSETS:
    rows.append([cell(name, W3[0], (fill if fill != 'FFFFFF' else None), True, tc),
                 cell('{%s_quality}' % pfx, W3[1], None, False, CHAR, jc='center'),
                 cell('{%s_comment}' % pfx, W3[2], None)])
checklist = table(rows, W3)

# ---- DBYD (4-col), wrapped in inverse section; note shows when supplied by client ----
dbyd_tbl = table([
    [cell('DBYD Job Number', W4[0], TINT, True), cell('{dbydjobno}', W4[1]), cell('Date Requested', W4[2], TINT, True), cell('{dbyddate}', W4[3])],
    [cell('Plans Available', W4[0], None, True), cell('{dbydavailable}', W4[1]), cell('Plans Cover Areas', W4[2], None, True), cell('{dbydplans}', W4[3])],
    [cell('SWMS Completed', W4[0], TINT, True), cell('{SWMS}', W4[1]), cell('Plans Supplied by ES', W4[2], TINT, True), cell('{plansupply}', W4[3])],
], W4)
dbyd = ctext('{^dbydByClient}') + dbyd_tbl + ctext('{/dbydByClient}') + ctext('{#dbydByClient}DBYD to be supplied by client.{/dbydByClient}', bold=True)

# ---- Site notes ----
notes = ctext('{addnotes}')

# ---- Photos: one per row, image + bold name + description, centred ----
photos = ('<w:p><w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr>'
          '<w:r><w:t>{#photos}</w:t></w:r><w:r><w:t xml:space="preserve">{%data}</w:t></w:r>'
          '<w:r><w:br/></w:r><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{name}</w:t></w:r>'
          '<w:r><w:br/></w:r><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">{description}</w:t></w:r>'
          '<w:r><w:br/></w:r><w:r><w:br/></w:r><w:r><w:t>{/photos}</w:t></w:r></w:p>')

# ---- Service location quality (Category A–D) ----
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
# ---- Terms and conditions ----
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
    quality += ctext(esc(_head), bold=True, sz=21)
    for _p in _paras:
        quality += bullet(_p)
terms = section('Terms and conditions') + ctext(esc(TERMS_INTRO)) + spacer(40) + ctext(esc(TERMS_LEAD), bold=True)
for _t in TERMS:
    terms += bullet(_t)

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

body = (title_band('SERVICE LOCATION FIELD REPORT')
        + section('Job details') + jd
        + section('Utility services located') + checklist
        + section('DBYD details') + dbyd
        + section('Site notes') + notes
        + section('Photos') + photos
        + quality + terms + signoff_block)

xml = open(DOC, encoding='utf-8').read()
# Replace the single placeholder paragraph (everything between <w:body> and <w:sectPr>) with our body.
xml = re.sub(r'(<w:body>).*?(<w:sectPr)', r'\1' + body.replace('\\', '\\\\') + r'\2', xml, count=1, flags=re.S)
# Push the body below the letterhead header graphic (the default 851 twip top margin
# is too small, so content overlapped the logo/contact block).
xml = xml.replace('w:top="851"', 'w:top="2240"')
open(DOC, 'w', encoding='utf-8').write(xml)
print('body injected; length', len(xml))
print('tags ok:', all(t in xml for t in ['{#photos}','{%data}','{name}','{^dbydByClient}','{date}','{Gas_quality}','{addnotes}','{signLocator}','{#hasSign}','{%signImage}','{signDate}']))
