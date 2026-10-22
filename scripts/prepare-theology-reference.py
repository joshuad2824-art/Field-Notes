#!/usr/bin/env python3
"""Prepare a private, source-addressed reference package. Never writes into the app tree."""
import argparse, base64, hashlib, io, json, re, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
MC='http://schemas.openxmlformats.org/markup-compatibility/2006'
NS={'w':W,'r':R}
def tag(name): return '{'+W+'}'+name
def value(node,name='val',default=None): return node.get(tag(name),default) if node is not None else default
def digest(data): return hashlib.sha256(data).hexdigest()
def compact(data): return json.dumps(data,ensure_ascii=False,separators=(',',':'))
def logical(node):
    # Choice and Fallback are alternate representations of the same Word object.
    for child in list(node):
        if child.tag=='{'+MC+'}AlternateContent':
            branch=child.find('{'+MC+'}Choice')
            if branch is None: branch=child.find('{'+MC+'}Fallback')
            at=list(node).index(child);node.remove(child)
            if branch is not None:
                logical(branch)
                for part in list(branch): node.insert(at,part);at+=1
        else: logical(child)
    return node

def bfm_blocks(raw):
    text=raw.decode('utf-8');lines=text.splitlines(keepends=True);blocks=[];page=0;byte=0;retained=[];omitted=[]
    # Titles are taken from the source's own contents, not a replacement creed.
    titles=[];contents_line=None
    for line in lines:
        if len(re.findall(r'(?<!\w)[IVX]+\.\s',line))>=18:
            contents_line=line.rstrip("\r\n")
            titles=[roman+'. '+re.sub(r'\s*\.{2,}.*$','',re.sub(r'\s+\d+\s*$','',title)).strip() for roman,title in re.findall(r'(?<!\w)([IVX]+)\.\s+(.+?)(?=\s+[IVX]+\.\s+|$)',line.strip())]
            break
    article_pattern=re.compile('|'.join(re.escape(t) for t in sorted(titles,key=len,reverse=True))) if titles else None
    for number,line in enumerate(lines,1):
        start=byte;byte+=len(line.encode('utf-8'));body=line.rstrip('\r\n')
        marker=re.fullmatch(r'## Page (\d+)\s*',body)
        if marker:page=int(marker[1]);omitted.append({'line':number,'reason':'PDF page marker'});continue
        if not page:omitted.append({'line':number,'reason':'local extraction wrapper retained in original bytes'});continue
        if not body.strip() or body.strip()=='---':
            omitted.append({'line':number,'reason':'page separator or whitespace'});continue
        retained.append(body)
        # The source's compressed contents stays verbatim. Body article titles
        # become headings at exact substring boundaries, including mid-line titles.
        matches=list(article_pattern.finditer(body)) if article_pattern and body!=contents_line else []
        at=0;piece=0
        for match in matches:
            if match.start()>at:
                part=body[at:match.start()]
                blocks.append({'id':f'page-{page}-line-{number}-{piece}','kind':'paragraph','text':part,'origin':{'part':'source.md','line':number,'page':page,'byte':start+len(body[:at].encode())}});piece+=1
            blocks.append({'id':f'article-{match.group().split(".",1)[0].lower()}','kind':'heading','level':2,'text':match.group(),'origin':{'part':'source.md','line':number,'page':page,'byte':start+len(body[:match.start()].encode())}})
            at=match.end()
        if at<len(body):blocks.append({'id':f'page-{page}-line-{number}-{piece}','kind':'paragraph','text':body[at:],'origin':{'part':'source.md','line':number,'page':page,'byte':start+len(body[:at].encode())}})
    for block in blocks:
        if block['text']==contents_line:block['role']='source-contents'
    assert ''.join(b['text'] for b in blocks)==''.join(retained),'BFM wording changed'
    return blocks,{}, {'pages':page,'retainedLines':len(retained),'articleHeadings':len([b for b in blocks if b['kind']=='heading']),'wordingExact':True,'omittedScaffolding':omitted}

