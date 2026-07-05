// WebGL fragment-shader post-processing: CRT scanlines, chromatic
// aberration, vignette and a cheap bloom approximation applied to the
// rendered 2D game frame every tick.
const Shader = (() => {
  const VERT_SRC = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = (aPos + 1.0) * 0.5;
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG_SRC = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uTime;
    uniform vec2 uResolution;

    vec3 sampleAt(vec2 uv) {
      return texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;

      // chromatic aberration, stronger toward the edges
      float aberration = 0.0016 + 0.0028 * dot(center, center);
      vec2 dir = normalize(center + 0.0001);
      float r = sampleAt(uv + dir * aberration).r;
      float g = sampleAt(uv).g;
      float b = sampleAt(uv - dir * aberration).b;
      vec3 col = vec3(r, g, b);

      // cheap bloom: average a few offset taps and screen-blend them in
      vec3 bloom = vec3(0.0);
      float texel = 1.0 / uResolution.y;
      bloom += sampleAt(uv + vec2(0.0, texel * 1.5));
      bloom += sampleAt(uv - vec2(0.0, texel * 1.5));
      bloom += sampleAt(uv + vec2(texel * 1.5, 0.0));
      bloom += sampleAt(uv - vec2(texel * 1.5, 0.0));
      bloom *= 0.25;
      col = 1.0 - (1.0 - col) * (1.0 - bloom * 0.35);

      // scanlines
      float scan = 0.94 + 0.06 * sin(uv.y * uResolution.y * 3.14159 * 1.0 + uTime * 2.0);
      col *= scan;

      // subtle rolling scan glow band
      float band = smoothstep(0.0, 1.0, sin(uv.y * 6.2831 + uTime * 0.6) * 0.5 + 0.5);
      col += vec3(0.01, 0.02, 0.03) * band;

      // vignette
      float vig = smoothstep(0.85, 0.25, length(center));
      col *= mix(0.55, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let gl = null;
  let program = null;
  let texture = null;
  let uTime, uResolution;
  let ok = false;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("shader compile error", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function init(canvas) {
    try {
      gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return false;

      const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return false;

      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn("program link error", gl.getProgramInfoLog(program));
        return false;
      }
      gl.useProgram(program);

      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      uTime = gl.getUniformLocation(program, "uTime");
      uResolution = gl.getUniformLocation(program, "uResolution");

      ok = true;
      return true;
    } catch (e) {
      console.warn("WebGL init failed", e);
      return false;
    }
  }

  function render(sourceCanvas, w, h, time) {
    if (!ok) return false;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uResolution, w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  return { init, render, get available() { return ok; } };
})();
