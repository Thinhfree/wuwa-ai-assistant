import { buildGuide, guideLinks, pickObjective, pickQuestTitle, cleanText, progressPercent } from './logic.mjs';

const $ = (id) => document.getElementById(id);
const STORAGE = 'wuwa-assistant-v1';
const DEFAULT_DATA = { tasks: [], endpoint: '' };

function loadStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    return {tasks: Array.isArray(parsed.tasks) ? parsed.tasks.slice(0,200) : [], endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : ''};
  } catch { return {...DEFAULT_DATA}; }
}
const data = loadStored();
const state = {
  imageData:null, crop:null, drawing:false, cropStart:null, cropEnabled:false,
  currentGuide:null, checks:[], editingId:null, aiAuth:'', imageName:'', toastTimeout:null, worker:null, lastAutoObjective:'', lastAutoTitle:'', previousGuide:null, aiBusy:false, uploadSerial:0
};

function saveData() {
  try { localStorage.setItem(STORAGE, JSON.stringify(data)); return true; }
  catch { toast('Không ghi được dữ liệu. Có thể trình duyệt đã hết dung lượng hoặc chặn lưu.',true); return false; }
}
function toast(msg, bad=false) {
  const t=$('toast'); t.textContent=msg; t.classList.toggle('bad',bad); t.classList.add('show');
  clearTimeout(state.toastTimeout); state.toastTimeout=setTimeout(()=>t.classList.remove('show'),3600);
}
function updateStats() {
  $('countAll').textContent=String(data.tasks.length);
  $('countDone').textContent=String(data.tasks.filter(t=>progressPercent(t.steps)===100 && t.steps.length).length);
}
function showTab(key) {
  for (const page of ['analyze','missions','settings']) {
    const active=page===key;
    $(`page-${page}`).hidden=!active; $(`page-${page}`).classList.toggle('active',active);
    const tab=document.querySelector(`[data-tab="${page}"]`);
    tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active));
  }
  if(key==='missions') renderMissions();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));

const dialog=$('helpDialog');
$('helpButton').addEventListener('click',()=>dialog.showModal());
$('closeHelp').addEventListener('click',()=>dialog.close());
$('helpOk').addEventListener('click',()=>dialog.close());

