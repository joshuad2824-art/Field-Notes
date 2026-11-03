// Variables used by Scriptable.
// icon-color: deep-green; icon-glyph: book;
// Generated from widgets/scriptable/core.js. No archive key belongs in this file.
// Shared source. Generated installers are standalone; no importModule/downloads.
const APP = 'https://timber-inkfieldnotes.netlify.app'
const CALENDAR_KEY = 'field-notes.calendar.v1'
const WEATHER = { label: 'Tulsa', lat: 36.154, lon: -95.993, unit: 'F' }
const COLORS = { teal: '#14322e', spruce: '#24332a', ink: '#f6f3ec', quiet: '#cbd1ca', amber: '#c6862f' }
const SOURCES = ['ready','loading','setup','disconnected','denied','stale','offline','unavailable','error']
function iso(date) { return date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) }
function pad(value) { return String(value).padStart(2,'0') }
function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(day+'T12:00:00')
  return Number.isFinite(+date) && iso(date) === day
}
function monthDays(now) {
  const start = new Date(now.getFullYear(),now.getMonth(),1,12)
  start.setDate(1-start.getDay())
  const days = Array.from({length:42},(_,i) => { const day = new Date(start); day.setDate(start.getDate()+i); return { iso:iso(day), date:day.getDate(), inMonth:day.getMonth()===now.getMonth() } })
  return days[35].inMonth ? days : days.slice(0,35)
}
function exactKeys(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).sort().join(',') === keys.slice().sort().join(',')
}
function decodeSnapshot(body) {
  if (!exactKeys(body,['snapshot','updatedAt','expiresAt'])) throw Error('Invalid calendar response')
  const s=body.snapshot
  if (!exactKeys(s,['version','from','to','timezone','written','events','sources']) || s.version!==1 || !validDay(s.from) || !validDay(s.to) || s.to<s.from || (new Date(s.to+'T12:00:00Z')-new Date(s.from+'T12:00:00Z'))/86400000>399 || typeof s.timezone!=='string' || !/^[A-Za-z0-9_+/-]{1,80}$/.test(s.timezone)) throw Error('Invalid calendar response')
  new Intl.DateTimeFormat('en-US',{timeZone:s.timezone})
  for (const key of ['written','events']) {
    if (!Array.isArray(s[key]) || s[key].length>400 || s[key].some(day=>!validDay(day)||day<s.from||day>s.to)) throw Error('Invalid calendar dates')
  }
  if (!exactKeys(s.sources,['davis','apple','work']) || Object.values(s.sources).some(status=>!SOURCES.includes(status))) throw Error('Invalid calendar sources')
  if (!Number.isFinite(Date.parse(body.updatedAt)) || !Number.isFinite(Date.parse(body.expiresAt)) || Date.parse(body.updatedAt)>Date.now()+300000) throw Error('Invalid calendar time')
  return body
}
function decodeSetup(text) {
  const value = JSON.parse(text)
  if (!exactKeys(value,['version','url','publicKey','token']) || value.version!==1 || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(value.url) || typeof value.publicKey!=='string' || value.publicKey.length<20 || value.publicKey.length>2000 || /\s/.test(value.publicKey) || !/^[a-f0-9]{64}$/.test(value.token)) throw Error('Use the private widget setup code from Field Notes Settings, not your archive pairing code.')
  return value
}
function storedConnection() {
  try { return Keychain.contains(CALENDAR_KEY) ? JSON.parse(Keychain.get(CALENDAR_KEY)) : null } catch (_) { return null }
}
function cacheFile(name) { const fm=FileManager.local(); return fm.joinPath(fm.cacheDirectory(),'field-notes-'+name+'.json') }
function cached(name) { try { const fm=FileManager.local(), path=cacheFile(name); return fm.fileExists(path)?JSON.parse(fm.readString(path)):null } catch (_) { return null } }
function storeCache(name,value) { try { FileManager.local().writeString(cacheFile(name),JSON.stringify(value)) } catch (_) {} }
function clearCache(name) { try { const fm=FileManager.local(),path=cacheFile(name); if(fm.fileExists(path)) fm.remove(path) } catch (_) {} }
async function readCalendar() {
  const connection = storedConnection()
  if (!connection) return { body:null, status:'Connect calendar marks in Scriptable' }
  const cacheName='calendar-'+connection.cacheId
  let previous=null
  try { const raw=cached(cacheName); if(raw) previous=decodeSnapshot(raw) } catch (_) {}
  if(previous && Date.parse(previous.expiresAt)<=Date.now()) { clearCache(cacheName); previous=null }
  try {
    const request = new Request(connection.url.replace(/\/$/,'')+'/rest/v1/rpc/widget_read')
    request.method='POST'; request.timeoutInterval=12
    request.headers={apikey:connection.publicKey, Authorization:'Bearer '+connection.publicKey, 'Content-Type':'application/json', 'Cache-Control':'no-store'}
    request.body=JSON.stringify({p_token:connection.token})
    const response=await request.loadString()
    if (request.response.statusCode===401 || request.response.statusCode===403) { clearCache(cacheName); return {body:null,status:'Calendar access unavailable · reconnect'} }
    if (request.response.statusCode!==200 || response.length>20000) throw Error('Calendar unavailable')
    const raw=JSON.parse(response)
    if(raw===null) { clearCache(cacheName); return {body:null,status:'Calendar key expired or revoked'} }
    const body=decodeSnapshot(raw)
    if(Date.parse(body.expiresAt)<=Date.now()) { clearCache(cacheName); return {body:null,status:'Calendar key expired · reconnect'} }
    storeCache(cacheName,body)
    return {body,status:null}
  } catch (_) { return {body:previous,status:previous?'Offline · saved calendar snapshot':'Calendar unavailable · open Field Notes'} }
}
function snapshotCaption(result,now) {
  if (!result.body) return result.status
  const body=result.body, date=new Date(body.updatedAt)
  const age=now-date
  const when=age<86400000?date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):date.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  const states=Object.values(body.snapshot.sources)
  const partial=states.some(s=>!['ready','setup','disconnected','unavailable'].includes(s))
  return (result.status?'Offline · ':age>86400000?'Old snapshot · ':partial?'Partial · ':'Snapshot · ')+when
}
function font(size,serif) { return serif ? new Font('Georgia',size) : Font.mediumSystemFont(size) }
function drawing(width,height) { const ctx=new DrawContext(); ctx.size=new Size(width,height); ctx.opaque=false; ctx.respectScreenScale=true; return ctx }
function drawText(ctx,text,x,y,width,height,size,color,serif) { ctx.setTextColor(new Color(color)); ctx.setFont(font(size,serif)); ctx.setTextAlignedCenter(); ctx.drawTextInRect(String(text),new Rect(x,y,width,height)) }
function calendarImage(now,result,family) {
  const small=family==='small', medium=family==='medium'
  const width=small?134:300, height=small?130:medium?120:270
  const ctx=drawing(width,height), days=monthDays(now)
  const body=result.body, snapshot=body&&body.snapshot
  const written=new Set(snapshot?snapshot.written:[]), events=new Set(snapshot?snapshot.events:[])
  const heading=now.toLocaleDateString('en-US',{month:'long',year:'numeric'})
  drawText(ctx,heading,0,0,width,small?22:32,small?15:medium?19:26,COLORS.ink,true)
  const top=small?26:medium?30:48, weekdayHeight=small?12:medium?12:22
  const rowHeight=small?14:medium?11:28, cell=width/7
  'SMTWTFS'.split('').forEach((day,i)=>drawText(ctx,day,i*cell,top,cell,weekdayHeight,small?8:medium?8:11,COLORS.quiet,false))
  days.forEach((day,i)=>{
    const col=i%7,row=Math.floor(i/7), x=col*cell, y=top+weekdayHeight+row*rowHeight
    const today=day.iso===iso(now), diameter=small?12:medium?10:24
    const circle=new Rect(x+(cell-diameter)/2,y+(rowHeight-diameter)/2,diameter,diameter)
    if(today || events.has(day.iso)) { ctx.setFillColor(new Color(COLORS.ink,today?1:day.inMonth?0.2:0.08)); ctx.fillEllipse(circle) }
    if(written.has(day.iso)) { ctx.setStrokeColor(new Color(COLORS.ink,day.inMonth?0.85:0.35)); ctx.setLineWidth(small||medium?0.8:1.4); ctx.strokeEllipse(circle) }
    drawText(ctx,day.date,x,y+(medium?-1:0),cell,rowHeight,small?9:medium?9:15,today?COLORS.teal:day.inMonth?COLORS.ink:'#77938d',false)
  })
  if(!small&&!medium) {
    const caption=body&&snapshot.from<=days[0].iso&&snapshot.to>=days[days.length-1].iso?snapshotCaption(result,now):body?'Snapshot does not cover this month':result.status
    drawText(ctx,caption,0,243,width,16,10,COLORS.quiet,false)
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone
    drawText(ctx,snapshot&&zone!==snapshot.timezone?'Snapshot zone: '+snapshot.timezone:'Ring · writing     Fill · events',0,259,width,11,8,COLORS.quiet,false)
  }
  return ctx.getImage()
}
function condition(code,isDay) {
  if(code===0) return {word:'Clear',symbol:isDay?'sun.max':'moon.stars'}
  if(code===1||code===2) return {word:code===1?'Mostly clear':'Partly cloudy',symbol:isDay?'cloud.sun':'cloud.moon'}
  if(code===3) return {word:'Overcast',symbol:'cloud'}
  if(code===45||code===48) return {word:'Fog',symbol:'cloud.fog'}
  if([51,53,55,56,57].includes(code)) return {word:'Drizzle',symbol:'cloud.drizzle'}
  if([61,63,65,66,67].includes(code)) return {word:'Rain',symbol:'cloud.rain'}
  if([71,73,75,77,85,86].includes(code)) return {word:'Snow',symbol:'cloud.snow'}
  if([80,81,82].includes(code)) return {word:'Showers',symbol:'cloud.heavyrain'}
  if([95,96,99].includes(code)) return {word:'Thunderstorm',symbol:'cloud.bolt.rain'}
  return {word:'Weather',symbol:'cloud'}
}
function decodeWeather(raw) {
  const finite=n=>typeof n==='number'&&Number.isFinite(n)
  if(!raw||!raw.current||!finite(raw.current.temperature_2m)||!finite(raw.current.weather_code)||![0,1].includes(raw.current.is_day)) throw Error('Invalid weather')
  const daily=[]
  for(let i=0;i<5;i++) {
    const d=raw.daily
    if(!d||!Array.isArray(d.time)||!validDay(d.time[i])||!finite(d.temperature_2m_max&&d.temperature_2m_max[i])||!finite(d.temperature_2m_min&&d.temperature_2m_min[i])||!finite(d.weather_code&&d.weather_code[i])) continue
    daily.push({date:d.time[i],high:d.temperature_2m_max[i],low:d.temperature_2m_min[i],code:d.weather_code[i]})
  }
  return {temp:raw.current.temperature_2m,code:raw.current.weather_code,isDay:raw.current.is_day===1,daily,at:Date.now()}
}
async function readWeather() {
  const key='weather-'+WEATHER.unit
  const previous=cached(key)
  try {
    const request=new Request('https://api.open-meteo.com/v1/forecast?latitude='+WEATHER.lat+'&longitude='+WEATHER.lon+'&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America%2FChicago&forecast_days=5&temperature_unit='+(WEATHER.unit==='F'?'fahrenheit':'celsius'))
    request.timeoutInterval=12
    const body=await request.loadString()
    if(request.response.statusCode!==200||body.length>30000) throw Error('Weather unavailable')
    const reading=decodeWeather(JSON.parse(body)); storeCache(key,reading); return {reading,offline:false}
  } catch (_) {
    return previous&&typeof previous.temp==='number'&&Number.isFinite(previous.temp)&&Array.isArray(previous.daily)&&Date.now()-previous.at<86400000?{reading:previous,offline:true}:{reading:null,offline:true}
  }
}
function label(stack,value,size,color,serif) { const text=stack.addText(String(value));text.font=font(size,serif);text.textColor=new Color(color||COLORS.ink);text.minimumScaleFactor=0.7;text.lineLimit=1;return text }
function symbol(stack,name,size) { const glyph=SFSymbol.named(name);glyph.applyFont(Font.systemFont(size));const item=stack.addImage(glyph.image);item.tintColor=new Color(COLORS.ink);item.imageSize=new Size(size,size);return item }
function basicWidget(background,url) { const w=new ListWidget();w.backgroundColor=new Color(background);w.setPadding(14,14,14,14);w.url=url;w.refreshAfterDate=new Date(Date.now()+30*60000);return w }
async function calendarWidget(family) {
  const now=new Date(),result=await readCalendar(), w=basicWidget(COLORS.teal,APP+'/calendar/'+iso(now).slice(0,7)+'?source=scriptable')
  const picture=w.addImage(calendarImage(now,result,family));picture.resizable=true;picture.applyFittingContentMode()
  if(family==='small'||family==='medium') { const status=label(w,result.body?snapshotCaption(result,now):'Marks not connected',8,COLORS.quiet);status.centerAlignText() }
  return w
}
async function weatherWidget(family) {
  const w=basicWidget(COLORS.spruce,APP+'/weather'),result=await readWeather(),r=result.reading
  label(w,WEATHER.label.toUpperCase(),11,COLORS.quiet)
  w.addSpacer(5)
  if(!r) { label(w,'Weather unavailable',15);w.addSpacer();label(w,'Open Field Notes',11,COLORS.quiet);return w }
  const current=w.addStack();current.centerAlignContent();symbol(current,condition(r.code,r.isDay).symbol,30);current.addSpacer(10);label(current,Math.round(r.temp)+'°',family==='small'?34:family==='medium'?38:34,COLORS.ink,true)
  label(w,condition(r.code,r.isDay).word,12)
  if(r.daily.length) label(w,'H '+Math.round(r.daily[0].high)+'°  L '+Math.round(r.daily[0].low)+'°',11,COLORS.quiet)
  if(family==='large'||family==='extraLarge') {
    w.addSpacer(6)
    for(const day of r.daily) { const row=w.addStack();row.centerAlignContent();label(row,new Date(day.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'}),12);row.addSpacer();symbol(row,condition(day.code,true).symbol,14);row.addSpacer();label(row,Math.round(day.high)+'°  '+Math.round(day.low)+'°',12);w.addSpacer(4) }
  } else if(family==='medium') {
    const row=w.addStack();row.spacing=8
    for(const day of r.daily.slice(1,5)) label(row,new Date(day.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})+' '+Math.round(day.high)+'°',9,COLORS.quiet)
  }
  w.addSpacer()
  label(w,(result.offline?'Offline · ':'')+'Open-Meteo · '+new Date(r.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),8,COLORS.quiet)
  return w
}
function noteWidget() {
  const w=basicWidget(COLORS.spruce,APP+'/quick-note?source=scriptable');w.addSpacer();symbol(w,'square.and.pencil',25);w.addSpacer(14);label(w,'Quick note',23,COLORS.ink,true);label(w,'A thought to keep…',10,COLORS.quiet);w.addSpacer();return w
}
function dateWidget() {
  const now=new Date(),w=basicWidget(COLORS.amber,APP+'/day/'+iso(now)+'?source=scriptable')
  w.addSpacer();label(w,now.toLocaleDateString('en-US',{weekday:'long'}),16,COLORS.teal);label(w,now.getDate(),46,COLORS.teal,true);label(w,now.toLocaleDateString('en-US',{month:'long'}),16,COLORS.teal);w.addSpacer();return w
}
async function configureCalendar() {
  const prompt=new Alert();prompt.title='Connect calendar marks';prompt.message='Paste the private widget setup code from Field Notes → Settings → Home Screen widgets. This grants read-only date markers. Never paste your archive pairing code.';prompt.addSecureTextField('Private widget setup code');prompt.addAction('Connect');prompt.addCancelAction('Cancel')
  if(await prompt.presentAlert()!==0) return
  try {
    const value=decodeSetup(prompt.textFieldValue(0)),old=storedConnection()
    value.cacheId=String(Date.now())
    Keychain.set(CALENDAR_KEY,JSON.stringify(value))
    if(old) clearCache('calendar-'+old.cacheId)
    const result=await readCalendar()
    const notice=new Alert();notice.title=result.body?'Calendar connected':'Check calendar connection';notice.message=result.body?'Add the Field Notes Calendar widget on your Home Screen.':result.status;notice.addAction('OK');await notice.presentAlert()
  } catch (_) { const notice=new Alert();notice.title='Setup code not accepted';notice.message='Copy the private widget setup code from Field Notes Settings. Your archive pairing code is not used here.';notice.addAction('OK');await notice.presentAlert() }
}
async function run(kind) {
  let family=config.widgetFamily||(kind==='calendar'?'large':kind==='weather'?'medium':'small')
  if(!config.runsInWidget && kind==='calendar') {
    const menu=new Alert();menu.title='Field Notes Calendar';menu.addAction('Preview calendar');menu.addAction('Connect calendar marks');menu.addDestructiveAction('Forget this device’s calendar key');menu.addCancelAction('Cancel')
    const action=await menu.presentSheet()
    if(action<0) { Script.complete();return }
    if(action===1) await configureCalendar()
    if(action===2) { const old=storedConnection();if(old)clearCache('calendar-'+old.cacheId);if(Keychain.contains(CALENDAR_KEY))Keychain.remove(CALENDAR_KEY);Script.complete();return }
  }
  const widget=kind==='calendar'?await calendarWidget(family):kind==='weather'?await weatherWidget(family):kind==='date'?dateWidget():noteWidget()
  Script.setWidget(widget)
  if(!config.runsInWidget) { if(family==='large') await widget.presentLarge();else if(family==='medium') await widget.presentMedium();else await widget.presentSmall() }
  Script.complete()
}

await run("calendar")
