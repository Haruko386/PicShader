'use strict';
const Frame = (() => {
  const surface = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
  const labels = { word: '品牌字标', icon: '图形标志', petals: '花瓣标志', badge: '黄色方标', text: '纯文字' };
  const brands = {
    sony: ['SONY', { word: 'sony.svg' }], nikon: ['Nikon', { word: 'nikon.svg', badge: 'nikon-badge.svg' }],
    huawei: ['HUAWEI', { word: 'huawei-word.png', petals: 'huawei-petals.png' }], canon: ['Canon', { word: 'canon.svg' }],
    fujifilm: ['FUJIFILM', { word: 'fujifilm.svg' }], leica: ['Leica', { icon: 'leica.svg', text: null }],
    dji: ['DJI', { word: 'dji.svg' }], apple: ['Apple', { icon: 'apple.svg', text: null }], xiaomi: ['Xiaomi', { icon: 'xiaomi.svg', text: null }],
    panasonic: ['Panasonic', { word: 'panasonic.svg' }], samsung: ['SAMSUNG', { word: 'samsung.svg' }], oppo: ['OPPO', { word: 'oppo.svg' }], vivo: ['vivo', { word: 'vivo.svg' }],
    other: ['其他品牌', { text: null }], none: ['不显示', {}]
  };
  function identify(make, model) {
    const source = [make, model].join(' ').toLowerCase();
    return Object.keys(brands).find(key => source.includes(key)) || (/iphone|ipad/.test(source) ? 'apple' : make ? 'other' : 'none');
  }
  function metadata(tags = {}) {
    const number = value => Number.isFinite(+value) && +value > 0 ? +(+value).toFixed(3) : 0;
    const exposure = number(tags.ExposureTime), focus = number(tags.FocalLength), aperture = number(tags.FNumber);
    const iso = number(tags.ISO ?? tags.ISOSpeedRatings);
    const reciprocal = 1 / tags.ExposureTime;
    const fractional = tags.ExposureTime > 0 && tags.ExposureTime < 1 && Math.abs(Math.round(reciprocal) - reciprocal) <= reciprocal * .01;
    const shutter = fractional ? '1/' + Math.round(reciprocal) + 's' : exposure ? exposure + 's' : '';
    return { make: String(tags.Make || '').trim(), model: String(tags.Model || '').trim(), focal: focus ? focus + 'mm' : '', aperture: aperture ? 'F' + aperture : '', shutter, iso: iso ? 'ISO' + iso : '' };
  }
  function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取图像')); image.src = src; }); }
  const logoCache = new Map();
  async function prepareLogo(file) {
    const image = await loadImage('assets/logos/' + file);
    const full = surface(768, Math.max(1, Math.round(768 * image.naturalHeight / image.naturalWidth)));
    const brush = full.getContext('2d', { willReadFrequently: true }); brush.drawImage(image, 0, 0, full.width, full.height);
    const pixels = brush.getImageData(0, 0, full.width, full.height).data;
    let left = full.width, top = full.height, right = 0, bottom = 0;
    for (let row = 0; row < full.height; row++) for (let col = 0; col < full.width; col++) if (pixels[(row * full.width + col) * 4 + 3] > 8) { left = Math.min(left, col); top = Math.min(top, row); right = Math.max(right, col); bottom = Math.max(bottom, row); }
    const color = surface(right - left + 1, bottom - top + 1); color.getContext('2d').drawImage(full, -left, -top);
    const white = surface(color.width, color.height), tint = white.getContext('2d'); tint.drawImage(color, 0, 0); tint.globalCompositeOperation = 'source-in'; tint.fillStyle = 'white'; tint.fillRect(0, 0, white.width, white.height);
    return { color, white };
  }
  function logo(brand, variant) {
    const file = brands[brand][1][variant]; if (!file) return Promise.resolve(null);
    if (!logoCache.has(file)) logoCache.set(file, prepareLogo(file).catch(error => { logoCache.delete(file); throw error; }));
    return logoCache.get(file);
  }
  function dimensions(ratio, longEdge) {
    const limit = Math.min(8192, longEdge, Math.sqrt(32e6 * Math.max(ratio, 1 / ratio)));
    return [Math.max(1, Math.round(ratio >= 1 ? limit : limit * ratio)), Math.max(1, Math.round(ratio >= 1 ? limit / ratio : limit))];
  }
  function cover(context, image, left, top, width, height) {
    const scale = Math.max(width / image.width, height / image.height), sw = width / scale, sh = height / scale;
    context.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, left, top, width, height);
  }
  const backgrounds = new WeakMap();
  function backdrop(image, ratio) {
    const cached = backgrounds.get(image); if (cached && cached.ratio === ratio) return cached.canvas;
    const [width, height] = dimensions(ratio, 680), canvas = surface(width, height), ctx = canvas.getContext('2d');
    const radius = Math.max(2, Math.min(width, height) * .03), extra = radius * 3;
    ctx.fillStyle = '#383c35'; ctx.fillRect(0, 0, width, height); ctx.filter = 'blur(' + radius + 'px)'; cover(ctx, image, -extra, -extra, width + extra * 2, height + extra * 2); ctx.filter = 'none';
    ctx.fillStyle = 'rgba(12,16,12,.25)'; ctx.fillRect(0, 0, width, height); backgrounds.set(image, { ratio, canvas }); return canvas;
  }
  function render(canvas, image, options, logoSet) {
    const width = canvas.width, height = canvas.height, short = Math.min(width, height), ctx = canvas.getContext('2d', { alpha: false });
    const blur = options.style === 'blur', pad = short * (blur ? .059 : .024), meta = options.meta;
    const specs = [meta.focal, meta.aperture, meta.shutter, meta.iso].filter(Boolean).join('  ');
    const title = options.brand === 'none' ? '' : options.brand === 'other' ? meta.make : brands[options.brand][0];
    const model = options.showModel ? meta.model : '';
    const logoHeight = short * (options.variant === 'badge' || options.variant === 'icon' || options.variant === 'petals' ? .057 : .032);
    const textSize = short * .021, gap = short * .013, infoH = (title ? logoHeight + gap : 0) + (model ? textSize + gap * .5 : 0) + (specs ? textSize : 0);
    const after = infoH ? short * .032 : 0, maxW = width - pad * 2, maxH = height - pad * 2 - infoH - after;
    const scale = Math.min(maxW / image.width, maxH / image.height), pw = options.fit === 'cover' ? maxW : image.width * scale, ph = options.fit === 'cover' ? maxH : image.height * scale;
    const left = (width - pw) / 2, top = (height - ph - infoH - after) / 2;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingQuality = 'high';
    if (blur) { ctx.drawImage(backdrop(image, options.ratio), 0, 0, width, height); ctx.save(); ctx.shadowColor = '#0007'; ctx.shadowBlur = short * .025; ctx.shadowOffsetY = short * .009; ctx.fillStyle = '#30332e'; ctx.beginPath(); ctx.roundRect(left, top, pw, ph, short * .025); ctx.fill(); ctx.restore(); }
    ctx.save(); if (blur) { ctx.beginPath(); ctx.roundRect(left, top, pw, ph, short * .025); ctx.clip(); }
    ctx.fillStyle = 'white'; ctx.fillRect(left, top, pw, ph); if (options.fit === 'cover') cover(ctx, image, left, top, pw, ph); else ctx.drawImage(image, left, top, pw, ph); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = blur ? '#fff' : '#151815'; let cursor = top + ph + after;
    if (title) { if (logoSet) { const mark = blur && !['badge', 'petals'].includes(options.variant) ? logoSet.white : logoSet.color; const fit = Math.min(logoHeight / mark.height, maxW * .72 / mark.width); ctx.drawImage(mark, (width - mark.width * fit) / 2, cursor + (logoHeight - mark.height * fit) / 2, mark.width * fit, mark.height * fit); } else { ctx.font = '700 ' + logoHeight + 'px "Segoe UI", sans-serif'; ctx.fillText(title, width / 2, cursor + logoHeight * .5, maxW); } cursor += logoHeight + gap; }
    ctx.font = textSize + 'px "Segoe UI", "Microsoft YaHei UI", sans-serif'; if (blur) { ctx.shadowColor = '#000a'; ctx.shadowBlur = short * .004; } else ctx.fillStyle = '#4c514e';
    if (model) { ctx.fillText(model, width / 2, cursor + textSize * .5, maxW); cursor += textSize + gap * .5; } if (specs) ctx.fillText(specs, width / 2, cursor + textSize * .5, maxW); ctx.shadowBlur = 0;
  }
  return { brands, labels, identify, metadata, loadImage, logo, dimensions, render, surface };
})();