function setOcrStatus(msg,error=false) { $('ocrStatus').textContent=msg; $('ocrStatus').classList.toggle('error',error); }
function setBusy(active) { $('ocrButton').disabled=active; $('ocrProgressWrap').hidden=!active; if(!active)$('ocrProgress').style.width='0%'; }
function readImageAsDataURL(file) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file); const im=new Image();
    im.onload=()=>{
      try {
        if(im.width*im.height>45000000) throw new Error('Độ phân giải ảnh quá lớn.');
        const maxSide=1900,scale=Math.min(1,maxSide/Math.max(im.width,im.height));
        const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.width*scale));cv.height=Math.max(1,Math.round(im.height*scale));
        const ctx=cv.getContext('2d',{alpha:false});if(!ctx)throw new Error('Không tạo được Canvas');
        ctx.drawImage(im,0,0,cv.width,cv.height);
        resolve({dataUrl:cv.toDataURL('image/jpeg',.88), width:cv.width,height:cv.height});
      } catch(e){reject(e)} finally{URL.revokeObjectURL(url)}
    };
    im.onerror=()=>{URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh. Hãy dùng PNG/JPG từ ứng dụng Ảnh.'))};
    im.src=url;
  });
}
async function setImage(file) {
  if(!file)return;
  if(!(file.type.startsWith('image/')||/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name))){toast('Hãy chọn một file hình ảnh.',true);return}
  if(file.size>35*1024*1024){toast('Ảnh vượt quá 35MB. Hãy chụp lại hoặc nén ảnh.',true);return}
  const requestId=++state.uploadSerial;
  setOcrStatus('Đang đọc ảnh…');
  try {
    const obj=await readImageAsDataURL(file);
    if(requestId!==state.uploadSerial)return;
    state.imageData=obj.dataUrl;state.imageName=file.name;state.crop=null;state.cropEnabled=false;
    // A new screenshot must not silently reuse an old quest title/objective/category.
    $('questTitle').value='';
    $('questObjective').value='';
    $('ocrText').value='';
    $('questKind').value='auto';
    if(state.currentGuide?.source==='ai') state.previousGuide=state.currentGuide;
    state.currentGuide=null;state.checks=[];state.editingId=null;
    $('resultSection').hidden=true;
    $('cropRect').hidden=true;$('clearCrop').hidden=true;$('cropToggle').textContent='Khoanh vùng chữ';$('cropSurface').classList.remove('crop-mode');
    $('previewImage').src=obj.dataUrl;$('previewWrap').hidden=false;$('uploadZone').hidden=true;
    $('imageMeta').textContent=`${obj.width} × ${obj.height} • xử lý cục bộ`;
    setOcrStatus('Ảnh đã sẵn sàng. Có thể bấm “Giải nhiệm vụ bằng AI” ngay; OCR không bắt buộc.');
  } catch(e){if(requestId===state.uploadSerial)setOcrStatus(String(e.message||e),true)}
}
$('imageInput').addEventListener('change',async e=>{await setImage(e.target.files?.[0]);e.target.value='';});
$('resetImage').addEventListener('click',()=>{$('imageInput').click()});
const drop=$('uploadZone');
for(const e of ['dragenter','dragover'])drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('drag')});
for(const e of ['dragleave','drop'])drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('drag')});
drop.addEventListener('drop',ev=>setImage(ev.dataTransfer?.files?.[0]));
$('cropToggle').addEventListener('click',()=>{
  if(!state.imageData)return;
  state.cropEnabled=!state.cropEnabled;
  $('cropSurface').classList.toggle('crop-mode',state.cropEnabled);
  $('cropToggle').textContent=state.cropEnabled?'Hoàn tất khoanh vùng':'Khoanh vùng chữ';
  setOcrStatus(state.cropEnabled?'Kéo trên hình để chọn khung chữ cần đọc.':'Đã kết thúc chế độ khoanh vùng.');
});
$('clearCrop').addEventListener('click',()=>{state.crop=null;$('cropRect').hidden=true;$('clearCrop').hidden=true;setOcrStatus('Đã bỏ vùng chọn. OCR sẽ đọc toàn bộ ảnh.');});
function pointerXY(ev){const r=$('cropSurface').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height))};}
function drawCrop(a,b){const r={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};state.crop=r;
  const el=$('cropRect');el.hidden=false;el.style.left=`${r.x*100}%`;el.style.top=`${r.y*100}%`;el.style.width=`${r.w*100}%`;el.style.height=`${r.h*100}%`;}
$('cropSurface').addEventListener('pointerdown',ev=>{
  if(!state.cropEnabled||!state.imageData)return;
  ev.preventDefault();state.drawing=true;state.cropStart=pointerXY(ev);
  $('cropSurface').setPointerCapture?.(ev.pointerId);drawCrop(state.cropStart,state.cropStart);
});
$('cropSurface').addEventListener('pointermove',ev=>{if(!state.drawing)return;ev.preventDefault();drawCrop(state.cropStart,pointerXY(ev))});
function cropPointerEnd(){if(!state.drawing)return;state.drawing=false;if(state.crop && state.crop.w>.015 && state.crop.h>.015){$('clearCrop').hidden=false;setOcrStatus('Đã khoanh vùng. OCR sẽ chỉ đọc phần vừa chọn.')}else{state.crop=null;$('cropRect').hidden=true;setOcrStatus('Vùng chọn quá nhỏ; sẽ đọc toàn bộ ảnh.')}}
$('cropSurface').addEventListener('pointerup',cropPointerEnd);
$('cropSurface').addEventListener('pointercancel',cropPointerEnd);

