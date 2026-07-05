// Procedural chiptune/synthwave audio engine. No external audio files —
// everything is synthesized at runtime with the Web Audio API so the whole
// game (including its soundtrack) ships as a few KB of code.
const Audio2 = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let currentTrack = 0;
  let unlocked = false;

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(master);
  }

  function unlock() {
    ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    unlocked = true;
  }

  function tone(freq, start, dur, opts = {}) {
    const {
      type = "square",
      gain = 0.2,
      dest = sfxGain,
      slideTo = null,
      attack = 0.005,
      release = 0.08,
    } = opts;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + release + 0.02);
    return osc;
  }

  function noiseBurst(start, dur, opts = {}) {
    const { gain = 0.25, dest = sfxGain, filterFreq = 1200 } = opts;
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  // ---- SFX -----------------------------------------------------------
  const sfx = {
    jump() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(320, t, 0.12, { type: "square", gain: 0.18, slideTo: 700 });
    },
    doubleJump() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(500, t, 0.14, { type: "sawtooth", gain: 0.16, slideTo: 950 });
    },
    collect() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(880, t, 0.08, { type: "square", gain: 0.18 });
      tone(1320, t + 0.06, 0.1, { type: "square", gain: 0.16 });
    },
    hurt() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(220, t, 0.18, { type: "sawtooth", gain: 0.22, slideTo: 80 });
      noiseBurst(t, 0.15, { gain: 0.2, filterFreq: 800 });
    },
    hazard() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noiseBurst(t, 0.25, { gain: 0.3, filterFreq: 2200 });
      tone(140, t, 0.25, { type: "sawtooth", gain: 0.2, slideTo: 40 });
    },
    checkpoint() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.08, 0.14, { type: "triangle", gain: 0.18 }));
    },
    levelComplete() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, t + i * 0.11, 0.2, { type: "square", gain: 0.2 })
      );
    },
    gameOver() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [392, 349.2, 293.7, 220].forEach((f, i) => tone(f, t + i * 0.16, 0.2, { type: "sawtooth", gain: 0.2 }));
    },
  };

  // ---- Procedural music sequencer ------------------------------------
  // Each "track" is a minor-key bass + arpeggio pattern; tempo & scale
  // shift slightly per level to keep sectors feeling distinct.
  const TRACKS = [
    { bpm: 100, root: 55, scale: [0, 3, 5, 7, 10], bass: [0, 0, 7, 5], arp: [0, 3, 7, 10, 7, 3] },
    { bpm: 112, root: 49, scale: [0, 2, 3, 7, 8], bass: [0, 5, 3, 7], arp: [0, 3, 7, 12, 8, 3] },
    { bpm: 128, root: 52, scale: [0, 3, 5, 6, 10], bass: [0, 0, 10, 7], arp: [0, 5, 10, 6, 10, 5] },
  ];

  function midiToFreq(semisFromRoot, root) {
    return root * Math.pow(2, semisFromRoot / 12);
  }

  function scheduleTrack(idx) {
    stopMusic();
    const track = TRACKS[idx % TRACKS.length];
    const step = 60 / track.bpm / 2; // 8th notes
    let stepIndex = 0;
    const lookahead = 0.12;

    function scheduleStep() {
      const t = ctx.currentTime + lookahead;
      const bassNote = track.bass[stepIndex % track.bass.length];
      if (stepIndex % 2 === 0) {
        tone(midiToFreq(bassNote, track.root), t, step * 1.8, {
          type: "sawtooth",
          gain: 0.22,
          dest: musicGain,
          attack: 0.01,
          release: 0.05,
        });
      }
      const arpNote = track.arp[stepIndex % track.arp.length];
      tone(midiToFreq(arpNote, track.root * 4), t, step * 0.9, {
        type: "square",
        gain: 0.09,
        dest: musicGain,
        attack: 0.002,
        release: 0.03,
      });
      stepIndex++;
    }

    scheduleStep();
    musicTimer = setInterval(scheduleStep, step * 1000);
    currentTrack = idx;
  }

  function playMusic(idx) {
    ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    scheduleTrack(idx);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMuted(muted) {
    if (!master) return;
    master.gain.value = muted ? 0 : 0.9;
  }

  return { unlock, sfx, playMusic, stopMusic, setMuted, get ctx() { return ctx; } };
})();
