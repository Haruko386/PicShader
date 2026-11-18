import LibRaw from './vendor/libraw/index.js';

export async function decodeRaw(file, signal) {
  signal.throwIfAborted();
  if (!crossOriginIsolated) throw new Error('需要在桌面版或启用跨源隔离的本地服务中打开');
  const decoder = new LibRaw();
  const stop = () => decoder.dispose();
  signal.addEventListener('abort', stop, {once:true});
  decoder.worker.addEventListener('error', stop, {once:true});
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    await decoder.open(bytes, {useCameraWb:true, outputColor:1, outputBps:8, halfSize:false});
    const info = await decoder.metadata();
    if (!info || !info.width || !info.height) throw new Error('无法识别机型');
    if (info.width * info.height > 120e6) throw new Error('超过 1.2 亿像素');
    const pixels = await decoder.imageData();
    if (!pixels || pixels.bits !== 8 || ![1,3].includes(pixels.colors) ||
        pixels.data.length !== pixels.width * pixels.height * pixels.colors) throw new Error('不支持的像素格式');
    const photo = Frame.surface(pixels.width,pixels.height);
    const brush = photo.getContext('2d',{alpha:false});
    const bandHeight = 64;
    const band = brush.createImageData(photo.width,bandHeight);
    for (let row=0; row<photo.height; row+=bandHeight) {
      const rows=Math.min(bandHeight,photo.height-row);
      let source=row*photo.width*pixels.colors;
      for (let dest=0;dest<rows*photo.width*4;dest+=4) {
        band.data[dest]=pixels.data[source];
        band.data[dest+1]=pixels.data[source+(pixels.colors===3?1:0)];
        band.data[dest+2]=pixels.data[source+(pixels.colors===3?2:0)];
        band.data[dest+3]=255;
        source+=pixels.colors;
      }
      brush.putImageData(band,0,row,0,0,photo.width,rows);
    }
    return {photo,meta:Frame.metadata({Make:info.camera_make,Model:info.camera_model,
      ISO:info.iso_speed,ExposureTime:info.shutter,FNumber:info.aperture,FocalLength:info.focal_len})};
  } finally {
    signal.removeEventListener('abort',stop);
    stop();
  }
}