async function getImageForProcessing() {
  if(!state.imageData)return null;
  if(!state.crop)return state.imageData;
  const im=new Image();im.src=state.imageData;await im.decode();
  const {x,y,w,h}=state.crop;
  const sx=Math.max(0,Math.floor(x*im.naturalWidth)),sy=Math.max(0,Math.floor(y*im.naturalHeight));
  const sw=Math.min(im.naturalWidth-sx,Math.max(1,Math.floor(w*im.naturalWidth))),sh=Math.min(im.naturalHeight-sy,Math.max(1,Math.floor(h*im.naturalHeight)));
  const cv=document.createElement('canvas');cv.width=sw;cv.height=sh;
  cv.getContext('2d').drawImage(im,sx,sy,sw,sh,0,0,sw,sh);
  return cv.toDataURL('image/jpeg',.94);
}
function ensureTesseract() {
  if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
  if(window.__tesseractLoading)return window.__tesseractLoading;
  window.__tesseractLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';s.crossOrigin='anonymous';
    s.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('Thư viện OCR không khởi tạo được.'));
    s.onerror=()=>reject(new Error('Không tải được OCR. Kiểm tra kết nối Internet rồi thử lại.'));
    document.head.append(s);
  }).catch(err=>{window.__tesseractLoading=null;throw err});
  return window.__tesseractLoading;
}
$('ocrButton').addEventListener('click',async()=>{
  if(!state.imageData){toast('Bạn chưa chọn ảnh. Có thể nhập chữ thủ công để phân tích.',true);return}
  setBusy(true);$('ocrProgress').style.width='3%';setOcrStatus('Đang tải bộ nhận diện chữ…');
  let worker=null;
  try{
    const T=await ensureTesseract();
    const lang=$('ocrLang').value;
    worker=await T.createWorker(lang,1,{logger:(m)=>{
      if(typeof m.progress==='number')$('ocrProgress').style.width=`${Math.max(5,Math.round(m.progress*95))}%`;
      if(m.status)setOcrStatus(`OCR: ${m.status} ${typeof m.progress==='number'?Math.round(m.progress*100)+'%':''}`);
    }});
    const image=await getImageForProcessing();
    const result=await worker.recognize(image);
    const recognized=cleanText(result?.data?.text||'');
    if(!recognized){setOcrStatus('Không nhận diện được chữ. Thử khoanh đúng khu vực chứa chữ hoặc nhập tay.',true);return}
    $('ocrText').value=recognized;
    // For each OCR pass, refresh inferred fields; no stale quest HUD text.
    $('questObjective').value=pickObjective(recognized);
    $('questTitle').value=pickQuestTitle(recognized);
    $('questKind').value='auto';
    state.lastAutoObjective=$('questObjective').value;
    state.lastAutoTitle=$('questTitle').value;
    if(!$('questObjective').value) toast('Chưa thấy mục tiêu. Hãy khoanh đúng khu vực chữ trong game hoặc nhập tay.',true);
    setOcrStatus(`Đã nhận diện ${recognized.length} ký tự trên thiết bị. Hãy kiểm tra và sửa phần chữ đọc sai.`);
    $('ocrProgress').style.width='100%';toast('Đọc chữ thành công!');
  } catch(e){console.error(e);setOcrStatus(`Lỗi OCR: ${e?.message||e}`,true)}
  finally{if(worker)await worker.terminate().catch(()=>{});setBusy(false)}
});

