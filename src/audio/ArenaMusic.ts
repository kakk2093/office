/**
 * Музыка арены — злой индастриал-метал в духе Doom, процедурно (без файлов): 150 уд/мин, «гитара» в строе drop C —
 * пилы через жёсткий перегруз и фильтр-«кабинет», глушёное чаггинг-рифление с открытыми нотами на малой секунде
 * и тритоне (фригийский лад — самый зловещий), галоп с двойной бочкой, низкий синтовый гул снизу.
 * Круг — 8 тактов: 4 такта риффа A (в четвёртом — сползающий вниз ход), 4 такта тяжёлого галопа B
 * (в последнем — рубленые аккорды и дробь малого перед новым кругом).
 * Ноты планируются с опережением (планировщик на таймере), поэтому ритм ровный, даже если кадры проседают.
 */

const BPM = 150;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const BARS_PER_LOOP = 8;
const MASTER_VOLUME = 0.22;
/** Насколько вперёд планируем ноты и как часто проверяем, с. */
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
/** Корень — до большой октавы (строй drop C). */
const ROOT = 65.41;

/**
 * Нота риффа: полутоны от корня, как сыграна (pm — глушёная ладонью, короткая и глухая; open — открытая нота
 * с октавой; chord — открытый пауэр-аккорд), длина в шестнадцатых.
 */
type Hit = [number, 'pm' | 'open' | 'chord', number];
type Riff = Record<number, Hit>;

const RIFF_A: Riff = {
	0: [0, 'open', 2],
	2: [0, 'pm', 1],
	3: [0, 'pm', 1],
	4: [0, 'pm', 1],
	5: [0, 'pm', 1],
	6: [1, 'open', 2],
	8: [0, 'pm', 1],
	9: [0, 'pm', 1],
	10: [3, 'open', 2],
	12: [0, 'pm', 1],
	13: [0, 'pm', 1],
	14: [6, 'open', 2],
};
/** Четвёртый такт: вторая половина — ход вниз по ладу к корню. */
const RIFF_A_TURN: Riff = {
	...RIFF_A,
	8: [7, 'open', 1],
	9: [6, 'open', 1],
	10: [5, 'open', 1],
	11: [3, 'open', 1],
	12: [1, 'open', 2],
	14: [0, 'chord', 2],
};
delete RIFF_A_TURN[13];
/** Галоп: аккорд и пулемётная глушёнка. */
const RIFF_B: Riff = {
	0: [0, 'chord', 3],
	3: [0, 'pm', 1],
	4: [0, 'pm', 1],
	5: [0, 'pm', 1],
	6: [0, 'pm', 1],
	7: [0, 'pm', 1],
	8: [1, 'chord', 3],
	11: [0, 'pm', 1],
	12: [0, 'pm', 1],
	13: [0, 'pm', 1],
	14: [0, 'pm', 1],
	15: [0, 'pm', 1],
};
/** Последний такт круга — рубленые аккорды по четвертям: корень, тритон, кварта, малая секунда. */
const RIFF_B_END: Riff = {
	0: [0, 'chord', 4],
	4: [6, 'chord', 4],
	8: [5, 'chord', 4],
	12: [1, 'chord', 4],
};
const RIFFS = [RIFF_A, RIFF_A, RIFF_A, RIFF_A_TURN, RIFF_B, RIFF_B, RIFF_B, RIFF_B_END];

export class ArenaMusic {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	/** Вход «гитарного» тракта: перегруз → срез низа → фильтр-кабинет. */
	private guitar: GainNode | null = null;
	private noise: AudioBuffer | null = null;
	private timer: number | null = null;
	private nextTime = 0;
	private step = 0;

	get playing(): boolean {
		return this.timer !== null;
	}

	start(): void {
		if (this.timer !== null) return;
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		this.master!.gain.cancelScheduledValues(ctx.currentTime);
		this.master!.gain.setValueAtTime(MASTER_VOLUME, ctx.currentTime);
		this.nextTime = ctx.currentTime + 0.1;
		this.step = 0;
		this.timer = window.setInterval(() => this._schedule(), TICK_MS);
	}

	/** Плавно затихнуть за seconds и остановиться (start — снова с полной громкостью). */
	fadeOut(seconds: number): void {
		if (!this.ctx || !this.master || this.timer === null) return;
		const gain = this.master.gain;
		const t = this.ctx.currentTime;
		gain.cancelScheduledValues(t);
		gain.setValueAtTime(gain.value, t);
		gain.linearRampToValueAtTime(0.0001, t + seconds);
		window.setTimeout(() => this.stop(), seconds * 1000);
	}

