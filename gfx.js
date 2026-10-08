'use strict';
// WebGL2 post-processing: kaleidoscope plasma background, hue-rotating feedback
// trails, mip-chain bloom and chromatic aberration over the 2D game layer.
const GFX = (() => {
  let gl = null, progFeedback, progFinal, texGame;
  let targets = [], ping = 0, W = 1, H = 1, FW = 1, FH = 1;

  const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const HUE = `
vec3 hueRot(vec3 c, float h) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  float a = h * 6.2831853, cs = cos(a), sn = sin(a);
  yiq.yz = vec2(yiq.y * cs - yiq.z * sn, yiq.y * sn + yiq.z * cs);
  return clamp(toRGB * yiq, 0.0, 1.0);
}`;

  const FEEDBACK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPrev;
uniform sampler2D uGame;
uniform float uTime, uInt, uBeat, uDecay, uAspect, uSpeed, uDrop;
${HUE}
void main() {
  float I = min(uInt, 1.6);
  vec2 c = vUv - 0.5;
  c.x *= uAspect;
  float a = 0.0015 + 0.006 * I + 0.012 * uBeat * I + 0.014 * uDrop;
  float z = 0.994 - 0.012 * I - 0.012 * uBeat * I - 0.014 * uSpeed - 0.016 * uDrop;
  c = mat2(cos(a), sin(a), -sin(a), cos(a)) * c * z;
  c.x /= uAspect;
  c += 0.003 * I * vec2(sin(vUv.y * 13.0 + uTime * 1.7), cos(vUv.x * 11.0 - uTime * 1.3));
  vec3 prev = texture(uPrev, c + 0.5).rgb;
  prev = max(hueRot(prev, 0.008 + 0.02 * I) * uDecay - 0.006, 0.0);
  vec3 g = texture(uGame, vUv).rgb;
  o = vec4(max(prev, g), 1.0);
}`;

  const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uGame;
uniform sampler2D uTrail;
uniform vec2 uRes;
uniform vec4 uBoard;
uniform vec2 uShake;
uniform float uCell, uTime, uInt, uBeat, uPulse, uTrip, uHue, uFlash, uSpeed, uDrop, uInvert, uShock, uBuild;
uniform vec2 uZoom;
uniform float uAim;
uniform vec3 uGrav[4];

// gravitational lensing around the wells: pixels sample from closer to the center
vec2 lens(vec2 fc) {
  vec2 off = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    if (uGrav[i].z <= 0.0) continue;
    vec2 dv = fc - uGrav[i].xy;
    float r = length(dv) + 1.0;
    float R0 = uCell * 1.3;
    off += dv / r * min(r * 0.9, uGrav[i].z * R0 * R0 / r);
  }
  return off;
}

vec3 bloomAt(vec2 uv, float lod) {
  vec2 px = exp2(lod) / vec2(textureSize(uGame, 0));
  return (textureLod(uGame, uv + vec2(px.x, 0.0), lod) + textureLod(uGame, uv - vec2(px.x, 0.0), lod) +
          textureLod(uGame, uv + vec2(0.0, px.y), lod) + textureLod(uGame, uv - vec2(0.0, px.y), lod)).rgb * 0.25;
}

vec3 pal(float t) { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }

vec3 background(vec2 fc, float I) {
  vec2 p = (fc - 0.5 * uRes) / uRes.y;
  float t = uTime * (0.6 + 0.8 * I) * (0.7 + 0.8 * uSpeed);
  p *= 1.0 - 0.06 * uBeat;
  float r = length(p);
  float seg = 6.2831853 / (8.0 + 8.0 * uDrop);
  float ang = atan(p.y, p.x) + t * 0.08;
  ang = mod(ang, seg);
  ang = abs(ang - seg * 0.5);
  vec2 q = r * vec2(cos(ang), sin(ang));
  q += 0.15 * vec2(sin(t * 0.21), cos(t * 0.17));
  float v = sin(q.x * 10.0 + t) + sin(q.y * 12.0 - t * 1.3) + sin((q.x + q.y) * 8.0 + t * 0.7);
  v += sin(r * 16.0 - t * 2.2) * (0.6 + I);
  v += 0.8 * sin(length(q - 0.5 * vec2(sin(t * 0.33), cos(t * 0.41))) * 14.0 - t);
  vec3 col = pal(v * 0.11 + uHue + r * 0.35);
  return col * (0.12 + 0.3 * I + 0.1 * uBeat * I) * (1.0 + 0.7 * uDrop) * (1.0 - 0.45 * uBuild);
}

void main() {
  vec2 fc0 = gl_FragCoord.xy;
  vec2 fc = fc0 - lens(fc0);
  vec2 uv = fc / uRes;
  float I = min(uInt, 1.6);
  vec2 warp = vec2(sin(uv.y * 9.0 + uTime * 2.3), cos(uv.x * 7.0 - uTime * 1.9)) * (0.0035 * uTrip + 0.0006 * I);

  // drop shockwave: a refracting ring racing out from the center
  vec2 sd = uv - 0.5;
  sd.x *= uRes.x / uRes.y;
  float sr = length(sd);
  float sw = exp(-pow((sr - uShock * 1.4) * 14.0, 2.0)) * max(0.0, 1.0 - uShock / 1.2);
  vec2 shockOff = (sr > 0.0001 ? sd / sr : vec2(0.0)) * sw * 0.035;
  warp += shockOff;

  // glitch tearing of the background during a drop
  float sl = floor(uv.y * 30.0);
  float gh = fract(sin(sl * 91.7 + floor(uTime * 14.0) * 13.3) * 43758.5);
  float tear = (gh - 0.5) * 0.08 * uDrop * step(0.75, gh);
  vec3 bg = background(fc + (warp + vec2(tear, 0.0)) * uRes * 4.0, I);

  vec2 c0 = uBoard.xy + uBoard.zw * 0.5;
  vec2 bp = (fc - uShake - c0) / uZoom + c0 - uBoard.xy;
  float inside = step(0.0, bp.x) * step(0.0, bp.y) * step(bp.x, uBoard.z) * step(bp.y, uBoard.w);
  if (inside > 0.5) {
    vec2 gc = bp / uCell;
    float chk = mod(floor(gc.x) + floor(gc.y), 2.0);
    bg *= 0.28 + 0.06 * chk;
    vec2 f = abs(fract(gc) - 0.5);
    float line = smoothstep(0.46, 0.5, max(f.x, f.y));
    bg += pal(uHue + (gc.x + gc.y) * 0.02 + uTime * 0.05) * line * (0.1 + 0.25 * uBeat + 0.2 * uDrop);
  }

  vec2 guv = uv + warp;
  vec2 d = uv - 0.5;
  float ca = 0.0012 + 0.0035 * I + 0.012 * uPulse + 0.006 * uTrip + 0.008 * uBuild + 0.006 * uDrop;
  vec4 g = texture(uGame, guv);
  float gr = texture(uGame, guv + d * ca).r;
  float gb = texture(uGame, guv - d * ca).b;
  vec3 game = vec3(gr, g.g, gb);
  vec3 bloom = bloomAt(guv, 3.0) * 0.8 + bloomAt(guv, 5.0) * 1.4 + textureLod(uGame, guv, 6.5).rgb;
  vec3 trail = texture(uTrail, guv).rgb;
  float trailAmt = mix(0.75, 0.45, inside) * (0.5 + 0.5 * min(I, 1.0));

  vec3 col = bg + trail * trailAmt + bloom * (0.5 + 0.35 * I);
  col = col * (1.0 - g.a) + game;
  col += uFlash * vec3(1.0, 0.9, 1.0) * 0.8;
  col += sw * 0.35 * pal(uHue + sr * 2.0);
  col = mix(col, vec3(1.0) - clamp(col, 0.0, 1.0), uInvert);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(0.7, 0.85, 1.0), 0.65 * uAim);
  col *= 1.0 - (0.45 + 0.45 * uBuild) * pow(length(d) * 1.25, 2.5 - uBuild);
  col *= 0.96 + 0.04 * sin(fc.y * 3.14159);
  o = vec4(col, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  function setf(prog, name, ...v) {
    const loc = prog.u[name];
    if (loc == null) return;
    if (v.length === 1) gl.uniform1f(loc, v[0]);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
  }

  function setv3(prog, name, arr) {
    const loc = prog.u[name];
    if (loc != null) gl.uniform3fv(loc, arr);
  }

  function seti(prog, name, v) {
    const loc = prog.u[name];
    if (loc != null) gl.uniform1i(loc, v);
  }

  function texParams(minFilter) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    texParams(gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  }

  function init(canvas) {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    progFeedback = program(FEEDBACK_FS);
    progFinal = program(FINAL_FS);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    texGame = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texGame);
    texParams(gl.LINEAR_MIPMAP_LINEAR);
    return true;
  }

  function resize(w, h) {
    if (!gl) return;
    W = Math.max(1, w);
    H = Math.max(1, h);
    FW = Math.max(1, W >> 1);
    FH = Math.max(1, H >> 1);
    for (const t of targets) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    }
    targets = [makeTarget(FW, FH), makeTarget(FW, FH)];
    ping = 0;
  }

  // src: the 2D game canvas; U: per-frame uniforms
  function render(src, U) {
    if (!gl || gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texGame);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);

    const prev = targets[ping], next = targets[1 - ping];

    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fb);
    gl.viewport(0, 0, FW, FH);
    gl.useProgram(progFeedback.p);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    seti(progFeedback, 'uGame', 0);
    seti(progFeedback, 'uPrev', 1);
    setf(progFeedback, 'uTime', U.time);
    setf(progFeedback, 'uInt', U.int);
    setf(progFeedback, 'uBeat', U.beat);
    setf(progFeedback, 'uDecay', U.decay);
    setf(progFeedback, 'uAspect', FW / FH);
    setf(progFeedback, 'uSpeed', U.speed);
    setf(progFeedback, 'uDrop', U.drop);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(progFinal.p);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, next.tex);
    seti(progFinal, 'uGame', 0);
    seti(progFinal, 'uTrail', 1);
    setf(progFinal, 'uRes', W, H);
    setf(progFinal, 'uBoard', U.board[0], U.board[1], U.board[2], U.board[3]);
    setf(progFinal, 'uShake', U.shake[0], U.shake[1]);
    setf(progFinal, 'uCell', U.cell);
    setf(progFinal, 'uTime', U.time);
    setf(progFinal, 'uInt', U.int);
    setf(progFinal, 'uBeat', U.beat);
    setf(progFinal, 'uPulse', U.pulse);
    setf(progFinal, 'uTrip', U.trip);
    setf(progFinal, 'uHue', U.hue);
    setf(progFinal, 'uFlash', U.flash);
    setf(progFinal, 'uSpeed', U.speed);
    setf(progFinal, 'uZoom', U.zoom[0], U.zoom[1]);
    setf(progFinal, 'uDrop', U.drop);
    setf(progFinal, 'uInvert', U.invert);
    setf(progFinal, 'uShock', U.shock);
    setf(progFinal, 'uBuild', U.build);
    setf(progFinal, 'uAim', U.aim);
    setv3(progFinal, 'uGrav[0]', U.grav);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ping = 1 - ping;
  }

  return { init, resize, render };
})();
