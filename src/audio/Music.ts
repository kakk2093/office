/** Фоновая лаунж-музыка: медленные минорные аккорды внахлёст, процедурно — без файлов. */

interface Chord {
	/** Ноты аккорда, Гц. */
	notes: number[];
	/** Бас на октаву ниже корня, Гц. */
	bass: number;
}

/** Am7 — Fmaj7 — Cmaj7 — E7: минорный круг с доминантой обратно в Am. */
const CHORDS: Chord[] = [
	{ notes: [220.0, 261.63, 329.63, 392.0], bass: 110.0 },
	{ notes: [174.61, 220.0, 261.63, 329.63], bass: 87.31 },
	{ notes: [261.63, 329.63, 392.0, 493.88], bass: 130.81 },
	{ notes: [164.81, 207.65, 246.94, 293.66], bass: 82.41 },
];

const CHORD_DURATION = 4.5;
const CROSSFADE = 1.6;
const MASTER_VOLUME = 0.14;
/** Перкуссия: 120 уд/мин — мягкий кик на каждую долю, лёгкая щётка на 2 и 4. */
const BEAT_INTERVAL = 60 / 120;

export class Music {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private timer: number | null = null;
	private chordIndex = 0;
	private playing = false;
	private percussionOn = false;
	private percussionTimer: number | null = null;
	private beatIndex = 0;

	private _context(): AudioContext {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createGain();
			this.master.gain.value = MASTER_VOLUME;
			this.master.connect(this.ctx.destination);
		}
		return this.ctx;
	}

	start(): void {
		if (this.playing) return;
		this.playing = true;
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		this._scheduleChord();
	}

	stop(): void {
		this.playing = false;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	/** Плавно заглушить музыку за seconds секунд и остановить (аккорды и перкуссию). */
	fadeOut(seconds: number): void {
		if (!this.ctx || !this.master) {
			this.stop();
			this.setPercussion(false);
			return;
		}
		const gain = this.master.gain;
		const t = this.ctx.currentTime;
		gain.cancelScheduledValues(t);
		gain.setValueAtTime(gain.value, t);
		gain.linearRampToValueAtTime(0.0001, t + seconds);
		window.setTimeout(() => {
			this.stop();
			this.setPercussion(false);
		}, seconds * 1000);
	}

	/** Включить/выключить перкуссию поверх аккордов (например, при выходе на улицу). */
	setPercussion(on: boolean): void {
		if (on === this.percussionOn) return;
		this.percussionOn = on;
		if (on) {
			this._scheduleBeat();
		} else if (this.percussionTimer !== null) {
			clearTimeout(this.percussionTimer);
			this.percussionTimer = null;
		}
	}

	private _scheduleBeat(): void {
		if (!this.percussionOn) return;
		this._playBeat(this.beatIndex);
		this.beatIndex++;
		this.percussionTimer = window.setTimeout(() => this._scheduleBeat(), BEAT_INTERVAL * 1000);
	}

	/** Мягкий кик на каждую долю + лёгкая щётка (шум) на слабую долю — ненавязчивый лаундж-грув. */
	private _playBeat(index: number): void {
		const ctx = this._context();
		const master = this.master!;
		const now = ctx.currentTime;
		this._playKick(now, master);
		if (index % 2 === 1) this._playBrush(now, master);
	}

	private _playKick(time: number, dest: AudioNode): void {
		const ctx = this._context();
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(130, time);
		osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.16, time);
		gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

		osc.connect(gain);
		gain.connect(dest);
		osc.start(time);
		osc.stop(time + 0.25);
	}

	private _playBrush(time: number, dest: AudioNode): void {
		const ctx = this._context();
		const duration = 0.12;
		const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

		const noise = ctx.createBufferSource();
		noise.buffer = buffer;

		const filter = ctx.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = 2500;

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.07, time);
		gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(dest);
		noise.start(time);
	}

	private _scheduleChord(): void {
		if (!this.playing) return;
		const chord = CHORDS[this.chordIndex % CHORDS.length];
		this.chordIndex++;
		this._playChord(chord);
		this.timer = window.setTimeout(() => this._scheduleChord(), (CHORD_DURATION - CROSSFADE) * 1000);
	}

	/** Тёплый пэд (по два расстроенных triangle-осциллятора на ноту) + мягкий синус-бас, с длинными фронтами внахлёст. */
	private _playChord(chord: Chord): void {
		const ctx = this._context();
		const master = this.master!;
		const now = ctx.currentTime;
		const attack = 1.2;
		const release = CROSSFADE + 0.4;

		for (const freq of chord.notes) {
			for (const detune of [-4, 4]) {
				const osc = ctx.createOscillator();
				osc.type = 'triangle';
				osc.frequency.value = freq;
				osc.detune.value = detune;

				const filter = ctx.createBiquadFilter();
				filter.type = 'lowpass';
				filter.frequency.value = 1100;

				const gain = ctx.createGain();
				gain.gain.setValueAtTime(0, now);
				gain.gain.linearRampToValueAtTime(0.05, now + attack);
				gain.gain.setValueAtTime(0.05, now + CHORD_DURATION - release);
				gain.gain.linearRampToValueAtTime(0, now + CHORD_DURATION);

				osc.connect(filter);
				filter.connect(gain);
				gain.connect(master);
				osc.start(now);
				osc.stop(now + CHORD_DURATION + 0.1);
			}
		}

		const bass = ctx.createOscillator();
		bass.type = 'sine';
		bass.frequency.value = chord.bass;
		const bassGain = ctx.createGain();
		bassGain.gain.setValueAtTime(0, now);
		bassGain.gain.linearRampToValueAtTime(0.09, now + attack);
		bassGain.gain.setValueAtTime(0.09, now + CHORD_DURATION - release);
		bassGain.gain.linearRampToValueAtTime(0, now + CHORD_DURATION);
		bass.connect(bassGain);
		bassGain.connect(master);
		bass.start(now);
		bass.stop(now + CHORD_DURATION + 0.1);
	}
}
