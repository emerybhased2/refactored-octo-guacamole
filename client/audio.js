(function (g) {
  const M = (g.Mope = g.Mope || {});
  /**
   * Sound effects for the events the 2020-03-03 note lists: eating food, drinking water drops, eating animals, dying.
   * The original audio files were never captured, so these are ORIGINAL synthesized tones (WebAudio). The AudioContext is
   * created lazily on the first user gesture (browser autoplay rules). Muting is a setting (the note: 'a mute button has been added to the settings').
   */
  const KINDS = {
    eat:   { type: 'triangle', f0: 620, f1: 880, dur: 0.07, gain: 0.12 },
    drink: { type: 'sine', f0: 380, f1: 760, dur: 0.11, gain: 0.12 },
    kill:  { type: 'sawtooth', f0: 210, f1: 90, dur: 0.16, gain: 0.14, noise: 0.05 },
    die:   { type: 'square', f0: 440, f1: 70, dur: 0.45, gain: 0.1 },
    // abilities (original synthesized cues, one per effect archetype)
    ab_speed:  { type: 'sawtooth', f0: 180, f1: 640, dur: 0.22, gain: 0.09, noise: 0.08 },
    ab_area:   { type: 'square', f0: 140, f1: 45, dur: 0.24, gain: 0.14, noise: 0.1 },
    ab_zone:   { type: 'sawtooth', f0: 260, f1: 150, dur: 0.35, gain: 0.08, noise: 0.2 },
    ab_shield: { type: 'triangle', f0: 520, f1: 900, dur: 0.18, gain: 0.1 },
    ab_hide:   { type: 'sine', f0: 400, f1: 130, dur: 0.3, gain: 0.1 },
    ab_fly:    { type: 'triangle', f0: 300, f1: 760, dur: 0.3, gain: 0.09, noise: 0.06 },
    ab_grab:   { type: 'square', f0: 330, f1: 220, dur: 0.14, gain: 0.12 },
    ab_proj:   { type: 'sine', f0: 900, f1: 380, dur: 0.12, gain: 0.11 },
    ab_summon: { type: 'triangle', f0: 440, f1: 660, dur: 0.28, gain: 0.1 },
    ab_food:   { type: 'sine', f0: 500, f1: 700, dur: 0.1, gain: 0.1 },
  };
  let ctx = null;
  const Sound = {
    muted: false, enabled: true, played: [],
    kinds: Object.keys(KINDS),
    unlock() { if (ctx || typeof AudioContext === 'undefined') return; try { ctx = new AudioContext(); } catch (e) { ctx = null; } },
    play(kind) {
      if (!KINDS[kind]) return false; this.played.push(kind); if (this.played.length > 50) this.played.shift();
      if (this.muted || !this.enabled || !ctx) return false;
      const k = KINDS[kind], t0 = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = k.type; o.frequency.setValueAtTime(k.f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, k.f1), t0 + k.dur);
      gn.gain.setValueAtTime(k.gain, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + k.dur); o.connect(gn); gn.connect(ctx.destination); o.start(t0); o.stop(t0 + k.dur + 0.02);
      if (k.noise) { const n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate * k.noise), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); n.buffer = buf; const ng = ctx.createGain(); ng.gain.value = 0.15; n.connect(ng); ng.connect(ctx.destination); n.start(t0); }
      return true;
    },
    /** Sound for an ability use: the cooldown jumped up between two snapshots (pure; tested). kind = the first effect kind of the ability. */
    abilitySound(prevCd, curCd, kind) { if (!(curCd > (prevCd || 0) + 300)) return null; const k = { speed: 'ab_speed', area: 'ab_area', zone: 'ab_zone', shield: 'ab_shield', hide: 'ab_hide', invis: 'ab_hide', fly: 'ab_fly', grab: 'ab_grab', proj: 'ab_proj', summon: 'ab_summon', food: 'ab_food', water: 'ab_food' }[kind]; return k || null; },
    /** Which sound (if any) a change between two snapshots should trigger. Pure: used by the client and tested. foodXp = max scaled food XP at the player's tier. */
    classify(prev, cur, foodXp) {
      if (!prev || !cur) return null;
      const dxp = cur.xp - prev.xp;
      if (dxp > 0) return dxp <= foodXp * 2.5 ? 'eat' : 'kill';
      if ((cur.w || 0) - (prev.w || 0) >= 2 && cur.a === prev.a) return 'drink';
      return null;
    },
  };
  M.Sound = Sound;
  if (typeof module !== 'undefined') module.exports = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