const byText=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(text??'');return e};
function addButton(text,cls,onClick){const b=byText('button',`btn ${cls}`,text);b.type='button';b.addEventListener('click',onClick);return b}
function addLink(text,url){const a=byText('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a}

function analyzeCurrent(){
  const title=$('questTitle').value.trim(),objective=$('questObjective').value.trim(),ocr=$('ocrText').value.trim();
  if(!title&&!objective&&!ocr){toast('Hãy chọn ảnh để OCR hoặc nhập tên / mục tiêu nhiệm vụ.',true);return}
  const guide=buildGuide({title,objective,ocr,kind:$('questKind').value});
  state.currentGuide=guide;state.checks=guide.steps.map(()=>false);state.editingId=null;
  renderGuide();toast('Đã phân tích kiểu nhiệm vụ (không dùng AI online).');
}
$('analyzeButton').addEventListener('click',analyzeCurrent);
$('demoButton').addEventListener('click',()=>{
  $('questTitle').value='Demo • Cơ quan bí ẩn';
  $('questObjective').value='Investigate the nearby mechanism';
  $('ocrText').value='Investigate the nearby mechanism\nActivate the switch\nFind a way to open the locked door';
  $('questKind').value='auto';analyzeCurrent();
});

function renderGuide(){
  const g=state.currentGuide;if(!g)return;
  $('resultSection').hidden=false;
  const root=$('guideMount');root.replaceChildren();
  const top=byText('div','result-header','');
  const left=byText('div','', '');left.append(byText('div','result-eyebrow',g.source==='ai'?'AI VISION / GỢI Ý':'OFFLINE / GỢI Ý THEO LOẠI'));
  left.append(byText('h2','result-title',g.title));left.append(byText('div','result-type',`${g.category||'Phân tích hình ảnh'} • Độ tin cậy ${g.confidence||'chưa xác định'}`));
  if(g.source==='ai')left.append(byText('p','verification',`🔎 ${g.verification||'Chưa có nguồn web'}`));
  top.append(left,byText('span','result-tag',g.source==='ai'?'AI ONLINE':'MIỄN PHÍ'));root.append(top);
  root.append(byText('div','result-summary',g.summary));
  root.append(byText('div','result-subtitle','MỤC TIÊU HIỆN TẠI'),byText('div','result-objective',g.objective));
  root.append(byText('div','result-subtitle','CHECKLIST ĐỀ XUẤT'));
  const ul=byText('ol','result-list','');
  g.steps.forEach((txt,i)=>{
    const li=byText('li','step-row','');const ck=document.createElement('input');ck.type='checkbox';ck.checked=!!state.checks[i];
    ck.setAttribute('aria-label',`Hoàn thành bước ${i+1}`);
    li.classList.toggle('done',ck.checked);
    ck.addEventListener('change',()=>{state.checks[i]=ck.checked;li.classList.toggle('done',ck.checked);if(state.editingId){const t=data.tasks.find(t=>t.id===state.editingId);if(t){t.steps[i].done=ck.checked;saveData();updateStats();}}});
    li.append(ck,byText('span','',txt));ul.append(li);
  });root.append(ul);
  if(g.warning)root.append(byText('p','result-warning',`ⓘ ${g.warning}`));
  if(g.source==='ai' && Array.isArray(g.sources) && g.sources.length){
    root.append(byText('div','result-subtitle','NGUỒN HƯỚNG DẪN THAM KHẢO'));
    const cited=byText('div','source-list','');
    for(const src of g.sources.slice(0,5)){
      if(typeof src?.url!=='string'||!/^https?:\/\//.test(src.url))continue;
      cited.append(addLink(`↗ ${String(src.title||'Mở nguồn').slice(0,90)}`,src.url));
    }
    root.append(cited);
  }
  const actions=byText('div','result-action','');
  actions.append(addButton(state.editingId?'✓ CẬP NHẬT JOURNAL':'↓ LƯU VÀO JOURNAL','btn-primary',saveCurrentGuide));
  actions.append(addButton('✧ HỎI AI LẠI','btn-outline',analyzeWithAI));
  root.append(actions);
  const links=guideLinks(g.query||$('questTitle').value||g.objective);
  const linkrow=byText('div','link-row','');linkrow.append(addLink('↗ Tìm hướng dẫn Google',links.web),addLink('▶ Tìm video YouTube',links.video));root.append(linkrow);
  if(Array.isArray(g.questions)&&g.questions.length){root.append(byText('div','result-subtitle','AI CẦN THÊM THÔNG TIN'));for(const q of g.questions.slice(0,3))root.append(byText('p','muted-note',`• ${q}`));}
  root.scrollIntoView({behavior:'smooth',block:'start'});
}
function saveCurrentGuide(){
  if(!state.currentGuide)return;
  const g=state.currentGuide;const now=new Date().toISOString();
  const old=state.editingId?data.tasks.find(t=>t.id===state.editingId):null;
  const task={id:old?.id||`${Date.now()}-${Math.random().toString(16).slice(2)}`,updatedAt:now,guide:{...g},steps:g.steps.map((text,i)=>({text,done:!!state.checks[i]}))};
  if(old){data.tasks[data.tasks.indexOf(old)]=task;}else{data.tasks.unshift(task);state.editingId=task.id;}
  if(data.tasks.length>200)data.tasks.length=200;
  if(saveData()){updateStats();toast('Đã lưu vào Journal trên thiết bị.');renderGuide();}
}

function renderMissions(){
  const root=$('missionList');root.replaceChildren();
  if(data.tasks.length===0){const div=byText('div','empty-list','');div.append(byText('div','','✧'),byText('strong','','Chưa lưu nhiệm vụ'),byText('p','','Phân tích một nhiệm vụ và nhấn “Lưu vào Journal” để xem tiến độ tại đây.'));root.append(div);return}
  for(const t of [...data.tasks].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))){
    if(!t || typeof t!=='object' || !t.guide || !Array.isArray(t.steps)) continue;
    const progress=progressPercent(t.steps),item=byText('article','mission-item',''),top=byText('div','mission-top','');
    const titleWrap=byText('div','','');titleWrap.append(byText('h3','mission-title',t.guide.title||'Nhiệm vụ chưa tên'),byText('div','mission-meta',`${t.guide.category||'Nhiệm vụ'} · ${t.steps.filter(x=>x.done).length}/${t.steps.length} bước`));
    top.append(titleWrap,byText('strong','mission-percent',`${progress}%`));item.append(top);
    const bar=byText('div','mission-progress','');const fill=byText('div','','');fill.style.width=`${progress}%`;bar.append(fill);item.append(bar);
    const acts=byText('div','mission-actions','');
    acts.append(addButton('Mở lại','btn-outline btn-small',()=>openTask(t.id)),addButton('Xóa','btn-text btn-small',()=>{
      if(!confirm(`Xóa nhiệm vụ “${t.guide.title}”?`))return;data.tasks=data.tasks.filter(x=>x.id!==t.id);saveData();updateStats();renderMissions();
    }));item.append(acts);root.append(item);
  }
}
function openTask(id){
  const t=data.tasks.find(x=>x.id===id);if(!t)return;
  state.editingId=id;state.currentGuide={...t.guide,steps:t.steps.map(s=>s.text)};state.checks=t.steps.map(s=>!!s.done);
  $('questTitle').value=t.guide.title==='Nhiệm vụ chưa đặt tên'?'':String(t.guide.title||'');
  $('questObjective').value=t.guide.objective||'';
  $('questKind').value=t.guide.type||'auto';$('ocrText').value='';
  showTab('analyze');renderGuide();
}
$('exportButton').addEventListener('click',()=>{
  const file=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),tasks:data.tasks},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='wuwa-journey-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Đã tạo file sao lưu tiến độ.');
});
$('importInput').addEventListener('change',async ev=>{
  const f=ev.target.files?.[0];if(!f)return;ev.target.value='';
  if(f.size>2_000_000){toast('File sao lưu vượt quá 2MB.',true);return}
  try {
    const j=JSON.parse(await f.text());if(j.version!==1||!Array.isArray(j.tasks))throw Error('File không đúng định dạng v1');
    const clean=j.tasks.slice(0,200).filter(t=>t&&typeof t.id==='string'&&t.guide&&Array.isArray(t.steps)&&t.steps.length<30).map(t=>({
      id:t.id.slice(0,100),updatedAt:String(t.updatedAt||new Date().toISOString()),
      guide:{ title:String(t.guide.title||'').slice(0,140),objective:String(t.guide.objective||'').slice(0,300),category:String(t.guide.category||'').slice(0,80),
        type:String(t.guide.type||'unknown').slice(0,30),confidence:String(t.guide.confidence||'thấp').slice(0,30),source:String(t.guide.source||'offline').slice(0,30),summary:String(t.guide.summary||'').slice(0,1200),
        query:String(t.guide.query||'').slice(0,230),warning:String(t.guide.warning||'').slice(0,350),steps:t.steps.map(s=>String(s.text||'').slice(0,600)) },
      steps:t.steps.map(s=>({text:String(s.text||'').slice(0,600),done:!!s.done}))
    }));
    const byId=new Map(data.tasks.map(t=>[t.id,t]));clean.forEach(t=>byId.set(t.id,t));data.tasks=[...byId.values()].slice(0,200);
    saveData();updateStats();renderMissions();toast(`Đã nhập ${clean.length} nhiệm vụ.`);
  }catch(e){toast(`Không đọc được backup: ${e.message}`,true)}
});
$('clearAllButton').addEventListener('click',()=>{
  if(!confirm('Xóa toàn bộ nhiệm vụ đã lưu trên thiết bị này? Không thể hoàn tác nếu chưa xuất backup.'))return;
  data.tasks=[];saveData();updateStats();renderMissions();toast('Đã xóa Journal trên thiết bị.');
});

