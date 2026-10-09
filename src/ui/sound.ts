/** Ambiente sonoro WebAudio — NUNCA en autoplay; solo tras gesto del usuario. */

export function initSound(): void {
  const btn = document.getElementById('sound-btn');
  const txt = document.getElementById('sound-txt');
  if (!btn) return;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  let on = false;

  function build(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // pad grave suave
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;
    filter.connect(master);

    [55, 82.4, 110, 164.8].forEach((f, i) => {
      const osc = ctx!.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 6;

      const g = ctx!.createGain();
      g.gain.value = 0.16 / (i + 1);

      // LFO lento para respiración
      const lfo = ctx!.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.017;
      const lfoGain = ctx!.createGain();
      lfoGain.gain.value = 0.07 / (i + 1);
      lfo.connect(lfoGain).connect(g.gain);

      osc.connect(g).connect(filter);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    });

    // ruido filtrado (aire) — buffer estéreo corto en bucle
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.2;
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 0.4;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(nf).connect(ng).connect(master);
    noise.start();
    nodes.push(noise);
  }

  function fade(target: number, time = 1.1): void {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + time);
  }

  btn.addEventListener('click', async () => {
    if (!ctx) build();
    const audio = ctx;
    if (!audio) return;
    if (audio.state === 'suspended') await audio.resume();

    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    if (txt) txt.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    fade(on ? 0.5 : 0, on ? 1.4 : 0.7);

    if (!on) {
      // pausa real cuando se apaga (ahorro de CPU)
      window.setTimeout(() => {
        if (!on && audio.state === 'running' && master && master.gain.value < 0.01) {
          void audio.suspend();
        }
      }, 900);
    }
  });

  // silenciar al salir de la pestaña
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    const audio = ctx;
    if (document.hidden) void audio.suspend();
    else void audio.resume();
  });

  window.addEventListener('pagehide', () => {
    nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* noop */
      }
    });
    nodes = [];
    void ctx?.close();
  });
}
