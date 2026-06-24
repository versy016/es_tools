# Builds the Prototype C report body (with docxtemplater tags) into the unpacked
# letterhead's document.xml, leaving the section properties (header/footer refs) intact.
import re

DOC = r'C:\Users\sverma\Desktop\es_tools\public\templates\_unpacked\word\document.xml'
YELLOW = 'FFC20E'; CHAR = '130C0E'; TINT = 'FBF6E9'; LINE = 'E6E3DD'

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def rpr(bold=False, sz=20, color=CHAR):
    return f'<w:rPr><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>{"<w:b/>" if bold else ""}<w:color w:val="{color}"/></w:rPr>'

def ctext(text, bold=False, sz=20, color=CHAR, jc='left'):
    jcx = f'<w:jc w:val="{jc}"/>' if jc != 'left' else ''
    return (f'<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>{jcx}{rpr(bold,sz,color)}</w:pPr>'
            f'<w:r>{rpr(bold,sz,color)}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>')

def cell(text, w, fill=None, bold=False, color=CHAR, span=None, jc='left'):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    gs = f'<w:gridSpan w:val="{span}"/>' if span else ''
    mar = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>'
    return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{gs}{shd}{mar}<w:vAlign w:val="center"/></w:tcPr>'
            f'{ctext(text, bold, 20, color, jc)}</w:tc>')

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

def section(title):
    return (f'<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="8" w:color="{YELLOW}"/></w:pBdr>'
            f'<w:spacing w:before="220" w:after="90"/>{rpr(True,24,CHAR)}</w:pPr>'
            f'<w:r>{rpr(True,24,CHAR)}<w:t xml:space="preserve">{title}</w:t></w:r></w:p>')

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
ASSETS = [('Gas','Gas'),('Sewer','Sewer'),('Stormwater','Stormwater'),('Telecommunications','Telecommunications'),
          ('SAPN / Electrical','SAPN'),('Traffic Signals','Traffic'),('Street Lighting','Street'),('Water','Water'),
          ('Fire Main','Fire'),('Optic Fibre','Optic'),('Reclaimed Water','Reclaimed'),('Unknown Services','Unknown')]
rows = [[cell('Asset type', W3[0], CHAR, True, 'FFFFFF'), cell('Quality', W3[1], CHAR, True, 'FFFFFF'), cell('Comment', W3[2], CHAR, True, 'FFFFFF')]]
for i,(name,pfx) in enumerate(ASSETS):
    fill = TINT if i % 2 == 1 else None
    rows.append([cell(name, W3[0], fill, True), cell('{%s_quality}' % pfx, W3[1], fill, False, CHAR, jc='center'), cell('{%s_comment}' % pfx, W3[2], fill)])
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

body = (title_band('SERVICE LOCATION FIELD REPORT')
        + section('Job details') + jd
        + section('Utility services located') + checklist
        + section('DBYD details') + dbyd
        + section('Site notes') + notes
        + section('Photos') + photos)

xml = open(DOC, encoding='utf-8').read()
# Replace the single placeholder paragraph (everything between <w:body> and <w:sectPr>) with our body.
xml = re.sub(r'(<w:body>).*?(<w:sectPr)', r'\1' + body.replace('\\', '\\\\') + r'\2', xml, count=1, flags=re.S)
# Push the body below the letterhead header graphic (the default 851 twip top margin
# is too small, so content overlapped the logo/contact block).
xml = xml.replace('w:top="851"', 'w:top="2240"')
open(DOC, 'w', encoding='utf-8').write(xml)
print('body injected; length', len(xml))
print('tags ok:', all(t in xml for t in ['{#photos}','{%data}','{name}','{^dbydByClient}','{date}','{Gas_quality}','{addnotes}']))
