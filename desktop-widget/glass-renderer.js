// Runs in an isolated, sandboxed renderer world. No Node or screen-capture API
// is exposed to the news page; only the restricted desktop texture feed.
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'newsnow-glass-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const fail = error => {
    document.documentElement.classList.remove('desktop-refraction');
    canvas.dataset.ready = 'false';
    desktopGlass.error(String(error));
  };
  try {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL unavailable; keeping transparent CSS fallback');
    const vertex = `attribute vec2 position; varying vec2 uv;
      void main(){uv=vec2((position.x+1.0)*.5,(1.0-position.y)*.5);gl_Position=vec4(position,0,1);}`;
    const fragment = `precision highp float;
      varying vec2 uv;
      uniform sampler2D wallpaper, icons;
      uniform vec2 size;
      uniform vec4 windowRect, iconRect, wallRect;
      uniform vec3 desktopColor;
      uniform float scale, tiled;
      uniform vec4 panels[8];
      uniform int panelCount;
      float sdf(vec2 p,vec4 r,float radius){
        vec2 q=abs(p-r.xy-r.zw*.5)-(r.zw*.5-vec2(radius));
        return length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
      }
      vec3 scene(vec2 p){
        vec2 point=windowRect.xy+p*scale;
        vec2 w=(point-wallRect.xy)/wallRect.zw;
        vec3 bg=desktopColor;
        if(tiled>.5)bg=texture2D(wallpaper,fract(w)).rgb;
        else if(min(w.x,w.y)>=0.0 && max(w.x,w.y)<=1.0)bg=texture2D(wallpaper,w).rgb;
        vec2 i=(point-iconRect.xy)/iconRect.zw;
        if(min(i.x,i.y)>=0.0 && max(i.x,i.y)<=1.0){
          vec4 icon=texture2D(icons,i);
          bg=icon.rgb+bg*(1.0-icon.a);
        }
        return bg;
      }
      // A rounded glass bevel gives a surface normal. Snell's law (GLSL
      // refract) determines the ray's lateral displacement through its depth.
      vec2 lens(vec2 p,vec4 rect,float radius,float bevel,float depth,out float shine){
        float d=sdf(p,rect,radius);
        float slope=1.0-clamp(-d/bevel,0.0,1.0);
        vec2 n=vec2(sdf(p+vec2(.2,0),rect,radius)-sdf(p-vec2(.2,0),rect,radius),
          sdf(p+vec2(0,.2),rect,radius)-sdf(p-vec2(0,.2),rect,radius));
        n=length(n)>.0001?normalize(n):vec2(0,1);
        float z=sqrt(max(.0001,1.0-slope*slope));
        vec3 ray=refract(vec3(0,0,-1),vec3(n*slope,z),1.0/1.46);
        float fresnel=.035+.965*pow(1.0-z,5.0);
        float light=dot(n,normalize(vec2(-.65,-.76)));
        shine=fresnel*.3+pow(slope,9.0)*light*.2;
        return ray.xy/max(.1,-ray.z)*depth;
      }
      void main(){
        vec2 p=uv*size;
        vec4 outer=vec4(0,0,size);
        float distance=sdf(p,outer,24.0);
        float alpha=1.0-smoothstep(-.7,.4,distance);
        if(alpha<.001){gl_FragColor=vec4(0);return;}
        float shine;
        vec2 offset=lens(p,outer,24.0,27.0,42.0,shine);
        float panelShade=0.0;
        for(int i=0;i<8;i++){
          if(i>=panelCount)break;
          float d=sdf(p,panels[i],17.0);
          if(d<0.0 && p.y>37.0){
            float s;
            offset+=lens(p,panels[i],17.0,21.0,31.0,s);
            shine+=s;
            panelShade=.035;
            break;
          }
        }
        // Small dispersion, strongest at curved edges and absent at the center.
        vec3 rgb=vec3(scene(p+offset*.987).r,scene(p+offset).g,scene(p+offset*1.013).b);
        rgb=rgb*(.90-panelShade)+vec3(shine);
        gl_FragColor=vec4(clamp(rgb,0.0,1.0)*alpha,alpha);
      }`;
    function compile(type, source) {
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program=gl.createProgram(), vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const uniforms={};
    for(const key of ['wallpaper','icons','size','windowRect','iconRect','wallRect','desktopColor','scale','tiled','panels[0]','panelCount'])uniforms[key]=gl.getUniformLocation(program,key);
    function texture(unit){
      const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
      return t;
    }
    const wallTexture=texture(0), iconTexture=texture(1);
    gl.uniform1i(uniforms.wallpaper,0);gl.uniform1i(uniforms.icons,1);
    let geometry, iconBounds, wall, wallSize={width:1,height:1}, wallLoaded=false, queued=false, stopped=false;
    const box=r=>[r.x,r.y,r.width,r.height];
    function schedule(){if(!queued&&!stopped){queued=true;requestAnimationFrame(draw);}}
    function draw(){
      queued=false;
      if(!geometry||!iconBounds||!wallLoaded||stopped)return;
      const width=innerWidth,height=innerHeight,dpr=devicePixelRatio;
      const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
      if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
      gl.viewport(0,0,pixelWidth,pixelHeight);
      gl.uniform2f(uniforms.size,width,height);gl.uniform4fv(uniforms.windowRect,box(geometry.rect));
      gl.uniform4fv(uniforms.iconRect,box(iconBounds));gl.uniform1f(uniforms.scale,geometry.rect.width/width);
      const display=wall.style==='22'?iconBounds:geometry.display;
      let w=wallSize.width,h=wallSize.height;
      if(!wall.tile){
        if(wall.style==='2'){w=display.width;h=display.height;}
        else if(['6','10','22'].includes(wall.style)){
          const fit=wall.style==='6'?Math.min:Math.max;
          const ratio=fit(display.width/w,display.height/h);w*=ratio;h*=ratio;
        }
      }
      gl.uniform4f(uniforms.wallRect,display.x+(wall.tile?0:(display.width-w)/2),display.y+(wall.tile?0:(display.height-h)/2),w,h);
      gl.uniform1f(uniforms.tiled,wall.tile?1:0);gl.uniform3fv(uniforms.desktopColor,wall.color.map(c=>c/255));
      const panels=[...document.querySelectorAll('#app main ol.grid > li > div')].map(e=>e.getBoundingClientRect()).filter(r=>r.bottom>37&&r.top<height&&r.width>0).slice(0,8);
      const values=new Float32Array(32);panels.forEach((r,i)=>values.set([r.x,r.y,r.width,r.height],i*4));
      gl.uniform4fv(uniforms['panels[0]'],values);gl.uniform1i(uniforms.panelCount,panels.length);
      gl.drawArrays(gl.TRIANGLES,0,6);
      const error=gl.getError();if(error!==gl.NO_ERROR){fail(`WebGL draw error ${error}`);stopped=true;return;}
      canvas.dataset.ready='true';document.documentElement.classList.add('desktop-refraction');
    }
    const unsubscribe=desktopGlass.subscribe(frame=>{
      try {
        if(frame.geometry)geometry=frame.geometry;
        if(frame.icons){
          iconBounds=frame.icons.rect;
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,iconTexture);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,iconBounds.width,iconBounds.height,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(frame.icons.pixels));
        }
        if(frame.wallpaper){
          wall=frame.wallpaper;wallLoaded=false;
          if(wall.dataURL){
            const image=new Image(), key=wall.key;
            image.onload=()=>{
              if(stopped||wall.key!==key)return;
              wallSize={width:image.naturalWidth,height:image.naturalHeight};
              gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,wallTexture);
              gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
              wallLoaded=true;schedule();
            };
            image.onerror=()=>fail('Wallpaper image could not be decoded');image.src=wall.dataURL;
          }else{
            gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,wallTexture);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([...wall.color,255]));
            wallLoaded=true;
          }
        }
        schedule();
      }catch(error){fail(error);}
    });
    const observer=new MutationObserver(schedule);
    observer.observe(document.getElementById('app'),{childList:true,subtree:true});
    const resize=new ResizeObserver(schedule);resize.observe(document.documentElement);
    document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopped=true;fail('Graphics context lost; refresh the card to restore refraction');});
    window.addEventListener('pagehide',()=>{stopped=true;unsubscribe();observer.disconnect();resize.disconnect();gl.deleteTexture(wallTexture);gl.deleteTexture(iconTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);},{once:true});
    desktopGlass.ready();
  }catch(error){fail(error);}
})();
