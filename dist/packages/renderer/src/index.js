import { EventHub, clamp } from '../../core/src/index.js';

const modes = { solid: 0, plasma: 1, spectrum: 2, stars: 3 };
const colorVector = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const shader = `
struct Parameters { size: vec2u, time: f32, amplitude: f32, color: vec4f, mode: u32, pad0: u32, pad1: u32, pad2: u32 }
@group(0) @binding(0) var<uniform> p: Parameters;
@group(0) @binding(1) var<storage, read_write> pixels: array<vec4f>;
@compute @workgroup_size(8,8) fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= p.size.x || id.y >= p.size.y) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(p.size);
  var c = p.color;
  if (p.mode == 1u) {
    let q = uv * vec2f(9.0,7.0); let t = p.time * 0.5;
    let v = sin(q.x+t)+sin(q.y-t*1.3)+sin((q.x+q.y+t)*0.8)+sin(length(q-vec2f(4.5,3.5))*2.0-t*2.0);
    c = vec4f(0.45+0.4*sin(v*1.5+t),0.35+0.3*sin(v*1.5+2.1),0.55+0.4*sin(v*1.5+4.2),1.0);
  } else if (p.mode == 2u) {
    let band = floor(uv.x*48.0); let amp = max(0.05,p.amplitude);
    let level = (0.12+0.7*abs(sin(band*0.53+p.time*1.6)*cos(band*0.21-p.time*0.9)))*amp;
    let lit = (1.0-uv.y) < level && fract(uv.x*48.0)<0.82 && fract(uv.y*45.0)<0.8;
    c = select(vec4f(0.015,0.018,0.03,1),vec4f(0.15+uv.y*0.35,0.6+uv.y*0.35,0.95-uv.y*0.65,1),lit);
  } else if (p.mode == 3u) {
    let q=(uv-0.5)*vec2f(1.5,1.0); let angle=atan2(q.y,q.x); let radius=length(q);
    let rays=pow(max(0.0,sin(angle*91.0+sin(angle*17.0)*9.0)),40.0);
    let dots=pow(max(0.0,sin(radius*70.0-p.time*7.0)),24.0)*rays;
    c=vec4f(vec3f(dots*min(1.0,radius*3.0))*vec3f(0.75,0.85,1.0),1.0);
  }
  pixels[id.y*p.size.x+id.x]=c;
}
@vertex fn vertexMain(@builtin(vertex_index) vi:u32)->@builtin(position) vec4f {
  let x=f32((vi<<1u)&2u); let y=f32(vi&2u); return vec4f(x*2.0-1.0,1.0-y*2.0,0.0,1.0);
}
@fragment fn fragmentMain(@builtin(position) position:vec4f)->@location(0) vec4f {
  let x=min(u32(position.x),p.size.x-1u); let y=min(u32(position.y),p.size.y-1u); return pixels[y*p.size.x+x];
}`;

