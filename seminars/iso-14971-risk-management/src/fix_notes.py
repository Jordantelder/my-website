"""Split multi-line speaker notes written by pptxgenjs into separate paragraphs (PowerPoint-safe)."""
import re, sys, zipfile, shutil, os
from xml.sax.saxutils import escape
src = sys.argv[1]
tmp = src + '.tmp'
pat = re.compile(r'(<p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>)<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>(.*?)</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p>(</p:txBody>)', re.S)
def unescape(s):
    return s.replace('&lt;','<').replace('&gt;','>').replace('&quot;','"').replace('&apos;',"'").replace('&amp;','&')
count = 0
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename.startswith('ppt/notesSlides/notesSlide') and item.filename.endswith('.xml'):
            xml = data.decode('utf-8')
            def repl(m):
                global count
                lines = unescape(m.group(2)).split('\n')
                paras = ''.join('<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>%s</a:t></a:r></a:p>' % escape(l) for l in lines)
                count += 1
                return m.group(1) + paras + m.group(3)
            xml = pat.sub(repl, xml)
            data = xml.encode('utf-8')
        zout.writestr(item, data)
shutil.move(tmp, src)
print('notes slides fixed:', count)