function normalizeHttpsEndpoint(raw){
  const u=new URL(String(raw).trim());
  if(u.protocol!=='https:' && !(u.hostname==='localhost' && u.protocol==='http:')) throw new Error('Worker phải dùng HTTPS.');
  if(u.username||u.password)throw new Error('Không đặt thông tin đăng nhập trong URL.');
  return u.href.replace(/\/$/,'');
}
$('endpointInput').value=data.endpoint;
$('saveEndpoint').addEventListener('click',()=>{
  try {data.endpoint=$('endpointInput').value.trim()?normalizeHttpsEndpoint($('endpointInput').value):'';saveData();toast('Đã lưu URL Worker. Mật khẩu chỉ giữ trong phiên sử dụng.')}catch(e){toast(e.message,true)}
});
$('tokenInput').addEventListener('input',e=>state.aiAuth=e.target.value);
$('testEndpoint').addEventListener('click',async()=>{
  try{
    const ep=normalizeHttpsEndpoint($('endpointInput').value);
    const base=ep.replace(/\/analyze\/?$/,'');
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
    let res;try{res=await fetch(base+'/health',{signal:ctrl.signal})}finally{clearTimeout(timeout)}
    const out=await res.json();if(res.ok&&out.ok)toast(out.configured?'Worker v'+(out.version||'?')+' sẵn sàng. Hãy lưu URL, nhập mật khẩu và đồng ý gửi ảnh.':'Worker chạy được nhưng chưa thêm đủ secrets trong Cloudflare.');
    else throw Error(out.error||`HTTP ${res.status}`);
  }catch(e){toast(`Không kết nối được: ${e.message}`,true)}
});

