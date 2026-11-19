'use strict';
const byId = id => document.getElementById(id);
const theme = byId('theme');
const themeNames={system:'跟随系统',light:'浅色',dark:'深色'};
function setTheme(mode) {
  const modes=Object.keys(themeNames);
  const current=modes.includes(mode)?mode:'system';
  const next=modes[(modes.indexOf(current)+1)%modes.length];
  document.documentElement.dataset.theme=current==='system' && window.StudioPhone ? (StudioPhone.dark()?'dark':'light') : current;
  window.syncPhoneTheme=()=>setTheme(current);
  theme.querySelector('use').setAttribute('href','#i-'+current);
  theme.title=themeNames[current]+' · 切换到'+themeNames[next];
  theme.setAttribute('aria-label',theme.title);
  theme.onclick=()=>{setTheme(next);try{localStorage.setItem('theme',next);}catch{}};
}
try {setTheme(localStorage.getItem('theme'));} catch {setTheme('system');}
const state = {style:'white',fit:'contain',preset:'3:2',meta:Frame.metadata(),image:null,name:'',note:'',showModel:false,busy:false,loading:false};
let importId=0, revision=0, toastTimer;
function say(text){const box=byId('toast');box.textContent=text;box.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('on'),3600);}
let selectedBrand='sony', selectedVariant='word';
function icon(name) {return '<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';}
function logoTile(key,type,label,previewVariant) {
  const button=document.createElement('button');
  button.type='button'; button.dataset.key=key; button.title=label;
  button.setAttribute('aria-label',label);
  const brand=type==='brand'?key:selectedBrand;
  const variant=previewVariant || key;
  const file=Frame.brands[brand][1][variant];
  if(file){
    const img=document.createElement('img');
    img.src='assets/logos/'+file; img.alt=''; img.draggable=false;
    if(type==='variant' && variant==='whiteWord')button.classList.add('white-word');
    button.append(img);
  }else if(brand==='none'||brand==='other'){
    button.innerHTML=icon(brand==='none'?'none':'text');
  }else{
    button.textContent=Frame.brands[brand][0];
  }
  return button;
}
function selectTile(strip,key,reveal){
  for(const button of strip.children){
    const active=button.dataset.key===key;
    button.setAttribute('aria-pressed',active);
    if(active && reveal){
      const delta=button.getBoundingClientRect().left-strip.getBoundingClientRect().left;
      if(delta<0 || delta+button.offsetWidth>strip.clientWidth) strip.scrollLeft+=delta-(strip.clientWidth-button.offsetWidth)/2;
    }
  }
}
function chooseBrand(brand,variant) {
  selectedBrand=brand;
  const variants=Object.keys(Frame.brands[brand][1]);
  selectedVariant=variants.includes(variant)?variant:(variants[0] || '');
  const strip=byId('variant');
  strip.replaceChildren();
  strip.hidden=variants.length<2;
  if(!strip.hidden)for(const key of variants){
    const button=logoTile(key,'variant',Frame.brands[brand][0]+' · '+Frame.labels[key]);
    button.onclick=()=>{selectedVariant=key;selectTile(strip,key,true);refresh();};
    strip.append(button);
  }
  selectTile(strip,selectedVariant,true);selectTile(byId('brand'),brand,true);
}
for(const [key,[name,variants]] of Object.entries(Frame.brands)){
  const button=logoTile(key,'brand',name,Object.keys(variants)[0]);
  button.onclick=()=>{if(key!==selectedBrand){chooseBrand(key);refresh();}};
  byId('brand').append(button);
}
for(const strip of [byId('brand'),byId('variant')]){
  strip.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    const before=strip.scrollLeft;
    strip.scrollLeft+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?strip.clientWidth:1);
    if(before!==strip.scrollLeft)event.preventDefault();
  },{passive:false});
  let drag=null, suppressClick=false;
  strip.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(event.pointerType==='mouse' && event.button===0 && strip.scrollWidth>strip.clientWidth)
      drag={id:event.pointerId,start:event.clientX,left:strip.scrollLeft};
  });
  strip.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    if(!event.buttons){drag=null;return;}
    const delta=event.clientX-drag.start;
    if(!suppressClick && Math.abs(delta)<5)return;
    suppressClick=true;strip.classList.add('dragging');strip.setPointerCapture(event.pointerId);
    strip.scrollLeft=drag.left-delta;
  });
  const endDrag=()=>{drag=null;strip.classList.remove('dragging');};
  strip.addEventListener('pointerup',endDrag);strip.addEventListener('pointercancel',endDrag);
  strip.addEventListener('click',event=>{
    if(suppressClick && event.detail){event.stopImmediatePropagation();suppressClick=false;}
  },true);
  strip.onkeydown=event=>{
    const step={ArrowLeft:-1,ArrowRight:1}[event.key];
    if(!step)return;
    const next=step===1?event.target.nextElementSibling:event.target.previousElementSibling;
    if(next){event.preventDefault();next.focus();next.click();}
  };
}
function snapshot(){
  const pair=state.preset==='自定义'?[byId('rw').valueAsNumber,byId('rh').valueAsNumber]:state.preset.split(':').map(Number);
  const ratio=pair[0]/pair[1];if(pair.some(value=>!Number.isInteger(value)||value<1||value>10000)||ratio<.1||ratio>10)return null;
  return {style:state.style,meta:{...state.meta},showModel:state.showModel,fit:state.fit,brand:selectedBrand,variant:selectedVariant,ratio,ratioText:pair.join(':'),format:byId('format').value};
}
function outSize(opts){return Frame.dimensions(opts.ratio,+byId('size').value || Math.max(state.image.width,state.image.height));}
async function refresh(){
  const version=++revision,opts=snapshot(),photo=state.image,button=byId('export');button.disabled=true;
  if(!opts){byId('output').textContent='宽高须为 1–10000 的整数，比例范围 1:10 至 10:1';return;}if(!photo)return;
  const area=byId('viewport'),width=Math.max(1,Math.min(area.clientWidth,area.clientHeight*opts.ratio)),height=width/opts.ratio;
  try{const logo=await Frame.logo(opts.brand,opts.variant);if(version!==revision)return;
    const canvas=byId('preview'),density=Math.min(2,window.devicePixelRatio||1),dims=Frame.dimensions(opts.ratio,Math.min(1800,Math.max(width,height)*density));
    [canvas.width,canvas.height]=dims;canvas.style.width=width+'px';canvas.style.height=height+'px';Frame.render(canvas,photo,opts,logo);
    byId('output').textContent=outSize(opts).join(' × ')+' px';button.disabled=state.busy||state.loading;
  }catch(error){say('预览失败，请更换照片或品牌重试。');console.error(error);}
}
for(const name of ['3:4','4:3','2:3','3:2','16:9','9:16','自定义']){const button=document.createElement('button');if(name==='自定义'){button.title='自定义比例';button.setAttribute('aria-label',button.title);button.innerHTML='<svg aria-hidden="true"><use href="#i-plus"/></svg>';}else button.textContent=name;button.setAttribute('aria-pressed',name===state.preset);button.onclick=()=>{state.preset=name;for(const item of byId('ratios').children)item.setAttribute('aria-pressed',item===button);byId('custom').hidden=name!=='自定义';refresh();};byId('ratios').append(button);}
for(const button of byId('styles').children)button.onclick=()=>{state.style=button.dataset.style;for(const item of byId('styles').children)item.setAttribute('aria-pressed',item===button);refresh();};
for(const button of byId('fit').children)button.onclick=()=>{state.fit=button.id;for(const item of byId('fit').children)item.setAttribute('aria-pressed',item===button);refresh();};
for(const id of ['format','rw','rh'])byId(id).oninput=refresh;
byId('size').oninput=()=>{
  const value=byId('size').value;
  if(value==='0')byId('size-face').innerHTML=icon('length');
  else byId('size-face').textContent=value+' px';
  refresh();
};
const fields={make:'相机厂商',model:'相机型号',focal:'焦距',aperture:'光圈',shutter:'快门',iso:'感光度'};
for(const [key,label] of Object.entries(fields)){const wrapper=document.createElement('label'),input=document.createElement('input');wrapper.textContent=label;input.id='field-'+key;input.maxLength=80;wrapper.append(input);byId('fields').append(wrapper);}
const toggle=document.createElement('label');toggle.className='model-toggle';toggle.innerHTML='<input type="checkbox" id="show-model"> 显示型号';byId('fields').after(toggle);
byId('edit').onclick=()=>{for(const key of Object.keys(fields))byId('field-'+key).value=state.meta[key];byId('show-model').checked=state.showModel;byId('meta-note').textContent=state.note;byId('editor').returnValue='';byId('editor').showModal();};byId('cancel').onclick=()=>byId('editor').close('cancel');
byId('editor').addEventListener('close',()=>{if(byId('editor').returnValue!=='apply')return;for(const key of Object.keys(fields))state.meta[key]=byId('field-'+key).value.trim();state.showModel=byId('show-model').checked;refresh();});
const files = [];
const rasterPattern = /[.](jpe?g|png|webp|bmp|avif|gif)$/i;
const rawExtensions = 'dng arw sr2 srf nef nrw cr2 cr3 crw raf orf rw2 pef srw 3fr fff iiq rwl erf mrw x3f'.split(' ');
const isRaw = file => rawExtensions.includes(file.name.split('.').pop().toLowerCase());
byId('picker').accept = ['jpg','jpeg','png','webp','bmp','avif','gif',...rawExtensions].map(ext=>'.'+ext).join(',');
let activeDecode;
let current = -1;
function supported(file) {return rasterPattern.test(file.name) || isRaw(file);}
async function decodePhoto(file,signal) {
  if(file.source && window.StudioPhone){
    const response=await fetch(file.source,{signal});
    if(!response.ok)throw Error('无法读取照片');
    file=new File([await response.blob()],file.name);
  }
  if(isRaw(file))return (await import("./raw.js")).decodeRaw(file,signal);
  const url = URL.createObjectURL(file);
  try {
    const [photo,tags] = await Promise.all([Frame.loadImage(url),exifr.parse(file,{gps:false}).catch(()=>null)]);
    return {photo,meta:Frame.metadata(tags || {})};
  } finally {URL.revokeObjectURL(url);}
}
async function showPhoto(index) {
  const entry = files[index];
  if (!entry) return;
  if (state.image && files[current]) files[current].edits = {
    meta:{...state.meta}, brand:selectedBrand, variant:selectedVariant, showModel:state.showModel
  };
  current=index;
  activeDecode?.abort();
  activeDecode=new AbortController();
  const serial=++importId;
  ++revision;
  state.image=null; state.loading=true;
  byId('queue').value=String(index);
  byId('file-name').textContent=entry.file.name;
  byId('file-info').textContent='读取中…';
  byId('preview').hidden=true; byId('empty').hidden=true;
  byId('output').textContent='';
  byId('edit').disabled=byId('export').disabled=true;
  try {
    const {photo,meta}=await decodePhoto(entry.file,activeDecode.signal);
    if (serial!==importId) return;
    const saved=entry.edits;
    state.image=photo;state.name=entry.file.name;state.meta=saved?.meta || meta;state.showModel=saved?.showModel || false;
    const hasExif=Object.values(meta).some(Boolean);
    state.note=hasExif?'':'无 EXIF，可手动填写。';
    byId('file-info').textContent=photo.width+' × '+photo.height+' px';
    chooseBrand(saved?.brand || Frame.identify(meta.make,meta.model),saved?.variant);
    byId('preview').hidden=false; byId('edit').disabled=false;
  } catch(error) {
    if(serial!==importId)return;
    byId('file-info').textContent='无法读取';
    byId('empty').hidden=false;
    say(isRaw(entry.file)?'RAW 解码失败：'+(error.message || '机型或压缩方式暂不支持'):'无法读取 '+entry.file.name+'，请检查文件或切换照片。');
  } finally {if(serial===importId){state.loading=false;refresh();}}
}
function addFiles(input) {
  const accepted=Array.from(input).filter(supported);
  if(!accepted.length){say('未找到支持的照片');return;}
  const start=files.length, options=document.createDocumentFragment();
  for(const file of accepted){
    const label=file.webkitRelativePath || file.name;
    options.append(new Option((files.length+1)+' · '+label,String(files.length)));
    files.push({file});
  }
  byId('queue').append(options);byId('queue').hidden=files.length<2;
  return showPhoto(start);
}
byId('open').onclick=byId('empty').onclick=()=>window.StudioPhone?StudioPhone.pick(false):byId('picker').click();
byId('folder').onclick=()=>window.StudioPhone?StudioPhone.pick(true):byId('directory').click();
byId('queue').onchange=()=>showPhoto(+byId('queue').value);
for(const id of ['picker','directory'])byId(id).onchange=event=>{if(event.target.files.length)addFiles(event.target.files);event.target.value='';};
window.addEventListener('dragover',event=>event.preventDefault());
window.addEventListener('drop',event=>{event.preventDefault();byId('stage').classList.remove('drag');if(event.dataTransfer.files.length)addFiles(event.dataTransfer.files);});
byId('stage').ondragover=()=>byId('stage').classList.add('drag');
byId('stage').ondragleave=event=>{if(!byId('stage').contains(event.relatedTarget))byId('stage').classList.remove('drag');};
window.addEventListener('keydown',event=>{if(event.ctrlKey&&event.key.toLowerCase()==='o'&&!byId('editor').open){event.preventDefault();byId('open').click();}});
async function savePhone(blob,name,png){
  if(!StudioPhone.begin())throw Error('已有导出任务');
  try{
    for(let offset=0;offset<blob.size;offset+=196608){
      const chunk=blob.slice(offset,offset+196608);
      const encoded=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.onerror=()=>reject(reader.error);
        reader.readAsDataURL(chunk);
      });
      if(!StudioPhone.append(encoded))throw Error('无法写入');
    }
    StudioPhone.save(name,png);
  }catch(error){StudioPhone.cancel();throw error;}
}
byId('export').onclick=async()=>{
  const opts=snapshot();if(!opts||!state.image||state.loading||state.busy)return;const image=state.image,name=state.name,[width,height]=outSize(opts);state.busy=true;byId('export').disabled=true;let canvas;
  try{const logo=await Frame.logo(opts.brand,opts.variant);canvas=Frame.surface(width,height);Frame.render(canvas,image,opts,logo);const jpeg=opts.format==='JPEG';const blob=await new Promise(resolve=>canvas.toBlob(resolve,jpeg?'image/jpeg':'image/png',.95));if(!blob)throw Error('encode');const filename=name.replace(/[.][^.]+$/,'')+'-'+opts.style+'-'+opts.ratioText.replace(':','x')+(jpeg?'.jpg':'.png');if(window.StudioPhone){await savePhone(blob,filename,!jpeg);return;}
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),120000);if(!window.chrome?.webview)say('已开始下载照片');}
  catch{say('导出失败，请选择较小的导出尺寸再试。');}finally{if(canvas){canvas.width=1;canvas.height=1;}state.busy=false;refresh();}
};
window.chrome?.webview?.addEventListener('message',event=>say(event.data));
new ResizeObserver(()=>refresh()).observe(byId('viewport'));
chooseBrand('sony');
