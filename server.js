require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const {DateTime} = require('luxon');
const path = require('path');
const crypto = require('crypto');
const app = express();
const TZ = 'America/Fortaleza';
const db = new Database(path.join(__dirname, 'bookings.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, service TEXT NOT NULL, day TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', notification_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS active_slot ON bookings(day,time) WHERE status='confirmed';`);
const services = {'Corte masculino':40,'Degradê':45,'Barba':30,'Sobrancelha':20};
const phoneClean = v => String(v||'').replace(/\D/g,'');
const toBR = v => {const d=phoneClean(v);return d.startsWith('55')&&d.length===13?d:(d.length===11?'55'+d:null)};
const validDay = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && DateTime.fromISO(day,{zone:TZ}).isValid;
const slotTimes = Array.from({length:20},(_,i)=>DateTime.fromObject({hour:9,minute:0},{zone:TZ}).plus({minutes:i*30}).toFormat('HH:mm'));
const now = ()=>DateTime.now().setZone(TZ);
const available = (day,time) => validDay(day) && slotTimes.includes(time) && DateTime.fromISO(`${day}T${time}`,{zone:TZ})>now() && DateTime.fromISO(day,{zone:TZ}).weekday!==7;
app.use(express.json({limit:'12kb'}));
app.use(express.static(path.join(__dirname,'public')));
app.get('/api/config',(req,res)=>res.json({services,open:'Segunda a sábado, 09:00–19:00',whatsappReady:!!(process.env.WA_PHONE_NUMBER_ID&&process.env.WA_ACCESS_TOKEN)}));
app.get('/api/slots',(req,res)=>{const day=String(req.query.day||'');if(!validDay(day))return res.status(400).json({error:'Data inválida'});const taken=new Set(db.prepare("SELECT time FROM bookings WHERE day=? AND status='confirmed'").all(day).map(x=>x.time));res.json({slots:slotTimes.map(time=>({time,available:available(day,time)&&!taken.has(time)}))});});
async function sendTemplate(to,template,parts){
 const id=process.env.WA_PHONE_NUMBER_ID,token=process.env.WA_ACCESS_TOKEN;
 if(!id||!token||!template)throw Error('WhatsApp Cloud API não configurada');
 const response=await fetch(`https://graph.facebook.com/${process.env.WA_API_VERSION||'v22.0'}/${id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:template,language:{code:'pt_BR'},components:[{type:'body',parameters:parts.map(text=>({type:'text',text:String(text)}))}]}})});
 if(!response.ok)throw Error(`WhatsApp HTTP ${response.status}: ${(await response.text()).slice(0,250)}`);
 return response.json();
}
app.post('/api/bookings',async(req,res)=>{
 const {name,phone,service,day,time}=req.body||{};
 const cleanName=String(name||'').trim().replace(/\s+/g,' ');
 const client=toBR(phone);
 if(cleanName.length<2||cleanName.length>80||!client||!Object.hasOwn(services,service)||!available(day,time))return res.status(400).json({error:'Confira nome, WhatsApp, serviço, data e horário.'});
 const id=crypto.randomUUID();
 try{db.prepare('INSERT INTO bookings (id,name,phone,service,day,time,created_at) VALUES (?,?,?,?,?,?,?)').run(id,cleanName,client,service,day,time,now().toISO());}
 catch(e){if(e.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Esse horário acabou de ser reservado. Escolha outro.'});throw e;}
 const when=DateTime.fromISO(`${day}T${time}`,{zone:TZ}).toFormat('dd/MM/yyyy HH:mm');
 const barber=toBR(process.env.BUSINESS_WHATSAPP||'5585921541651');
 const results=await Promise.allSettled([
   sendTemplate(barber,process.env.WA_TEMPLATE_BARBER,[cleanName,service,when,client]),
   sendTemplate(client,process.env.WA_TEMPLATE_CLIENT,[cleanName,service,when,'JK Barbearia'])
 ]);
 const sent=results.filter(x=>x.status==='fulfilled').length;
 db.prepare('UPDATE bookings SET notification_status=? WHERE id=?').run(sent===2?'sent':sent===1?'partial':'failed',id);
 for(const r of results)if(r.status==='rejected')console.error('Falha na notificação:',r.reason.message);
 res.status(201).json({id,when,notificationStatus:sent===2?'sent':sent===1?'partial':'failed',message:'Agendamento registrado.'});
});
function admin(req,res,next){const secret=process.env.ADMIN_TOKEN;if(!secret||secret==='troque-por-uma-senha-longa-e-aleatoria')return res.status(503).json({error:'Configure ADMIN_TOKEN'});const token=req.get('x-admin-token')||'';const a=Buffer.from(token),b=Buffer.from(secret);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Acesso negado'});next();}
app.get('/api/admin/bookings',admin,(req,res)=>res.json(db.prepare('SELECT id,name,phone,service,day,time,status,notification_status FROM bookings ORDER BY day DESC,time DESC LIMIT 500').all()));
app.patch('/api/admin/bookings/:id/cancel',admin,(req,res)=>{const result=db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'").run(req.params.id);if(!result.changes)return res.status(404).json({error:'Agendamento não encontrado'});res.json({ok:true,note:'Cancelamento registrado; avisos de cancelamento não são enviados automaticamente.'});});
app.listen(Number(process.env.PORT)||3000,()=>console.log('JK Barbearia pronta na porta '+(process.env.PORT||3000)));