def docx_blocks(raw):
    z=zipfile.ZipFile(io.BytesIO(raw));parts={};assets={};paragraphs={};seen_origins=set();counters={};numbering={};styles={};all_expected={}
    def xml(name):
        if name not in parts: parts[name]=logical(ET.fromstring(z.read(name)))
        return parts[name]
    if 'word/styles.xml' in z.namelist():
        for s in xml('word/styles.xml').findall('w:style',NS):styles[value(s,'styleId')]=s
    if 'word/numbering.xml' in z.namelist():
        nr=xml('word/numbering.xml');abstract={value(a,'abstractNumId'):a for a in nr.findall('w:abstractNum',NS)}
        for n in nr.findall('w:num',NS):
            aid=value(n.find('w:abstractNumId',NS));levels={value(l,'ilvl'):l for l in abstract[aid].findall('w:lvl',NS)}
            starts={}
            for override in n.findall('w:lvlOverride',NS):
                level=value(override,'ilvl');start=value(override.find('w:startOverride',NS))
                if start is not None:starts[level]=int(start)
                full=override.find('w:lvl',NS)
                if full is not None:levels[level]=full
            numbering[value(n,'numId')]=(levels,starts)
    def relationships(part):
        path=Path(part);rel=str(path.parent/'_rels'/(path.name+'.rels'))
        return {r.get('Id'):r.get('Target') for r in ET.fromstring(z.read(rel))} if rel in z.namelist() else {}
    def ptext(p):
        out=[]
        def walk(e):
            if e is not p and e.tag in (tag('p'),tag('drawing'),tag('pict')):return
            if e.tag==tag('t'):out.append(e.text or '')
            elif e.tag==tag('tab'):out.append('\t')
            elif e.tag in (tag('br'),tag('cr')):out.append('\n')
            elif e.tag==tag('noBreakHyphen'):out.append('\u2011')
            elif e.tag==tag('softHyphen'):out.append('\u00ad')
            else:
                for child in e:walk(child)
        walk(p);return ''.join(out)
    def register(part):
        if part in paragraphs:return
        paragraphs[part]={id(p):i for i,p in enumerate(xml(part).iter(tag('p')),1)}
        for p in xml(part).iter(tag('p')):
            text=ptext(p)
            if text:all_expected[f'{part}:p{paragraphs[part][id(p)]}']=text
    def numprop(p):
        prop=p.find('w:pPr/w:numPr',NS)
        sid=value(p.find('w:pPr/w:pStyle',NS));visited=set()
        while prop is None and sid in styles and sid not in visited:
            visited.add(sid);style=styles[sid];prop=style.find('w:pPr/w:numPr',NS);sid=value(style.find('w:basedOn',NS))
        return prop
    def numeral(n,fmt):
        if fmt in ('lowerLetter','upperLetter'):
            result='';v=n
            while v>0:v,r=divmod(v-1,26);result=chr(97+r)+result
            return result.upper() if fmt=='upperLetter' else result
        if fmt in ('lowerRoman','upperRoman'):
            result='';v=n
            for number,s in [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
                while v>=number:result+=s;v-=number
            return result.lower() if fmt=='lowerRoman' else result
        return str(n)
    def marker(p,part):
        prop=numprop(p)
        if prop is None:return None
        nid=value(prop.find('w:numId',NS));level=value(prop.find('w:ilvl',NS),'val','0')
        if nid not in numbering:return None
        levels,starts=numbering[nid];spec=levels.get(level)
        if spec is None:return None
        key=(part,nid);counts=counters.setdefault(key,{})
        counts[level]=counts.get(level,starts.get(level,int(value(spec.find('w:start',NS),'val','1')))-1)+1
        for child in list(counts):
            if int(child)>int(level):del counts[child]
        fmt=value(spec.find('w:numFmt',NS),'val','decimal');template=value(spec.find('w:lvlText',NS),'val','%'+str(int(level)+1)+'.')
        if fmt=='bullet':return template.translate(str.maketrans({'\uf0b7':'•','\uf0a7':'▪','\uf06f':'○'}))
        for index in range(9):
            lev=str(index);other=levels.get(lev);otherfmt=value(other.find('w:numFmt',NS),'val','decimal') if other is not None else 'decimal'
            template=template.replace('%'+str(index+1),numeral(counts.get(lev,starts.get(lev,1)),otherfmt))
        return template
    def para(p,part,role=None,in_table=False):
        register(part);i=paragraphs[part][id(p)];origin={'part':part,'paragraph':i};text=ptext(p);key=f'{part}:p{i}';result=[]
        if text:
            seen_origins.add(key);style=value(p.find('w:pPr/w:pStyle',NS),'val','')
            level=2 if style in ('Title','PageHeading') else 3 if style=='ParagraphHeading' else None
            if not level and not (in_table and part=='word/document.xml') and len(text.strip())<140 and (re.match(r'^(?:ARTICLE\s+[IVX\d]+|[A-Z]\d{3}\b)',text.strip(),re.I) or text.strip().isupper() and len(text.strip())>3):level=3
            mark=marker(p,part)
            result.append({'id':re.sub(r'[^a-zA-Z0-9-]','-',part)+f'-p{i}','kind':'heading' if level else 'paragraph','text':text,'origin':origin,**({'level':level} if level else {}),**({'marker':mark} if mark else {}),**({'role':role} if role else {})})
        # Drawings can carry text boxes and images; their text is never counted
        # again in the containing paragraph. All assets stay in the private package.
        for box in p.findall('.//w:txbxContent',NS):result+=children(box,part)
        rels=relationships(part)
        for e in p.iter():
            rid=e.get('{'+R+'}embed') or e.get('{'+R+'}id') if e.tag.rsplit('}',1)[-1] in ('blip','imagedata') else None
            if rid and rid in rels:
                target=str(Path(part).parent/rels[rid]);data=z.read(target);aid=digest(data)
                if not target.lower().endswith('.png'):raise ValueError('Unsupported source image; keep original and review before importing')
                assets[aid]={'mime':'image/png','base64':base64.b64encode(data).decode(),'origin':target}
                result.append({'id':f'{key}-image-{len(result)}','kind':'image','asset':aid,'text':'','origin':origin})
        return result
    def children(parent,part,in_table=False):
        result=[]
        for child in parent:
            if child.tag==tag('p'):result+=para(child,part,in_table=in_table)
            elif child.tag==tag('tbl'):
                rows=[]
                for row in child.findall('w:tr',NS):
                    cells=[]
                    for cell in row.findall('w:tc',NS):cells.append({'span':int(value(cell.find('w:tcPr/w:gridSpan',NS),'val','1')),'blocks':children(cell,part,True)})
                    rows.append({'header':row.find('w:trPr/w:tblHeader',NS) is not None,'cells':cells})
                result.append({'id':f'{part}-table-{len(seen_origins)}','kind':'table','text':'','rows':rows,'origin':{'part':part}})
            elif child.tag!=tag('sectPr'):result+=children(child,part,in_table)
        return result
    body=xml('word/document.xml').find('w:body',NS);rels=relationships('word/document.xml');blocks=[];group=[];inherited={};used=set();section_count=0
    def section(items,properties):
        nonlocal section_count
        section_count+=1
        if properties is not None:
            for kind in ('header','footer'):
                for ref in properties.findall('w:'+kind+'Reference',NS):
                    rid=ref.get('{'+R+'}id');target=rels.get(rid)
                    if target:inherited[(kind,value(ref,'type','default'))]=str(Path('word')/target)
        out=[]
        for kind in ('header','body','footer'):
            if kind=='body':
                container=ET.Element('body');container.extend(items);out+=children(container,'word/document.xml');continue
            for (ref_kind,_),part in inherited.items():
                if ref_kind==kind:
                    used.add(part);register(part)
                    # Source parts retain stable anchors; repeated running headers
                    # are kept once, rather than duplicating ids/contents on screen.
                    if not any(b.get('origin',{}).get('part')==part for b in blocks+out):
                        for p in xml(part).findall('w:p',NS):out+=para(p,part,'source-'+kind)
                        for table in xml(part).findall('w:tbl',NS):container=ET.Element('header');container.append(table);out+=children(container,part)
        return out
    for child in body:
        props=child if child.tag==tag('sectPr') else child.find('w:pPr/w:sectPr',NS)
        if child.tag!=tag('sectPr'):group.append(child)
        if props is not None:blocks+=section(group,props);group=[]
    if group:blocks+=section(group,None)
    # Preserve any text-bearing source parts that Word retains but does not
    # currently reference, and notes outside the main body.
    for part in z.namelist():
        if re.match(r'word/(?:header\d+|footer\d+|footnotes|endnotes)\.xml$',part):
            register(part)
            if part not in used:
                blocks+=children(xml(part),part)
    def flatten(items):
        for b in items:
            if b['kind']=='table':
                for row in b['rows']:
                    for cell in row['cells']:yield from flatten(cell['blocks'])
            else:yield b
    actual={f"{b['origin']['part']}:p{b['origin']['paragraph']}":b['text'] for b in flatten(blocks) if b['kind']!='image'}
    assert actual==all_expected,'Source paragraph loss or alteration'
    ids=[b['id'] for b in flatten(blocks)];assert len(ids)==len(set(ids)),'Duplicate paragraph anchors'
    return blocks,assets,{'paragraphs':len(actual),'tables':sum(1 for b in blocks if b['kind']=='table'),'sections':section_count,'sourceParts':len(paragraphs),'assets':len(assets),'paragraphsExact':True,'automaticListItems':sum(bool(b.get('marker')) for b in flatten(blocks))}

def prepare(kind,path):
    raw=path.read_bytes();blocks,assets,coverage=bfm_blocks(raw) if kind=='bfm' else docx_blocks(raw)
    return {'format':'field-notes-private-reference','version':1,'key':kind,'source':{'filename':path.name,'sha256':digest(raw),'bytes':len(raw),'base64':base64.b64encode(raw).decode()},'blocks':blocks,'assets':assets,'contentSha256':digest(compact(blocks).encode()),'coverage':coverage}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--kind',choices=['bfm','mbc'],required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    root=Path(__file__).resolve().parents[1]
    if root in a.output.resolve().parents:raise SystemExit('Private output must be outside the application repository.')
    package=prepare(a.kind,a.source);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(compact(package),encoding='utf-8');a.output.chmod(0o600);print(json.dumps({'prepared':a.kind,'sourceSha256':package['source']['sha256'],'bytes':package['source']['bytes'],'blocks':len(package['blocks']),'coverage':{k:v for k,v in package['coverage'].items() if k!='omittedScaffolding'}}))
if __name__=='__main__':main()
