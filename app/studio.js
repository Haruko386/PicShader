'use strict';
const byId = id => document.getElementById(id);
const state = {style:'white',fit:'contain',preset:'3:2',meta:Frame.metadata(),image:null,name:'',note:'',showModel:false,busy:false,loading:false};
let importId=0, revision=0, toastTimer;
function say(text){const box=byId('toast');box.textContent=text;box.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('on'),3600);}
function selectOptions(select,items){select.replaceChildren(...items.map(([value,text])=>new Option(text,value)));}
selectOptions(byId('brand'),Object.entries(Frame.brands).map(([key,[name]])=>[key,name]));
function refreshVariants(){const styles=Frame.brands[byId('brand').value][1];selectOptions(byId('variant'),Object.keys(styles).map(key=>[key,Frame.labels[key]]));byId('variant').disabled=!Object.keys(styles).length;}
function snapshot(){
  const pair=state.preset==='自定义'?[byId('rw').valueAsNumber,byId('rh').valueAsNumber]:state.preset.split(':').map(Number);
  const ratio=pair[0]/pair[1];if(pair.some(value=>!Number.isInteger(value)||value<1||value>10000)||ratio<.1||ratio>10)return null;
  return {style:state.style,meta:{...state.meta},showModel:state.showModel,fit:state.fit,brand:byId('brand').value,variant:byId('variant').value,ratio,ratioText:pair.join(':'),format:byId('format').value};
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
byId('brand').onchange=()=>{refreshVariants();refresh();};for(const id of ['size','variant','format','rw','rh'])byId(id).oninput=refresh;
const fields={make:'相机厂商',model:'相机型号',focal:'焦距',aperture:'光圈',shutter:'快门',iso:'感光度'};
for(const [key,label] of Object.entries(fields)){const wrapper=document.createElement('label'),input=document.createElement('input');wrapper.textContent=label;input.id='field-'+key;input.maxLength=80;wrapper.append(input);byId('fields').append(wrapper);}
const toggle=document.createElement('label');toggle.className='model-toggle';toggle.innerHTML='<input type="checkbox" id="show-model"> 显示型号';byId('fields').after(toggle);
byId('edit').onclick=()=>{for(const key of Object.keys(fields))byId('field-'+key).value=state.meta[key];byId('show-model').checked=state.showModel;byId('meta-note').textContent=state.note;byId('editor').returnValue='';byId('editor').showModal();};byId('cancel').onclick=()=>byId('editor').close('cancel');
byId('editor').addEventListener('close',()=>{if(byId('editor').returnValue!=='apply')return;for(const key of Object.keys(fields))state.meta[key]=byId('field-'+key).value.trim();state.showModel=byId('show-model').checked;refresh();});
function setPhoto(photo,name,meta,demo,hasExif){state.image=photo;state.name=name;state.meta=meta;state.showModel=false;state.note=demo?'示例参数，非原始 EXIF。':hasExif?'':'无 EXIF，可手动填写。';byId('file-name').textContent=name;byId('file-info').textContent=photo.width+' × '+photo.height+' px  ·  '+(demo?'示例参数':hasExif?'EXIF':'无 EXIF');byId('brand').value=Frame.identify(meta.make,meta.model);refreshVariants();refresh();}
async function openPhoto(file){
  if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)&&!(/[.](jpe?g|png|webp)$/i.test(file.name)&&!file.type)){say('请选择 JPEG、PNG 或 WebP 照片');return;}
  if(file.size>100*1024*1024){say('请选择小于 100 MB 的照片');return;}
  const serial=++importId,url=URL.createObjectURL(file);state.loading=true;byId('export').disabled=true;byId('stage').setAttribute('aria-busy','true');
  try{const [photo,tags]=await Promise.all([Frame.loadImage(url),exifr.parse(file,{gps:false}).catch(()=>null)]);if(serial!==importId)return;const meta=Frame.metadata(tags || {});setPhoto(photo,file.name,meta,false,Object.values(meta).some(Boolean));}
  catch{if(serial===importId)say('无法打开这张照片，请检查文件是否损坏。');}
  finally{URL.revokeObjectURL(url);if(serial===importId){state.loading=false;byId('stage').removeAttribute('aria-busy');refresh();}}
}
byId('open').onclick=()=>byId('picker').click();byId('picker').onchange=event=>{openPhoto(event.target.files[0]);event.target.value='';};
window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>{event.preventDefault();byId('stage').classList.remove('drag');if(event.dataTransfer.files.length)openPhoto(event.dataTransfer.files[0]);});byId('stage').ondragover=()=>byId('stage').classList.add('drag');byId('stage').ondragleave=event=>{if(!byId('stage').contains(event.relatedTarget))byId('stage').classList.remove('drag');};
window.addEventListener('keydown',event=>{if(event.ctrlKey&&event.key.toLowerCase()==='o'&&!byId('editor').open){event.preventDefault();byId('picker').click();}});
byId('export').onclick=async()=>{
  const opts=snapshot();if(!opts||!state.image||state.loading||state.busy)return;const image=state.image,name=state.name,[width,height]=outSize(opts);state.busy=true;byId('export').disabled=true;let canvas;
  try{const logo=await Frame.logo(opts.brand,opts.variant);canvas=Frame.surface(width,height);Frame.render(canvas,image,opts,logo);const jpeg=opts.format==='JPEG';const blob=await new Promise(resolve=>canvas.toBlob(resolve,jpeg?'image/jpeg':'image/png',.95));if(!blob)throw Error('encode');const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name.replace(/[.][^.]+$/,'')+'-'+opts.style+'-'+opts.ratioText.replace(':','x')+(jpeg?'.jpg':'.png');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),120000);if(!window.chrome?.webview)say('已开始下载照片');}
  catch{say('导出失败，请选择较小的导出尺寸再试。');}finally{if(canvas){canvas.width=1;canvas.height=1;}state.busy=false;refresh();}
};
window.chrome?.webview?.addEventListener('message',event=>say(event.data));
new ResizeObserver(()=>refresh()).observe(byId('viewport'));
refreshVariants();Frame.loadImage('assets/wild-goose-island.jpg').then(photo=>{if(!importId)setPhoto(photo,'圣玛丽湖 · 野鹅岛',{make:'Nikon',model:'Nikon Z 6',focal:'35mm',aperture:'F8',shutter:'1/250s',iso:'ISO100'},true,false);}).catch(()=>say('可点击「打开照片」开始编辑。'));
