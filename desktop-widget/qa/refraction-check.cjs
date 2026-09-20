const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..')] });
  app.process().on('exit',(code,signal)=>console.log('Electron exit',code,signal));
  try {
    const page = await app.firstWindow();
    await page.waitForURL('http://127.0.0.1:4444/**');
    await page.locator('#newsnow-glass-canvas[data-ready="true"]').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#app main ol.grid > li').first().innerText().then(t => t.includes('36氪')), true);
    const synthetic = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      // Known high-contrast desktop texture isolates refraction from a mere
      // translucent tint. Hide only foreground text; preserve lens layout.
      await w.webContents.insertCSS('#app, #newsnow-desktop-bar { opacity: 0 !important; }');
      const width = 1600, height = 1200;
      const pixels = new Uint8Array(width * height * 4);
      for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
        const i=(y*width+x)*4, value = Math.floor(x/12)%2 ? 220 : 35;
        pixels.set([value,value,value,255],i);
      }
      w.webContents.send('widget:glass-frame', {
        icons:{rect:{x:0,y:0,width,height},pixels},
        geometry:{rect:{x:200,y:200,width:w.getBounds().width*2,height:w.getBounds().height*2},display:{x:0,y:0,width,height},scale:2},
      });
      return { origin:200 };
    });
    await page.waitForTimeout(200);
    const data = await app.evaluate(async ({BrowserWindow}) => {
      const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
      return {size:image.getSize(),png:image.toPNG().toString('base64'),pixels:image.toBitmap().toString('base64')};
    });
    fs.writeFileSync(path.join(__dirname,'refraction-stripes.png'),Buffer.from(data.png,'base64'));
    const pixels=Buffer.from(data.pixels,'base64'), {width,height}=data.size;
    const y=90; // Above news panels and below the toolbar, isolating outer lens.
    let edgeShift=0, centerStable=0;
    for(let x=8;x<60;x++) {
      const raw=Math.floor((synthetic.origin+x)/12)%2 ? 220:35;
      const actual=pixels[(y*width+x)*4];
      if(Math.abs(raw-actual)>80)edgeShift++;
    }
    for(let x=Math.floor(width*.4);x<Math.floor(width*.6);x++) {
      const raw=Math.floor((synthetic.origin+x)/12)%2 ? 220:35;
      const actual=pixels[(y*width+x)*4];
      if(Math.abs(raw-actual)<65)centerStable++;
    }
    assert(edgeShift>8, `Edge must displace actual desktop stripes (${edgeShift})`);
    assert(centerStable>width*.12, `Center must retain recognizable background (${centerStable})`);
    console.log({edgeShift,centerStable,width,height});
    await page.reload();
    await page.locator('#newsnow-glass-canvas[data-ready="true"]').waitFor();
    await page.waitForTimeout(300);
    const screenshot=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(__dirname,'refraction-internal.png'),Buffer.from(screenshot,'base64'));
    const initial=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    try {
      console.log('Moving onto desktop icons');
      await app.evaluate(({BrowserWindow,app,screen})=>{
        const w=BrowserWindow.getAllWindows()[0];
        const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main.cjs');
        req('./desktop-host.cjs').attachDesktop(w).setBounds(screen.dipToScreenRect(w,{x:680,y:50,width:433,height:560}));
      });
      await page.waitForFunction(()=>innerHeight===560);
      await page.waitForTimeout(300);
      const overIcons=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
      fs.writeFileSync(path.join(__dirname,'refraction-over-icons.png'),Buffer.from(overIcons,'base64'));
      // Main-world news scripts must not get our IPC subscription API.
      assert.equal(await page.evaluate(()=>typeof window.desktopGlass),'undefined');
    } catch(error) {
      console.error('Icon preview failed',error);
      throw error;
    } finally {
      await app.evaluate(({BrowserWindow,app,screen},bounds)=>{
        const w=BrowserWindow.getAllWindows()[0];
        const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main.cjs');
        req('./desktop-host.cjs').attachDesktop(w).setBounds(screen.dipToScreenRect(w,bounds));
      },initial);
    }
  } finally { await app.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
