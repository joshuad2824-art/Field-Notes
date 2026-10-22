"""Synthetic extraction fixtures; no private source text in tests or output."""
import importlib.util, io, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).parents[1]/'scripts/prepare-theology-reference.py');prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
romans=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII']
source='wrapper metadata\n## Page 1\nSynthetic cover.\n## Page 2\nTable of Contents\n'+' '.join(f'{r}. Sample title {i} ........ {i}' for i,r in enumerate(romans,1))+'\n'
source+=''.join(f'## Page {i+2}\n{r}. Sample title {i} Invented café text for paragraph {i}.\n---\n' for i,r in enumerate(romans,1))+'## Page 25\n'
blocks,_,coverage=prepare.bfm_blocks(source.encode());assert coverage['articleHeadings']==18;assert coverage['pages']==25;assert coverage['wordingExact'];assert len(set(b['id'] for b in blocks))==len(blocks)
W=prepare.W
raw=io.BytesIO()
with zipfile.ZipFile(raw,'w') as z:
 z.writestr('word/document.xml',f'''<w:document xmlns:w="{W}" xmlns:r="{prepare.R}" xmlns:mc="{prepare.MC}"><w:body>
 <w:p><w:pPr><w:pStyle w:val="PageHeading"/></w:pPr><w:r><w:t>Sample manual</w:t></w:r></w:p>
 <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First sample.</w:t><w:tab/><w:t>Exact café.</w:t></w:r></w:p>
 <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Second sample.</w:t></w:r></w:p>
 <w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p><w:r><w:t>Field</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Read-only sample form: __________</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
 <w:p><mc:AlternateContent><mc:Choice Requires="w"><w:r><w:t>One representation.</w:t></w:r></mc:Choice><mc:Fallback><w:r><w:t>Duplicate fallback.</w:t></w:r></mc:Fallback></mc:AlternateContent></w:p>
 <w:sectPr><w:headerReference w:type="default" r:id="h1"/></w:sectPr></w:body></w:document>''')
 z.writestr('word/numbering.xml',f'<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
 z.writestr('word/_rels/document.xml.rels','<Relationships><Relationship Id="h1" Target="header1.xml"/></Relationships>')
 z.writestr('word/header1.xml',f'<w:hdr xmlns:w="{W}"><w:p><w:r><w:t>Original form header</w:t></w:r></w:p></w:hdr>')
blocks,assets,coverage=prepare.docx_blocks(raw.getvalue());assert coverage['paragraphsExact'];assert coverage['automaticListItems']==2
assert [b['marker'] for b in blocks if b.get('marker')]==['3.','4.']
assert any(b['text']=='Original form header' for b in blocks)
assert any(b['text']=='One representation.' for b in blocks);assert not any('Duplicate fallback' in b['text'] for b in blocks)
table=next(b for b in blocks if b['kind']=='table');assert table['rows'][0]['header'];assert table['rows'][1]['cells'][0]['span']==2
print('PASS synthetic reference extraction: 18 article headings, exact wording, page scaffolding, DOCX numbering, headers, merged cells and alternate representations')
