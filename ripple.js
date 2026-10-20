/* Interactive tiled-ripple background for the home page (WebGL2).
   Colours switch with the light / dark theme. */
(function () {
    var canvas = document.getElementById('c');
    if (!canvas) return;
    var gl = canvas.getContext('webgl2');
    if (!gl) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var N = 24;

    var vs = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
    var fs = '#version 300 es\n' +
        'precision highp float;\n' +
        'uniform vec2 uRes; uniform float uT; uniform vec2 uMouse; uniform float uVel; uniform float uDark; uniform vec4 uR[' + N + '];\n' +
        'out vec4 o;\n' +
        'void main(){\n' +
        '  vec3 BLUE  = mix(vec3(0.82,0.91,0.97), vec3(0.08,0.15,0.19), uDark);\n' +
        '  vec3 CREAM = mix(vec3(0.97,0.96,0.94), vec3(0.11,0.18,0.21), uDark);\n' +
        '  vec3 DARK  = mix(vec3(0.72,0.84,0.93), vec3(0.04,0.08,0.10), uDark);\n' +
        '  vec3 WHITE = mix(vec3(0.98,0.99,1.00), vec3(0.15,0.23,0.27), uDark);\n' +
        '  float a = uRes.x/uRes.y;\n' +
        '  vec2 uv = gl_FragCoord.xy/uRes;\n' +
        '  vec2 sp = vec2((uv.x-0.5)*a, uv.y);\n' +
        '  vec2 disp = vec2(0.);\n' +
        '  for(int i=0;i<' + N + ';i++){\n' +
        '    vec4 r = uR[i];\n' +
        '    vec2 dv = sp - r.xy; float d = length(dv);\n' +
        '    float age = uT - r.z;\n' +
        '    float f = d - age*0.5;\n' +
        '    float w = sin(f*34.) * exp(-f*f*14.) * exp(-age*1.6) * r.w / (1.+d*2.5);\n' +
        '    disp += (dv/(d+1e-4)) * w * 0.014;\n' +
        '  }\n' +
        '  vec2 dm = sp - uMouse;\n' +
        '  disp -= dm * exp(-dot(dm,dm)*9.) * (0.04 + 0.08*uVel);\n' +
        '  vec2 s2 = sp + disp;\n' +
        '  vec2 q = vec2(s2.x*14.0 + sin(uT*0.12)*2.0, s2.y*14.0 + sin(uT*0.09)*0.8);\n' +
        '  vec2 cell = floor(q);\n' +
        '  vec2 u = fract(q) - 0.5;\n' +
        '  float r = 0.26;\n' +
        '  vec2 e = max(abs(u) - (0.5 - r), 0.);\n' +
        '  float sd = length(e) - r;\n' +
        '  float aa = max(length(fwidth(q))*0.8, 0.01);\n' +
        '  float tile = 1. - smoothstep(-aa, aa, sd);\n' +
        '  float tpar = mod(cell.x + cell.y, 2.);\n' +
        '  vec3 tileCol = mix(BLUE, CREAM, tpar);\n' +
        '  vec2 jn = floor(q + 0.5);\n' +
        '  const float SEQ[8] = float[8](0.,1.,0.,0.,1.,0.,1.,1.);\n' +
        '  float jpar = SEQ[int(mod(jn.x + jn.y, 8.) + 0.5) % 8];\n' +
        '  vec3 gapCol = mix(DARK, WHITE, jpar);\n' +
        '  vec3 col = mix(gapCol, tileCol, tile);\n' +
        '  o = vec4(col, 1.);\n' +
        '}';

    function sh(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
        return s;
    }

    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return; }
    gl.useProgram(pr);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    function U(n) { return gl.getUniformLocation(pr, n); }
    var uRes = U('uRes'), uT = U('uT'), uMouse = U('uMouse'), uVel = U('uVel'), uDark = U('uDark'), uR = U('uR');

    var ripples = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) ripples[i * 4 + 2] = -100;
    var ri = 0, t0 = performance.now();
    function now() { return (performance.now() - t0) / 1000; }
    function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0; }

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (reduceMotion) draw();
    }

    function toSpace(x, y) { return [(x / innerWidth - 0.5) * (innerWidth / innerHeight), 1 - y / innerHeight]; }
    function spawn(x, y, s) { var p = toSpace(x, y); ripples.set([p[0], p[1], now(), s], ri * 4); ri = (ri + 1) % N; }

    var target = [0, 0.4], mouse = [0, 0.4], vel = 0, last = null, acc = 0;

    function move(x, y) {
        target = toSpace(x, y);
        if (last) {
            var d = Math.hypot(x - last[0], y - last[1]);
            vel = Math.min(1, vel + d / 120);
            acc += d;
            if (acc > 38) { spawn(x, y, 0.3 + Math.min(d / 60, 0.5)); acc = 0; }
        }
        last = [x, y];
    }

    function draw() {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uT, now());
        gl.uniform2f(uMouse, mouse[0], mouse[1]);
        gl.uniform1f(uVel, vel);
        gl.uniform1f(uDark, isDark());
        gl.uniform4fv(uR, ripples);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    addEventListener('resize', resize);
    resize();

    if (reduceMotion) {
        // single static frame, redrawn when the theme changes
        window.addEventListener('themechange', draw);
        draw();
        return;
    }

    // listen on document so events fire even when the cursor is over page content
    document.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
    document.addEventListener('pointerdown', function (e) { move(e.clientX, e.clientY); spawn(e.clientX, e.clientY, 1.2); });
    document.addEventListener('pointerleave', function () { last = null; });
    setTimeout(function () { spawn(innerWidth * 0.5, innerHeight * 0.55, 1.0); }, 200);

    function frame() {
        mouse[0] += (target[0] - mouse[0]) * 0.15;
        mouse[1] += (target[1] - mouse[1]) * 0.15;
        vel *= 0.93;
        draw();
        requestAnimationFrame(frame);
    }
    frame();
})();