async function gpuBackend(canvas, onLost) {
  if (!globalThis.navigator?.gpu) throw new Error('WebGPU is not available.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
  if (!adapter) throw new Error('No WebGPU adapter is available.');
  const device = await adapter.requestDevice();
  let stopped = false;
  const uncaptured = (event) => {
    if (stopped) return;
    event.preventDefault?.();
    onLost(event.error?.message ?? 'WebGPU validation failed.');
  };
  device.addEventListener('uncapturederror', uncaptured);
  device.lost.then((info) => {
    if (!stopped) onLost(info.message || 'WebGPU device lost');
  });
  try {
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('The WebGPU context could not be created.');
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'opaque',
    });
    const module = device.createShaderModule({ code: shader });
    const info = await module.getCompilationInfo();
    if (info.messages.some((m) => m.type === 'error'))
      throw new Error(
        info.messages
          .filter((m) => m.type === 'error')
          .map((m) => m.message)
          .join('\n'),
      );
    const layout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' },
        },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const compute = await device.createComputePipelineAsync({
      layout: pipelineLayout,
      compute: { module, entryPoint: 'computeMain' },
    });
    const render = await device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'vertexMain' },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: { topology: 'triangle-list' },
    });
    const uniform = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    let storage,
      binding,
      size = '';
    return {
      name: 'WebGPU',
      device,
      maxSize: Math.min(640, device.limits.maxTextureDimension2D),
      draw({ width, height, time, amplitude, color, mode }) {
        if (size !== `${width}x${height}`) {
          storage?.destroy();
          storage = device.createBuffer({
            size: width * height * 16,
            usage: GPUBufferUsage.STORAGE,
          });
          binding = device.createBindGroup({
            layout,
            entries: [
              { binding: 0, resource: { buffer: uniform } },
              { binding: 1, resource: { buffer: storage } },
            ],
          });
          size = `${width}x${height}`;
        }
        const data = new ArrayBuffer(48),
          u = new Uint32Array(data),
          f = new Float32Array(data);
        u[0] = width;
        u[1] = height;
        f[2] = time;
        f[3] = amplitude;
        f.set(color, 4);
        u[8] = mode;
        device.queue.writeBuffer(uniform, 0, data);
        const encoder = device.createCommandEncoder();
        const cp = encoder.beginComputePass();
        cp.setPipeline(compute);
        cp.setBindGroup(0, binding);
        cp.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
        cp.end();
        const rp = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });
        rp.setPipeline(render);
        rp.setBindGroup(0, binding);
        rp.draw(3);
        rp.end();
        device.queue.submit([encoder.finish()]);
      },
      dispose() {
        stopped = true;
        device.removeEventListener('uncapturederror', uncaptured);
        storage?.destroy();
        uniform.destroy();
        context.unconfigure();
        device.destroy();
      },
    };
  } catch (error) {
    stopped = true;
    device.removeEventListener('uncapturederror', uncaptured);
    device.destroy();
    throw error;
  }
}

