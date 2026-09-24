/** Общая громкость звуков калитки — примерно на уровне скрипа двери офиса. */
const GATE_VOLUME = 0.2;

/** Короткие процедурные звуки объектов — без внешних файлов. */
export class Sfx {
	private ctx: AudioContext | null = null;

	private _context(): AudioContext {
		if (!this.ctx) this.ctx = new AudioContext();
		return this.ctx;
	}

	/** Скрип двери: шум с плывущей узкой полосой частот — вверх при открытии, вниз при закрытии. */
	door(opening: boolean): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();

		const duration = 0.3;
		const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = Math.random() * 2 - 1;
		}

		const noise = ctx.createBufferSource();
		noise.buffer = buffer;

		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.Q.value = 7;
		const [startFreq, endFreq] = opening ? [320, 620] : [620, 320];
		filter.frequency.setValueAtTime(startFreq, ctx.currentTime);
		filter.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.001, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.03);
		gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);

		noise.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);
		noise.start();
		noise.stop(ctx.currentTime + duration);
	}

	/** Поднос снимают со стопки: сухой пластиковый стук о соседний и лёгкий шорох. */
	tray(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		for (const [delay, freq, level] of [
			[0, 1500, 0.22],
			[0.07, 1100, 0.12],
		] as const) {
			const click = this._noiseBurst(0.025);
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = freq;
			band.Q.value = 3;
			const gain = ctx.createGain();
			gain.gain.value = level;
			click.connect(band);
			band.connect(gain);
			gain.connect(ctx.destination);
			click.start(t + delay);
		}
		this._soft(t + 0.02, 0.18, 2400, 0.03);
	}

	/**
	 * Писк голоса при печати реплики (как в старых играх): короткий «слог» — пилообразный тон
	 * через полосовой фильтр-«гласную». Высота и гласная слегка случайны, чтобы звучало как речь.
	 */
	voice(pitch: number): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.005;
		const duration = 0.065;
		const osc = ctx.createOscillator();
		osc.type = 'sawtooth';
		const f = pitch * (0.88 + Math.random() * 0.3);
		osc.frequency.setValueAtTime(f, t);
		osc.frequency.linearRampToValueAtTime(f * (0.92 + Math.random() * 0.12), t + duration);
		const vowel = ctx.createBiquadFilter();
		vowel.type = 'bandpass';
		vowel.frequency.value = 700 + Math.random() * 900;
		vowel.Q.value = 2.5;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.linearRampToValueAtTime(0.09, t + 0.008);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(vowel);
		vowel.connect(gain);
		gain.connect(ctx.destination);
		osc.start(t);
		osc.stop(t + duration + 0.02);
	}

	/** Ложка супа: звяк ложки о край тарелки и хлюпанье, когда ложка у рта (через slurpDelay с). */
	eat(slurpDelay: number): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;
		const clink = this._noiseBurst(0.012);
		const ring = ctx.createBiquadFilter();
		ring.type = 'bandpass';
		ring.frequency.value = 3400 + Math.random() * 400;
		ring.Q.value = 20;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.25, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
		clink.connect(ring);
		ring.connect(gain);
		gain.connect(ctx.destination);
		clink.start(t);
		this._soft(t + slurpDelay, 0.2, 700, 0.07);
	}

	/** Оплата картой: терминал коротко пищит дважды. */
	card(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;
		for (const delay of [0, 0.14]) {
			const osc = ctx.createOscillator();
			osc.type = 'square';
			osc.frequency.value = 2100;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(0.0001, t + delay);
			gain.gain.linearRampToValueAtTime(0.05, t + delay + 0.005);
			gain.gain.setValueAtTime(0.05, t + delay + 0.08);
			gain.gain.linearRampToValueAtTime(0.0001, t + delay + 0.09);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(t + delay);
			osc.stop(t + delay + 0.1);
		}
	}

	/** Фаянсовую тарелку ставят на поднос: короткий звонкий стук. */
	dish(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		const hit = this._noiseBurst(0.02);
		for (const [freq, level, decay] of [
			[2600, 0.35, 0.09],
			[4100, 0.2, 0.06],
		] as const) {
			const ring = ctx.createBiquadFilter();
			ring.type = 'bandpass';
			ring.frequency.value = freq;
			ring.Q.value = 18;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(level, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
			hit.connect(ring);
			ring.connect(gain);
			gain.connect(ctx.destination);
		}
		hit.start(t);
		this._soft(t, 0.05, 600, 0.08);
	}

	/** Кусок хлеба кладут на поднос: мягкий короткий шорох. */
	bread(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		this._soft(ctx.currentTime + 0.01, 0.12, 900, 0.09);
	}

	/** Мягкий шум с плавной атакой и спадом через lowpass — шорох, касание. */
	private _soft(start: number, duration: number, cutoff: number, level: number): void {
		const ctx = this._context();
		const noise = this._noiseBurst(duration);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = cutoff;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.linearRampToValueAtTime(level, start + duration * 0.3);
		gain.gain.linearRampToValueAtTime(0.0001, start + duration);
		noise.connect(low);
		low.connect(gain);
		gain.connect(ctx.destination);
		noise.start(start);
	}

	/**
	 * Железная калитка: при открытии сухой щелчок щеколды и скрип петель, при закрытии — скрип и глухой стук
	 * о столб с коротким металлическим отзвуком. Всё из шума и резонансных фильтров — без «синтезаторных» тонов.
	 */
	gate(opening: boolean): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const out = ctx.createGain();
		out.gain.value = GATE_VOLUME;
		out.connect(ctx.destination);
		const t = ctx.currentTime + 0.01;
		if (opening) {
			this._latch(out, t);
			this._creak(out, t + 0.08, 0.75, true);
		} else {
			this._creak(out, t, 0.5, false);
			this._slam(out, t + 0.48);
		}
	}

	/**
	 * Скрип петли как трение «прилипание-срыв»: серия коротких щелчков с неровным интервалом (учащаются к концу хода
	 * при открытии и замедляются при закрытии), пропущенная через пару узких резонансов металла.
	 */
	private _creak(out: AudioNode, start: number, duration: number, opening: boolean): void {
		const ctx = this._context();
		const rate = ctx.sampleRate;
		const buffer = ctx.createBuffer(1, Math.floor(rate * duration), rate);
		const data = buffer.getChannelData(0);
		let time = 0;
		while (time < duration) {
			const progress = time / duration;
			// Частота рывков, Гц: плавно едет и немного «спотыкается».
			const pulseRate = (opening ? 35 + progress * 45 : 70 - progress * 40) * (0.75 + Math.random() * 0.5);
			const at = Math.floor(time * rate);
			const len = Math.floor(rate * 0.004);
			const amp = 0.5 + Math.random() * 0.5;
			for (let i = 0; i < len && at + i < data.length; i++) data[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len);
			time += 1 / pulseRate;
		}
		const source = ctx.createBufferSource();
		source.buffer = buffer;

		const envelope = ctx.createGain();
		envelope.gain.setValueAtTime(0.0001, start);
		envelope.gain.linearRampToValueAtTime(1, start + 0.08);
		envelope.gain.setValueAtTime(1, start + duration * 0.75);
		envelope.gain.linearRampToValueAtTime(0.0001, start + duration);
		envelope.connect(out);

		for (const [freq, q, level] of [
			[1150, 9, 0.9],
			[2300, 12, 0.5],
		] as const) {
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = freq * (opening ? 1 : 0.92);
			band.Q.value = q;
			const gain = ctx.createGain();
			gain.gain.value = level;
			source.connect(band);
			band.connect(gain);
			gain.connect(envelope);
		}
		source.start(start);
	}

	/** Щеколда: короткий сухой щелчок — высокий шум в несколько миллисекунд. */
	private _latch(out: AudioNode, start: number): void {
		const burst = this._noiseBurst(0.012);
		const ctx = this._context();
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 3200;
		filter.Q.value = 2;
		const gain = ctx.createGain();
		gain.gain.value = 0.22;
		burst.connect(filter);
		filter.connect(gain);
		gain.connect(out);
		burst.start(start);
	}

	/** Полотно бьётся о столб: глухой низкий стук + короткий, быстро гаснущий звон резонансов металла. */
	private _slam(out: AudioNode, start: number): void {
		const ctx = this._context();
		const thud = this._noiseBurst(0.06);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 260;
		const thudGain = ctx.createGain();
		thudGain.gain.setValueAtTime(0.7, start);
		thudGain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
		thud.connect(low);
		low.connect(thudGain);
		thudGain.connect(out);
		thud.start(start);

		const hit = this._noiseBurst(0.015);
		for (const [freq, level, decay] of [
			[640, 0.5, 0.18],
			[1720, 0.35, 0.12],
			[2950, 0.2, 0.08],
		] as const) {
			const ring = ctx.createBiquadFilter();
			ring.type = 'bandpass';
			ring.frequency.value = freq;
			ring.Q.value = 25;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(level * 2.5, start);
			gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
			hit.connect(ring);
			ring.connect(gain);
			gain.connect(out);
		}
		hit.start(start);
	}

	/** Короткий всплеск белого шума с затуханием к концу. */
	private _noiseBurst(duration: number): AudioBufferSourceNode {
		const ctx = this._context();
		const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		return source;
	}
}
