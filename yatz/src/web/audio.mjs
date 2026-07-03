const STORAGE_KEY = "yatz.muted";

export function createFoley() {
  let ctx = null;
  let muted = false;

  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    muted = false;
  }

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      ctx = new AudioContextClass();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noise(c, { freq = 2000, q = 6, dur = 0.06, gain = 0.15, delay = 0, type = "bandpass" }) {
    const at = c.currentTime + delay;
    const length = Math.max(1, Math.ceil(c.sampleRate * dur));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const level = c.createGain();
    level.gain.setValueAtTime(gain, at);
    level.gain.exponentialRampToValueAtTime(0.001, at + dur);
    source.connect(filter);
    filter.connect(level);
    level.connect(c.destination);
    source.start(at);
  }

  function tone(c, { freq = 880, endFreq = null, dur = 0.3, gain = 0.05, delay = 0, type = "sine" }) {
    const at = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq != null) osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
    const level = c.createGain();
    level.gain.setValueAtTime(gain, at);
    level.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(level);
    level.connect(c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  return {
    isMuted: () => muted,
    setMuted(next) {
      muted = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable; mute state just won't persist
      }
    },
    // A die landing on felt: bright ivory click plus a low body knock.
    clack(delay = 0) {
      const c = ensure();
      if (!c) return;
      noise(c, { freq: 1600 + Math.random() * 900, q: 7, dur: 0.045, gain: 0.14, delay });
      noise(c, { freq: 320, q: 2, dur: 0.05, gain: 0.1, delay, type: "lowpass" });
    },
    // Soft felt thud — die settling into the rack, or a fly-in landing.
    felt(delay = 0) {
      const c = ensure();
      if (!c) return;
      noise(c, { freq: 230, q: 1.5, dur: 0.07, gain: 0.11, delay, type: "lowpass" });
    },
    // Tiny tick for taps and per-die deposits into a chip.
    tick(delay = 0) {
      const c = ensure();
      if (!c) return;
      noise(c, { freq: 3400, q: 9, dur: 0.025, gain: 0.06, delay, type: "highpass" });
    },
    // The score committing: firm chip-stamp on the card.
    stamp(delay = 0) {
      const c = ensure();
      if (!c) return;
      noise(c, { freq: 480, q: 2, dur: 0.06, gain: 0.16, delay, type: "lowpass" });
      tone(c, { freq: 190, dur: 0.09, gain: 0.07, delay, type: "triangle" });
    },
    // Gold shimmer for near-miss hands and the bonus locking in.
    shimmer(delay = 0) {
      const c = ensure();
      if (!c) return;
      tone(c, { freq: 1320, endFreq: 1980, dur: 0.45, gain: 0.025, delay });
      tone(c, { freq: 1650, endFreq: 2470, dur: 0.45, gain: 0.015, delay: delay + 0.06 });
    },
    // Yahtzee: low table rumble under one restrained chime.
    yatz(delay = 0) {
      const c = ensure();
      if (!c) return;
      tone(c, { freq: 52, dur: 0.9, gain: 0.11, delay, type: "sine" });
      noise(c, { freq: 120, q: 1, dur: 0.6, gain: 0.06, delay, type: "lowpass" });
      tone(c, { freq: 660, dur: 1.1, gain: 0.035, delay: delay + 0.28 });
      tone(c, { freq: 990, dur: 1.3, gain: 0.028, delay: delay + 0.34 });
    },
  };
}