function webglBackend(canvas, onLost) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL 2 is not available.');
  const vs = `#version 300 es\nvoid main(){float x=float((gl_VertexID<<1)&2);float y=float(gl_VertexID&2);gl_Position=vec4(x*2.-1.,y*2.-1.,0.,1.);}`;
  const fs = `#version 300 es\nprecision highp float;uniform vec2 size;uniform float time;uniform float amplitude;uniform vec4 color;uniform int mode;out vec4 outColor;void main(){vec2 uv=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y)/size;vec4 c=color;if(mode==1){vec2 q=uv*vec2(9.,7.);float t=time*.5;float v=sin(q.x+t)+sin(q.y-t*1.3)+sin((q.x+q.y+t)*.8)+sin(length(q-vec2(4.5,3.5))*2.-t*2.);c=vec4(.45+.4*sin(v*1.5+t),.35+.3*sin(v*1.5+2.1),.55+.4*sin(v*1.5+4.2),1.);}else if(mode==2){float band=floor(uv.x*48.);float level=(.12+.7*abs(sin(band*.53+time*1.6)*cos(band*.21-time*.9)))*max(.05,amplitude);bool lit=(1.-uv.y)<level&&fract(uv.x*48.)<.82&&fract(uv.y*45.)<.8;c=lit?vec4(.15+uv.y*.35,.6+uv.y*.35,.95-uv.y*.65,1.):vec4(.015,.018,.03,1.);}else if(mode==3){vec2 q=(uv-.5)*vec2(1.5,1.);float a=atan(q.y,q.x);float r=length(q);float rays=pow(max(0.,sin(a*91.+sin(a*17.)*9.)),40.);float dots=pow(max(0.,sin(r*70.-time*7.)),24.)*rays;c=vec4(vec3(dots*min(1.,r*3.))*vec3(.75,.85,1.),1.);}outColor=c;}`;
  const compile = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(msg);
    }
    return s;
  };
  const vertex = compile(gl.VERTEX_SHADER, vs),
    fragment = compile(gl.FRAGMENT_SHADER, fs);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  const locations = Object.fromEntries(
    ['size', 'time', 'amplitude', 'color', 'mode'].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ]),
  );
  const lost = (e) => {
    e.preventDefault();
    onLost('WebGL context lost');
  };
  canvas.addEventListener('webglcontextlost', lost);
  return {
    name: 'WebGL 2',
    maxSize: 640,
    draw(p) {
      gl.viewport(0, 0, p.width, p.height);
      gl.useProgram(program);
      gl.uniform2f(locations.size, p.width, p.height);
      gl.uniform1f(locations.time, p.time);
      gl.uniform1f(locations.amplitude, p.amplitude);
      gl.uniform4fv(locations.color, p.color);
      gl.uniform1i(locations.mode, p.mode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

function canvasBackend(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available.');
  let image;
  return {
    name: 'Canvas 2D',
    maxSize: 320,
    draw({ width, height, time: t, amplitude: a, color, mode }) {
      if (mode === 0) {
        ctx.fillStyle = `rgb(${color
          .slice(0, 3)
          .map((c) => Math.round(c * 255))
          .join(',')})`;
        ctx.fillRect(0, 0, width, height);
        return;
      }
      if (!image || image.width !== width || image.height !== height)
        image = ctx.createImageData(width, height);
      const data = image.data;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const u = (x + 0.5) / width,
            v = (y + 0.5) / height;
          let r = 0,
            g = 0,
            b = 0;
          if (mode === 1) {
            const qx = u * 9,
              qy = v * 7,
              time = t * 0.5,
              value =
                Math.sin(qx + time) +
                Math.sin(qy - time * 1.3) +
                Math.sin((qx + qy + time) * 0.8) +
                Math.sin(Math.hypot(qx - 4.5, qy - 3.5) * 2 - time * 2);
            r = 0.45 + 0.4 * Math.sin(value * 1.5 + time);
            g = 0.35 + 0.3 * Math.sin(value * 1.5 + 2.1);
            b = 0.55 + 0.4 * Math.sin(value * 1.5 + 4.2);
          } else if (mode === 2) {
            const band = Math.floor(u * 48),
              level =
                (0.12 +
                  0.7 *
                    Math.abs(Math.sin(band * 0.53 + t * 1.6) * Math.cos(band * 0.21 - t * 0.9))) *
                Math.max(0.05, a);
            if (1 - v < level && (u * 48) % 1 < 0.82 && (v * 45) % 1 < 0.8) {
              r = 0.15 + v * 0.35;
              g = 0.6 + v * 0.35;
              b = 0.95 - v * 0.65;
            } else {
              r = 0.015;
              g = 0.018;
              b = 0.03;
            }
          } else {
            const qx = (u - 0.5) * 1.5,
              qy = v - 0.5,
              angle = Math.atan2(qy, qx),
              radius = Math.hypot(qx, qy);
            const rays = Math.pow(Math.max(0, Math.sin(angle * 91 + Math.sin(angle * 17) * 9)), 40),
              dots =
                Math.pow(Math.max(0, Math.sin(radius * 70 - t * 7)), 24) *
                rays *
                Math.min(1, radius * 3);
            r = dots * 0.75;
            g = dots * 0.85;
            b = dots;
          }
          const i = (y * width + x) * 4;
          data[i] = clamp(r * 255, 0, 255);
          data[i + 1] = clamp(g * 255, 0, 255);
          data[i + 2] = clamp(b * 255, 0, 255);
          data[i + 3] = 255;
        }
      ctx.putImageData(image, 0, 0);
    },
    dispose() {
      image = null;
    },
  };
}

/** One surface owns one canvas context, one backend and one animation loop. */
export class Surface extends EventHub {
  constructor(
    canvas,
    { effect = 'solid', color = '#3a6ea5', preference = 'auto', animated = false } = {},
  ) {
    super();
    if (!canvas?.isConnected) throw new Error('Attach the canvas before creating a Surface.');
    this.canvas = canvas;
    this.effect = effect;
    this.color = color;
    this.preference = preference;
    this.animated = animated;
    this.amplitude = 1;
    this.generation = 0;
    this.frameCount = 0;
    this.dispatchCount = 0;
    this.disposed = false;
    this.paused = false;
    this.state = 'initializing';
    this.errors = [];
    this.backendIndex = -1;
    this.observer = new ResizeObserver(() => this.invalidate());
    this.observer.observe(canvas.parentElement ?? canvas);
    this.visibility = () => {
      if (document.hidden) this.#cancel();
      else this.invalidate();
    };
    document.addEventListener('visibilitychange', this.visibility);
    this.ready = this.#initialize();
  }
  get backendName() {
    return this.backend?.name ?? (this.state === 'failed' ? 'Unavailable' : 'Initializing');
  }
  async #initialize(startAt = 0) {
    const generation = ++this.generation;
    this.#cancel();
    this.backend?.dispose();
    this.backend = null;
    this.state = 'initializing';
    const choices =
      this.preference === 'canvas'
        ? ['canvas']
        : this.preference === 'webgl'
          ? ['webgl', 'canvas']
          : ['webgpu', 'webgl', 'canvas'];
    for (let i = startAt; i < choices.length; i++) {
      if (this.disposed || generation !== this.generation) return;
      const fresh = this.canvas.cloneNode(false);
      this.canvas.replaceWith(fresh);
      this.canvas = fresh;
      try {
        const lost = (message) => {
          if (this.disposed || generation !== this.generation) return;
          this.errors.push(message);
          this.state = 'recovering';
          this.ready = this.#initialize(i + 1);
        };
        const backend =
          choices[i] === 'webgpu'
            ? await gpuBackend(fresh, lost)
            : choices[i] === 'webgl'
              ? webglBackend(fresh, lost)
              : canvasBackend(fresh);
        if (this.disposed || generation !== this.generation) {
          backend.dispose();
          return;
        }
        this.backend = backend;
        this.backendIndex = i;
        this.state = 'ready';
        this.emit('backend', backend.name);
        this.invalidate();
        return backend.name;
      } catch (error) {
        this.errors.push(error.message);
      }
    }
    this.state = 'failed';
    this.emit('error', new Error(this.errors.at(-1) ?? 'No graphics backend is available.'));
  }
  #cancel() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }
  setEffect(effect, { animated = effect !== 'solid' } = {}) {
    this.effect = effect;
    this.animated = animated;
    this.invalidate();
  }
  setColor(color) {
    this.color = color;
    this.invalidate();
  }
  setPreference(preference) {
    this.preference = preference;
    this.ready = this.#initialize();
    return this.ready;
  }
  pause(value = true) {
    this.paused = value;
    if (value) this.#cancel();
    else this.invalidate();
  }
  invalidate() {
    if (this.disposed || this.paused || document.hidden || !this.backend || this.raf) return;
    this.raf = requestAnimationFrame((t) => this.#draw(t));
  }
  #draw(timestamp) {
    this.raf = 0;
    if (this.disposed || this.paused || !this.backend) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const ratio = Math.min(1, this.backend.maxSize / Math.max(bounds.width, bounds.height));
    const width = Math.max(1, Math.round(bounds.width * ratio)),
      height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    try {
      this.backend.draw({
        width,
        height,
        time: timestamp / 1000,
        amplitude: this.amplitude,
        color: colorVector(this.color),
        mode: modes[this.effect] ?? 0,
      });
      this.frameCount++;
      if (this.backend.name === 'WebGPU') this.dispatchCount++;
    } catch (error) {
      this.errors.push(error.message);
      this.ready = this.#initialize(this.backendIndex + 1);
      return;
    }
    if (this.animated) this.invalidate();
  }
  diagnostics() {
    return {
      backend: this.backendName,
      state: this.state,
      generation: this.generation,
      frames: this.frameCount,
      computeDispatches: this.dispatchCount,
      resolution: [this.canvas.width, this.canvas.height],
      errors: [...this.errors],
    };
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.#cancel();
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.backend?.dispose();
    this.backend = null;
    this.clear();
  }
}

export class SoundEngine {
  constructor(settings) {
    this.settings = settings;
  }
  context() {
    if (!this.audio) {
      const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Audio) return null;
      this.audio = new Audio();
    }
    if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
    return this.audio;
  }
  tone(frequency = 440, duration = 0.1, type = 'sine', volume = 0.07, delay = 0) {
    if (!this.settings.get('sound')) return;
    const ctx = this.context();
    if (!ctx) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(
      (volume * this.settings.get('volume')) / 100,
      ctx.currentTime + delay + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration + 0.02);
  }
  play(name) {
    if (name === 'startup')
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12, i * 0.15));
    else if (name === 'error') {
      this.tone(330, 0.16, 'triangle');
      this.tone(220, 0.25, 'triangle', 0.08, 0.13);
    } else if (name === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.12, i * 0.1));
    } else if (name === 'click') this.tone(880, 0.025, 'sine', 0.04);
  }
}