async function getImageForAI(){
  if(!state.imageData)return null;
  if(!$('maskUid').checked)return state.imageData;
  const im=new Image();im.src=state.imageData;await im.decode();
  const cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;
  const ctx=cv.getContext('2d',{alpha:false});ctx.drawImage(im,0,0);
  // WuWa typically renders User ID in the lower-right corner. Mask a generous rectangle,
  // but warn that this can also obscure objectives if they are in that area.
  ctx.fillStyle='#0a1012';
  ctx.fillRect(Math.round(cv.width*.61),Math.round(cv.height*.92),Math.ceil(cv.width*.39),Math.ceil(cv.height*.08));
  return cv.toDataURL('image/jpeg',.84);
}
$('aiQuickButton').addEventListener('click',analyzeWithAI);

async function analyzeWithAI(){
  if(!data.endpoint){toast('Bạn chưa kết nối Worker. Mở tab “Cài đặt AI” để xem hướng dẫn.',true);showTab('settings');return}
  if(!state.aiAuth){toast('Hãy nhập mật khẩu truy cập Worker trong “Cài đặt AI”.',true);showTab('settings');return}
  if(!$('aiConsent').checked){toast('Bạn cần xác nhận đồng ý gửi ảnh và nội dung đến AI trong “Cài đặt AI”.',true);showTab('settings');return}
  if(state.aiBusy)return;
  if(!state.imageData && !$('questTitle').value.trim() && !$('questObjective').value.trim() && !$('ocrText').value.trim()){toast('Hãy chọn ảnh nhiệm vụ hoặc nhập mục tiêu trước.',true);return}
  const endpoint=normalizeHttpsEndpoint(data.endpoint);
  const analyzeUrl=endpoint.endsWith('/analyze')?endpoint:endpoint+'/analyze';
  const buttons=[...$('guideMount').querySelectorAll('button'),$('aiQuickButton')];
  state.aiBusy=true;buttons.forEach(b=>b.disabled=true);
  $('aiQuickButton').textContent='⏳ ĐANG PHÂN TÍCH...';
  $('aiProgress').textContent='Gemini đang xem ảnh và tra cứu walkthrough (có thể mất một lúc)...';
  toast('Đang phân tích ảnh và tìm hướng dẫn quest…');
  try{
    const image=await getImageForAI();
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),65000);
    let res;
    try{
      res=await fetch(analyzeUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.aiAuth}`},
        body:JSON.stringify({image,questTitle:$('questTitle').value,objective:$('questObjective').value,ocr:cleanText($('ocrText').value),previous:state.previousGuide||state.currentGuide}),signal:ctrl.signal});
    } finally {clearTimeout(timeout)}
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(body.error||`Máy chủ trả lỗi ${res.status}`);
    if(!body||!Array.isArray(body.steps)||body.steps.length<1)throw Error('Phản hồi AI không chứa checklist.');
    const guide={title:String(body.title||$('questTitle').value||'Nhiệm vụ chưa đặt tên').slice(0,140),
      objective:String(body.objective||$('questObjective').value||'Hãy xem hướng dẫn').slice(0,300),
      category:'AI phân tích ảnh',type:'unknown',confidence:String(body.confidence||'chưa xác định').slice(0,40),source:'ai',
      summary:String(body.summary||'Kết quả AI').slice(0,1500),steps:body.steps.slice(0,9).map(v=>String(v).slice(0,600)),
      query:String($('questTitle').value||$('questObjective').value).slice(0,200)+' Wuthering Waves walkthrough',
      warning:String(body.warning||'Kiểm tra hướng dẫn với mục tiêu trong game.'),verification:String(body.verification||'Chưa có nguồn web'),sources:Array.isArray(body.sources)?body.sources.slice(0,5):[],
      questions:Array.isArray(body.questions)?body.questions.slice(0,3).map(String):[]};
    state.currentGuide=guide;state.previousGuide=guide;state.checks=guide.steps.map(()=>false);state.editingId=null;
    $('questTitle').value=guide.title==='Chưa rõ tên nhiệm vụ'?'':guide.title;
    $('questObjective').value=guide.objective||$('questObjective').value;
    renderGuide();toast(body.verification==='Có nguồn tham khảo'?'Đã phân tích và tìm được nguồn tham khảo!':'Đã có hướng dẫn AI; chưa tìm thấy nguồn web.');
    $('aiProgress').textContent=body.verification||'Đã phân tích xong.';
  }catch(e){console.error(e);$('aiProgress').textContent=`Lỗi: ${e?.name==='AbortError'?'Quá thời gian chờ (65 giây).':e.message||e}`;toast(`Lỗi AI: ${e?.name==='AbortError'?'Quá thời gian chờ.':e.message||e}`,true)}
  finally{state.aiBusy=false;buttons.forEach(b=>b.disabled=false);$('aiQuickButton').textContent='✧ GIẢI NHIỆM VỤ BẰNG AI →'}
}

if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  window.addEventListener('load',async()=>{
    try {
      let wasControlled=Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(wasControlled && !sessionStorage.getItem('wuwa-sw-reloaded-v201')){
          sessionStorage.setItem('wuwa-sw-reloaded-v201','yes');
          location.reload();
        }
      });
      const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      await registration.update();
    } catch (err) { console.warn('Service Worker update skipped',err); }
  });
}
updateStats();