	stop(): void {
		if (this.timer !== null) window.clearInterval(this.timer);
		this.timer = null;
	}

	private _context(): AudioContext {
		if (!this.ctx) {
			const ctx = (this.ctx = new AudioContext());
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = -14;
			comp.ratio.value = 5;
			comp.attack.value = 0.003;
			comp.release.value = 0.1;
			this.master = ctx.createGain();
			this.master.gain.value = MASTER_VOLUME;
			this.master.connect(comp);
			comp.connect(ctx.destination);

			// Гитарный тракт: жёсткий перегруз (tanh с большим усилением), срез гула снизу, провал «картона»
			// в середине и фильтр, как у гитарного кабинета, — без него перегруз звенит и шипит.
			this.guitar = ctx.createGain();
			this.guitar.gain.value = 1;
			const drive = ctx.createWaveShaper();
			const curve = new Float32Array(2048);
			for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 18);
			drive.curve = curve;
			drive.oversample = '2x';
			const low = ctx.createBiquadFilter();
			low.type = 'highpass';
			low.frequency.value = 70;
			const scoop = ctx.createBiquadFilter();
			scoop.type = 'peaking';
			scoop.frequency.value = 750;
			scoop.Q.value = 1;
			scoop.gain.value = -6;
			const cab = ctx.createBiquadFilter();
			cab.type = 'lowpass';
			cab.frequency.value = 3400;
			cab.Q.value = 0.9;
			const out = ctx.createGain();
			out.gain.value = 0.22;
			this.guitar.connect(drive);
			drive.connect(low);
			low.connect(scoop);
			scoop.connect(cab);
			cab.connect(out);
			out.connect(this.master);

			const length = Math.floor(ctx.sampleRate * 0.5);
			this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
			const data = this.noise.getChannelData(0);
			for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
		}
		return this.ctx;
	}

	/** Планировщик: всё, что должно прозвучать в ближайшие LOOKAHEAD секунд, ставим в очередь звука. */
	private _schedule(): void {
		const ctx = this.ctx!;
		// Вкладка засыпала — не догоняем пропущенное, продолжаем с текущего момента.
		if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
		while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
			this._playStep(this.step, this.nextTime);
			this.nextTime += STEP;
			this.step = (this.step + 1) % (STEPS_PER_BAR * BARS_PER_LOOP);
		}
	}

	private _playStep(index: number, t: number): void {
		const s = index % STEPS_PER_BAR;
		const bar = Math.floor(index / STEPS_PER_BAR);
		const gallop = bar >= 4;
		const lastBar = bar === BARS_PER_LOOP - 1;

		const hit = RIFFS[bar][s];
		if (hit) {
			const [semitones, kind, length] = hit;
			const freq = ROOT * 2 ** (semitones / 12);
			this._guitar(t, freq, kind, length * STEP);
			this._bass(t, freq / 2, length * STEP, kind === 'pm');
		}

		// Барабаны: в риффе A бочка — вместе с гитарой; в галопе — двойная бочка шестнадцатыми.
		if (gallop && !lastBar) this._kick(t, s % 2 === 0 ? 1 : 0.75);
		else if (hit || s % 4 === 0) this._kick(t, 1);
		if (s === 4 || s === 12) this._snare(t, 1);
		if (lastBar && s >= 8) this._snare(t, 0.35 + ((s - 8) / 8) * 0.6);
		if (s % 2 === 0) this._hat(t, s % 4 === 0 ? 0.45 : 0.3);
		// Тарелка-крэш — на начало каждой половины круга.
		if (s === 0 && bar % 4 === 0) this._crash(t);
		// Синтовый гул снизу — на весь круг риффа A, «дышит» фильтром.
		if (s === 0 && bar === 0) this._drone(t, ROOT / 2, 4 * STEPS_PER_BAR * STEP);
	}

	/** Нота «гитары»: две расстроенные пилы (+ октава, + квинта у аккорда) в перегруз. Глушёная — короткая
	 * и тёмная (фильтр перед перегрузом почти закрыт), открытая — яркая и звенит до конца длины. */
	private _guitar(t: number, freq: number, kind: 'pm' | 'open' | 'chord', duration: number): void {
		const ctx = this.ctx!;
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		const pm = kind === 'pm';
		tone.frequency.setValueAtTime(pm ? 700 : 4000, t);
		if (pm) tone.frequency.exponentialRampToValueAtTime(250, t + 0.08);
		const gain = ctx.createGain();
		const end = t + (pm ? Math.min(duration, 0.09) : duration * 0.95);
		gain.gain.setValueAtTime(pm ? 0.9 : 0.7, t);
		gain.gain.setValueAtTime(pm ? 0.9 : 0.7, end - 0.02);
		gain.gain.linearRampToValueAtTime(0.0001, end);
		tone.connect(gain);
		gain.connect(this.guitar!);
		const notes = kind === 'chord' ? [1, 1.5, 2] : kind === 'open' ? [1, 2] : [1];
		for (const k of notes) {
			for (const detune of [-9, 9]) {
				const osc = ctx.createOscillator();
				osc.type = 'sawtooth';
				osc.frequency.value = freq * k;
				osc.detune.value = detune;
				osc.connect(tone);
				osc.start(t);
				osc.stop(end + 0.02);
			}
		}
	}

	/** Бас: синус-подбас на октаву ниже гитары, чистый (не в перегруз) — держит низ плотным. */
	private _bass(t: number, freq: number, duration: number, short: boolean): void {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		osc.frequency.value = freq;
		const gain = ctx.createGain();
		const end = t + (short ? Math.min(duration, 0.1) : duration * 0.95);
		gain.gain.setValueAtTime(0.4, t);
		gain.gain.setValueAtTime(0.4, end - 0.02);
		gain.gain.linearRampToValueAtTime(0.0001, end);
		osc.connect(gain);
		gain.connect(this.master!);
		osc.start(t);
		osc.stop(end + 0.02);
	}

	/** Бочка: сухой короткий удар с щелчком — для метала, чтобы двойная не превращалась в гул. */
	private _kick(t: number, level: number): void {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		osc.frequency.setValueAtTime(140, t);
		osc.frequency.exponentialRampToValueAtTime(48, t + 0.06);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.9 * level, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
		osc.connect(gain);
		gain.connect(this.master!);
		osc.start(t);
		osc.stop(t + 0.15);
		this._noiseHit(t, 'bandpass', 3500, 0.35 * level, 0.01, 2);
	}

	/** Малый: плотный шум с тоном, чуть длиннее — «бьёт», как в индастриале. */
	private _snare(t: number, level: number): void {
		const ctx = this.ctx!;
		this._noiseHit(t, 'bandpass', 2200, 0.8 * level, 0.18, 0.7);
		const tone = ctx.createOscillator();
		tone.type = 'triangle';
		tone.frequency.setValueAtTime(230, t);
		tone.frequency.exponentialRampToValueAtTime(170, t + 0.07);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.45 * level, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
		tone.connect(gain);
		gain.connect(this.master!);
		tone.start(t);
		tone.stop(t + 0.12);
	}

	private _hat(t: number, level: number): void {
		this._noiseHit(t, 'highpass', 8000, 0.25 * level, 0.035);
	}

	private _crash(t: number): void {
		this._noiseHit(t, 'highpass', 5000, 0.35, 1.2);
	}

	/** Низкий синтовый гул: расстроенные пилы, фильтр медленно открывается и закрывается — «дыхание» ада. */
	private _drone(t: number, freq: number, duration: number): void {
		const ctx = this.ctx!;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.Q.value = 8;
		filter.frequency.setValueAtTime(120, t);
		filter.frequency.linearRampToValueAtTime(600, t + duration * 0.5);
		filter.frequency.linearRampToValueAtTime(150, t + duration);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.linearRampToValueAtTime(0.18, t + 0.8);
		gain.gain.setValueAtTime(0.18, t + duration - 0.8);
		gain.gain.linearRampToValueAtTime(0.0001, t + duration);
		filter.connect(gain);
		gain.connect(this.master!);
		for (const detune of [-20, 0, 20]) {
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.value = freq;
			osc.detune.value = detune;
			osc.connect(filter);
			osc.start(t);
			osc.stop(t + duration + 0.05);
		}
	}

	/** Удар шума через фильтр — основа хэтов, малого, тарелки и щелчка бочки. */
	private _noiseHit(t: number, type: BiquadFilterType, freq: number, level: number, decay: number, q = 1): void {
		const ctx = this.ctx!;
		const source = ctx.createBufferSource();
		source.buffer = this.noise;
		source.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.value = freq;
		filter.Q.value = q;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(level, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(this.master!);
		source.start(t, Math.random() * 0.3);
		source.stop(t + decay + 0.02);
	}
}
