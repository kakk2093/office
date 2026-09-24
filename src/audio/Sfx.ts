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

	/**
	 * Поднос с посудой падает на кафель: глухой удар, резкий треск фаянса и россыпь звонких осколков,
	 * пластиковый поднос дребезжит, подпрыгивая.
	 */
	crash(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;

		const thud = this._noiseBurst(0.1);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 280;
		const thudGain = ctx.createGain();
		thudGain.gain.setValueAtTime(1.0, t);
		thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		thud.connect(low);
		low.connect(thudGain);
		thudGain.connect(ctx.destination);
		thud.start(t);

		// Треск: широкий высокий шум, быстро гаснет.
		const smash = this._noiseBurst(0.4);
		const high = ctx.createBiquadFilter();
		high.type = 'highpass';
		high.frequency.value = 1800;
		const smashGain = ctx.createGain();
		smashGain.gain.setValueAtTime(0.55, t);
		smashGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
		smash.connect(high);
		high.connect(smashGain);
		smashGain.connect(ctx.destination);
		smash.start(t);

		// Осколки: звонкие щелчки, гуще сразу после удара, реже к концу.
		for (let i = 0; i < 18; i++) {
			const delay = Math.random() ** 2 * 0.8;
			const clink = this._noiseBurst(0.01);
			const ring = ctx.createBiquadFilter();
			ring.type = 'bandpass';
			ring.frequency.value = 2600 + Math.random() * 4200;
			ring.Q.value = 25;
			const gain = ctx.createGain();
			const level = 0.45 * (1 - delay);
			gain.gain.setValueAtTime(level, t + delay);
			gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05 + Math.random() * 0.1);
			clink.connect(ring);
			ring.connect(gain);
			gain.connect(ctx.destination);
			clink.start(t + delay);
		}

		// Поднос подпрыгивает и дребезжит.
		for (const [delay, level] of [
			[0.14, 0.25],
			[0.24, 0.15],
			[0.3, 0.08],
		] as const) {
			const clack = this._noiseBurst(0.03);
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = 1200;
			band.Q.value = 3;
			const gain = ctx.createGain();
			gain.gain.value = level;
			clack.connect(band);
			band.connect(gain);
			gain.connect(ctx.destination);
			clack.start(t + delay);
		}
	}

	/**
	 * Скример: обитая жестью дверь с грохотом распахивается — тяжёлый удар с металлическим звоном, низкий гул
	 * и резкий диссонансный аккорд (кластер из полутонов), который, затухая, сползает вниз; поверх — визг-скрежет.
	 * Всё через компрессор, чтобы громко, но без хрипа.
	 */
	scare(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		const out = ctx.createDynamicsCompressor();
		out.threshold.value = -12;
		out.ratio.value = 6;
		const master = ctx.createGain();
		master.gain.value = 0.9;
		out.connect(master);
		master.connect(ctx.destination);

		// Удар створки.
		const thud = this._noiseBurst(0.15);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 220;
		const thudGain = ctx.createGain();
		thudGain.gain.setValueAtTime(1.4, t);
		thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		thud.connect(low);
		low.connect(thudGain);
		thudGain.connect(out);
		thud.start(t);
		const hit = this._noiseBurst(0.02);
		for (const [freq, level, decay] of [
			[520, 0.8, 0.5],
			[1350, 0.5, 0.35],
			[2400, 0.3, 0.2],
		] as const) {
			const ring = ctx.createBiquadFilter();
			ring.type = 'bandpass';
			ring.frequency.value = freq;
			ring.Q.value = 20;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(level * 3, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
			hit.connect(ring);
			ring.connect(gain);
			gain.connect(out);
		}
		hit.start(t);

		// Низкий гул, проседающий вниз.
		const sub = ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(58, t);
		sub.frequency.exponentialRampToValueAtTime(34, t + 1.4);
		const subGain = ctx.createGain();
		subGain.gain.setValueAtTime(0.0001, t);
		subGain.gain.linearRampToValueAtTime(0.7, t + 0.02);
		subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
		sub.connect(subGain);
		subGain.connect(out);
		sub.start(t);
		sub.stop(t + 1.7);

		// Аккорд-кластер: полутона рядом режут слух; фильтр закрывается, высота сползает.
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.setValueAtTime(5000, t);
		tone.frequency.exponentialRampToValueAtTime(700, t + 2.2);
		const toneGain = ctx.createGain();
		toneGain.gain.setValueAtTime(0.0001, t);
		toneGain.gain.linearRampToValueAtTime(0.5, t + 0.015);
		toneGain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
		tone.connect(toneGain);
		toneGain.connect(out);
		for (const freq of [110, 116.5, 155.6, 233.1, 246.9, 349.2]) {
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(freq, t);
			osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 2.4);
			osc.detune.value = (Math.random() - 0.5) * 20;
			const gain = ctx.createGain();
			gain.gain.value = 0.18;
			osc.connect(gain);
			gain.connect(tone);
			osc.start(t);
			osc.stop(t + 2.7);
		}

		// Визг: узкая полоса шума скользит сверху вниз.
		const screech = this._noiseBurst(1.0);
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.Q.value = 12;
		band.frequency.setValueAtTime(4200, t);
		band.frequency.exponentialRampToValueAtTime(1400, t + 1.0);
		const screechGain = ctx.createGain();
		screechGain.gain.setValueAtTime(0.0001, t);
		screechGain.gain.linearRampToValueAtTime(1.2, t + 0.02);
		screechGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
		screech.connect(band);
		band.connect(screechGain);
		screechGain.connect(out);
		screech.start(t);
	}

	/**
	 * Цифровой сбой: серия рваных кусочков по 15–50 мс — то «раскрошенный» шум (значение держится по несколько
	 * сэмплов, как при низкой разрядности), то квадратный писк случайной высоты, с резкими обрывами.
	 */
	glitch(duration = 0.4): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		let t = ctx.currentTime + 0.01;
		const end = t + duration;
		while (t < end) {
			const piece = 0.015 + Math.random() * 0.035;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime((0.18 + Math.random() * 0.2) / 4.5, t);
			gain.gain.setValueAtTime(0, t + piece);
			gain.connect(ctx.destination);
			if (Math.random() < 0.55) {
				const length = Math.max(1, Math.floor(ctx.sampleRate * piece));
				const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				const hold = 6 + Math.floor(Math.random() * 40);
				let value = 0;
				for (let i = 0; i < length; i++) {
					if (i % hold === 0) value = Math.random() < 0.5 ? -1 : 1;
					data[i] = value;
				}
				const crunch = ctx.createBufferSource();
				crunch.buffer = buffer;
				crunch.connect(gain);
				crunch.start(t);
			} else {
				const osc = ctx.createOscillator();
				osc.type = 'square';
				osc.frequency.setValueAtTime(80 + Math.random() * 1900, t);
				osc.connect(gain);
				osc.start(t);
				osc.stop(t + piece);
			}
			// Иногда — провал тишины между кусками.
			t += piece + (Math.random() < 0.25 ? 0.02 + Math.random() * 0.03 : 0);
		}
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

	/**
	 * Дуплет из обреза — тяжёлый: два почти слитых выстрела (второй на 12 мс позже). В каждом — короткий треск,
	 * плотный «хлопок» шума с быстро темнеющим фильтром и низкий удар (шумовой низ и короткий синус — не «бочка»).
	 * Для сочности — плотная середина («пух»), щелчок курков в самом начале и короткое отражение от стен.
	 * Поверх — длинный глухой раскат, как эхо в помещении. Лёгкое насыщение — только на низком ударе (плотнее,
	 * без хрипа в шуме); всё вместе — через компрессор, чтобы не клиппило.
	 */
	shotgun(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const drive = ctx.createWaveShaper();
		const curve = new Float32Array(1024);
		for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.3);
		drive.curve = curve;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -8;
		comp.ratio.value = 4;
		comp.attack.value = 0.004;
		comp.release.value = 0.25;
		const master = ctx.createGain();
		master.gain.value = 0.9;
		drive.connect(comp);
		comp.connect(master);
		master.connect(ctx.destination);
		// Короткое отражение от стен (слэпбэк) с парой повторов, каждый глуше, — выстрел звучит «в помещении», объёмнее.
		const echo = ctx.createDelay(0.5);
		echo.delayTime.value = 0.085;
		const echoTone = ctx.createBiquadFilter();
		echoTone.type = 'lowpass';
		echoTone.frequency.value = 1800;
		const feedback = ctx.createGain();
		feedback.gain.value = 0.3;
		const echoOut = ctx.createGain();
		echoOut.gain.value = 0.35;
		comp.connect(echo);
		echo.connect(echoTone);
		echoTone.connect(feedback);
		feedback.connect(echo);
		echoTone.connect(echoOut);
		echoOut.connect(ctx.destination);
		// Петля обратной связи сама не отключится — разрываем, когда эхо отзвучало, иначе копилась бы с каждым выстрелом.
		window.setTimeout(() => {
			feedback.disconnect();
			echo.disconnect();
		}, 2500);
		const t0 = ctx.currentTime + 0.005;

		// Щелчок курков за мгновение до выстрела — механика, «сочность» атаки.
		this._clack(t0, [2400, 4200], 0.25, 0.025);

		for (const [delay, level] of [
			[0, 1],
			[0.012, 0.85],
		] as const) {
			const t = t0 + delay;
			// Треск — коротко и не слишком высоко, чтобы не звучало как хлопушка.
			const crack = this._noiseBurst(0.03);
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = 2200;
			band.Q.value = 0.7;
			const crackGain = ctx.createGain();
			crackGain.gain.setValueAtTime(0.65 * level, t);
			crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
			crack.connect(band);
			band.connect(crackGain);
			crackGain.connect(comp);
			crack.start(t);

			// Хлопок: шум, фильтр быстро закрывается — от яркого к глухому.
			const blast = this._noiseBurst(0.4);
			const low = ctx.createBiquadFilter();
			low.type = 'lowpass';
			low.frequency.setValueAtTime(3000, t);
			low.frequency.exponentialRampToValueAtTime(450, t + 0.25);
			const blastGain = ctx.createGain();
			blastGain.gain.setValueAtTime(1.1 * level, t);
			blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
			blast.connect(low);
			low.connect(blastGain);
			blastGain.connect(comp);
			blast.start(t);

			// Середина — плотный «пух» около 700 Гц: основа сочности, слышна и на маленьких динамиках.
			const punch = this._noiseBurst(0.15);
			const punchBand = ctx.createBiquadFilter();
			punchBand.type = 'bandpass';
			punchBand.frequency.setValueAtTime(900, t);
			punchBand.frequency.exponentialRampToValueAtTime(500, t + 0.12);
			punchBand.Q.value = 0.9;
			const punchGain = ctx.createGain();
			punchGain.gain.setValueAtTime(1.3 * level, t);
			punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
			punch.connect(punchBand);
			punchBand.connect(punchGain);
			punchGain.connect(comp);
			punch.start(t);

			// Низкий удар — «вес» выстрела. Короткий и негромкий: длинный тональный синус звучит как бочка.
			// Основной низ — шумовой (полоса ~160 Гц), без тона.
			const body = this._noiseBurst(0.3);
			const bodyBand = ctx.createBiquadFilter();
			bodyBand.type = 'bandpass';
			bodyBand.frequency.value = 160;
			bodyBand.Q.value = 0.8;
			const bodyGain = ctx.createGain();
			bodyGain.gain.setValueAtTime(1.6 * level, t);
			bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
			body.connect(bodyBand);
			bodyBand.connect(bodyGain);
			bodyGain.connect(drive);
			body.start(t);
			for (const [type, from, to, gain, decay] of [['sine', 120, 45, 0.55, 0.16]] as const) {
				const osc = ctx.createOscillator();
				osc.type = type;
				osc.frequency.setValueAtTime(from, t);
				osc.frequency.exponentialRampToValueAtTime(to, t + decay);
				const g = ctx.createGain();
				g.gain.setValueAtTime(gain * level, t);
				g.gain.exponentialRampToValueAtTime(0.001, t + decay);
				osc.connect(g);
				g.connect(drive);
				osc.start(t);
				osc.stop(t + decay + 0.02);
			}
		}

		// Раскат: глухой шум, быстро нарастает и долго гаснет — эхо.
		const tail = this._noiseBurst(1.5);
		const tailLow = ctx.createBiquadFilter();
		tailLow.type = 'lowpass';
		tailLow.frequency.setValueAtTime(700, t0);
		tailLow.frequency.exponentialRampToValueAtTime(160, t0 + 1.4);
		const tailGain = ctx.createGain();
		tailGain.gain.setValueAtTime(0.0001, t0);
		tailGain.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
		tailGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5);
		tail.connect(tailLow);
		tailLow.connect(tailGain);
		tailGain.connect(comp);
		tail.start(t0);
	}

	/** Дробь попала в тело: глухой влажный шлепок — низкий шум с быстрым спадом и короткий «чавк» повыше. */
	flesh(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;
		const thud = this._noiseBurst(0.12);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.setValueAtTime(700, t);
		low.frequency.exponentialRampToValueAtTime(150, t + 0.1);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.6, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		thud.connect(low);
		low.connect(gain);
		gain.connect(ctx.destination);
		thud.start(t);
		this._soft(t + 0.01, 0.1, 1300, 0.12);
	}

	/**
	 * Тело разрывает: тяжёлый мокрый шлепок, хлюпающий «чавк» (полоса шума мечется по частоте), хруст костей
	 * и следом — шлепки падающих на пол кусков.
	 */
	gore(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;

		const splat = this._noiseBurst(0.4);
		const splatBand = ctx.createBiquadFilter();
		splatBand.type = 'bandpass';
		splatBand.Q.value = 1.2;
		splatBand.frequency.setValueAtTime(500, t);
		splatBand.frequency.exponentialRampToValueAtTime(140, t + 0.3);
		const splatGain = ctx.createGain();
		splatGain.gain.setValueAtTime(1.4, t);
		splatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
		splat.connect(splatBand);
		splatBand.connect(splatGain);
		splatGain.connect(ctx.destination);
		splat.start(t);

		// Хлюпанье: частоту полосы быстро дёргает низкочастотный генератор.
		const squelch = this._noiseBurst(0.35);
		const wet = ctx.createBiquadFilter();
		wet.type = 'bandpass';
		wet.Q.value = 4;
		wet.frequency.value = 700;
		const wobble = ctx.createOscillator();
		wobble.frequency.setValueAtTime(28, t);
		wobble.frequency.linearRampToValueAtTime(12, t + 0.35);
		const wobbleDepth = ctx.createGain();
		wobbleDepth.gain.value = 450;
		wobble.connect(wobbleDepth);
		wobbleDepth.connect(wet.frequency);
		const squelchGain = ctx.createGain();
		squelchGain.gain.setValueAtTime(0.7, t + 0.02);
		squelchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.37);
		squelch.connect(wet);
		wet.connect(squelchGain);
		squelchGain.connect(ctx.destination);
		squelch.start(t + 0.02);
		wobble.start(t);
		wobble.stop(t + 0.4);

		// Хруст: россыпь сухих щелчков в первые 0.1 с.
		for (let i = 0; i < 7; i++) this._clack(t + Math.random() * 0.1, [1400 + Math.random() * 2200], 0.12, 0.03);

		const thump = ctx.createOscillator();
		thump.frequency.setValueAtTime(90, t);
		thump.frequency.exponentialRampToValueAtTime(40, t + 0.15);
		const thumpGain = ctx.createGain();
		thumpGain.gain.setValueAtTime(0.6, t);
		thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		thump.connect(thumpGain);
		thumpGain.connect(ctx.destination);
		thump.start(t);
		thump.stop(t + 0.2);

		// Куски шлёпаются на пол — всё реже и тише.
		for (const [delay, level] of [
			[0.35, 0.35],
			[0.45, 0.25],
			[0.58, 0.3],
			[0.7, 0.18],
			[0.9, 0.14],
			[1.15, 0.08],
		] as const) {
			const drop = this._noiseBurst(0.07);
			const low = ctx.createBiquadFilter();
			low.type = 'lowpass';
			low.frequency.value = 500 + Math.random() * 400;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(level * 2, t + delay);
			gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);
			drop.connect(low);
			low.connect(gain);
			gain.connect(ctx.destination);
			drop.start(t + delay);
		}
	}

	/**
	 * Стон зомби: хриплый низкий голос — две чуть расстроенные пилы (биения), тон плавает вверх-вниз с дрожью,
	 * через две полосы-«гласные» (протяжное «ооо»), с хрипом (амплитуда дёргается ~30 Гц) и сиплым выдохом.
	 * angry — короче, выше и злее («ааа»). volume — по расстоянию, pan — слева/справа (−1..1).
	 */
	zombieGroan(volume: number, pan: number, angry: boolean): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;
		const duration = angry ? 0.8 + Math.random() * 0.4 : 1.4 + Math.random() * 0.8;
		const f0 = (angry ? 135 : 82) * (0.9 + Math.random() * 0.2);

		const out = ctx.createGain();
		out.gain.value = volume * (angry ? 0.5 : 0.4);
		const panner = ctx.createStereoPanner();
		panner.pan.value = pan;
		out.connect(panner);
		panner.connect(ctx.destination);

		// Огибающая с хрипом: основная громкость × дрожание.
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(1, t + (angry ? 0.08 : 0.25));
		env.gain.setValueAtTime(1, t + duration * 0.7);
		env.gain.linearRampToValueAtTime(0.0001, t + duration);
		const rasp = ctx.createGain();
		rasp.gain.value = 0.6;
		const raspLfo = ctx.createOscillator();
		raspLfo.frequency.value = 26 + Math.random() * 10;
		const raspDepth = ctx.createGain();
		raspDepth.gain.value = angry ? 0.4 : 0.3;
		raspLfo.connect(raspDepth);
		raspDepth.connect(rasp.gain);
		env.connect(rasp);
		rasp.connect(out);

		// «Гласные»: полосы, которые медленно сдвигаются — «оо-оа».
		const formants: BiquadFilterNode[] = [];
		for (const [from, to, q, level] of angry
			? ([
					[700, 900, 5, 1],
					[1200, 1500, 6, 0.6],
				] as const)
			: ([
					[380, 520, 5, 1],
					[800, 950, 6, 0.5],
				] as const)) {
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.Q.value = q;
			band.frequency.setValueAtTime(from, t);
			band.frequency.linearRampToValueAtTime(to, t + duration * 0.6);
			band.frequency.linearRampToValueAtTime(from * 0.9, t + duration);
			const g = ctx.createGain();
			g.gain.value = level * 2.2;
			band.connect(g);
			g.connect(env);
			formants.push(band);
		}

		// Голос: тон поднимается и сползает вниз, с дрожью ~6 Гц.
		const vibrato = ctx.createOscillator();
		vibrato.frequency.value = 5 + Math.random() * 2;
		const vibratoDepth = ctx.createGain();
		vibratoDepth.gain.value = f0 * 0.04;
		vibrato.connect(vibratoDepth);
		for (const detune of [1, 1.025]) {
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(f0 * detune * 0.9, t);
			osc.frequency.linearRampToValueAtTime(f0 * detune * 1.15, t + duration * 0.35);
			osc.frequency.linearRampToValueAtTime(f0 * detune * 0.75, t + duration);
			vibratoDepth.connect(osc.frequency);
			for (const band of formants) osc.connect(band);
			osc.start(t);
			osc.stop(t + duration + 0.05);
		}

		// Сиплый выдох поверх голоса.
		const breath = this._noiseBurst(duration);
		const breathBand = ctx.createBiquadFilter();
		breathBand.type = 'bandpass';
		breathBand.frequency.value = angry ? 1600 : 1100;
		breathBand.Q.value = 1;
		const breathGain = ctx.createGain();
		breathGain.gain.value = angry ? 0.35 : 0.2;
		breath.connect(breathBand);
		breathBand.connect(breathGain);
		breathGain.connect(env);
		breath.start(t);

		vibrato.start(t);
		raspLfo.start(t);
		vibrato.stop(t + duration + 0.05);
		raspLfo.stop(t + duration + 0.05);
	}

	/**
	 * Рёв огромного адского пса: очень низкий хриплый голос — несколько расстроенных пил (биения) через «гласную»
	 * «ррааа», с хрипом (амплитуда дёргается ~20 Гц) и перегрузом; под ним — гул на границе слышимости, поверх —
	 * рычащий шум и визг, сползающий вниз. Громко, через компрессор. roar — долгий рёв; dying — предсмертный:
	 * короче, тон падает; hurt — короткий взвизг от попадания; spit — короткий рык перед плевком.
	 */
	bossRoar(kind: 'roar' | 'dying' | 'hurt' | 'spit'): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.02;
		const dying = kind === 'dying' || kind === 'hurt';
		const duration = { roar: 3.2, dying: 3.5, hurt: 0.7, spit: 0.9 }[kind];
		const f0 = { roar: 52, dying: 62, hurt: 85, spit: 48 }[kind];

		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 8;
		comp.attack.value = 0.005;
		comp.release.value = 0.3;
		const master = ctx.createGain();
		master.gain.value = 0.5;
		comp.connect(master);
		master.connect(ctx.destination);

		// Перегруз — рёв «рвётся».
		const drive = ctx.createWaveShaper();
		const curve = new Float32Array(1024);
		for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 4);
		drive.curve = curve;
		drive.connect(comp);

		// Огибающая с хрипом: нарастает, держится, спадает; поверх — дрожание амплитуды.
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(1, t + (dying ? 0.1 : 0.3));
		env.gain.setValueAtTime(1, t + duration * 0.65);
		env.gain.linearRampToValueAtTime(0.0001, t + duration);
		const rasp = ctx.createGain();
		rasp.gain.value = 0.6;
		const raspLfo = ctx.createOscillator();
		raspLfo.frequency.value = 19;
		const raspDepth = ctx.createGain();
		raspDepth.gain.value = 0.4;
		raspLfo.connect(raspDepth);
		raspDepth.connect(rasp.gain);
		env.connect(rasp);
		rasp.connect(drive);

		// «Гласная»: полосы раскрываются («рра-») и закрываются («-ааа» → «ыы»).
		const formants: BiquadFilterNode[] = [];
		for (const [from, peak, q, level] of [
			[280, 620, 4, 1],
			[700, 1250, 5, 0.6],
			[2200, 2800, 6, 0.25],
		] as const) {
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.Q.value = q;
			band.frequency.setValueAtTime(from, t);
			band.frequency.linearRampToValueAtTime(peak, t + duration * 0.3);
			band.frequency.linearRampToValueAtTime(from * 0.8, t + duration);
			const g = ctx.createGain();
			g.gain.value = level * 3;
			band.connect(g);
			g.connect(env);
			formants.push(band);
		}

		// Голос: тон взмывает и сползает вниз (у предсмертного — падает сильнее), с дрожью.
		const vibrato = ctx.createOscillator();
		vibrato.frequency.value = 6;
		const vibratoDepth = ctx.createGain();
		vibratoDepth.gain.value = f0 * 0.05;
		vibrato.connect(vibratoDepth);
		for (const detune of [1, 1.018, 0.985, 1.5]) {
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(f0 * detune * 0.8, t);
			osc.frequency.linearRampToValueAtTime(f0 * detune * 1.3, t + duration * 0.25);
			osc.frequency.exponentialRampToValueAtTime(f0 * detune * (dying ? 0.45 : 0.75), t + duration);
			vibratoDepth.connect(osc.frequency);
			for (const band of formants) osc.connect(band);
			osc.start(t);
			osc.stop(t + duration + 0.05);
		}

		// Рычащий шум — из глотки.
		const growl = this._noiseBurst(duration);
		const growlBand = ctx.createBiquadFilter();
		growlBand.type = 'lowpass';
		growlBand.frequency.setValueAtTime(700, t);
		growlBand.frequency.linearRampToValueAtTime(1600, t + duration * 0.3);
		growlBand.frequency.linearRampToValueAtTime(400, t + duration);
		const growlGain = ctx.createGain();
		growlGain.gain.value = 0.8;
		growl.connect(growlBand);
		growlBand.connect(growlGain);
		growlGain.connect(env);
		growl.start(t);

		// Гул — чувствуется больше, чем слышится.
		const sub = ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(40, t);
		sub.frequency.exponentialRampToValueAtTime(28, t + duration);
		const subGain = ctx.createGain();
		subGain.gain.setValueAtTime(0.0001, t);
		subGain.gain.linearRampToValueAtTime(0.8, t + 0.2);
		subGain.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.4);
		sub.connect(subGain);
		subGain.connect(comp);
		sub.start(t);
		sub.stop(t + duration + 0.5);

		// Визг поверх: узкая полоса шума скользит сверху вниз.
		const screech = this._noiseBurst(duration * 0.7);
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.Q.value = 10;
		band.frequency.setValueAtTime(3600, t + 0.1);
		band.frequency.exponentialRampToValueAtTime(900, t + duration * 0.7);
		const screechGain = ctx.createGain();
		screechGain.gain.setValueAtTime(0.0001, t);
		screechGain.gain.linearRampToValueAtTime(0.6, t + 0.2);
		screechGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7);
		screech.connect(band);
		band.connect(screechGain);
		screechGain.connect(comp);
		screech.start(t);

		vibrato.start(t);
		raspLfo.start(t);
		vibrato.stop(t + duration + 0.05);
		raspLfo.stop(t + duration + 0.05);
	}

	/** Огненный шар вылетел: гулкий «вжух» — шум через полосу, скользящую вниз, и низкий гул пламени. */
	fireball(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		const whoosh = this._noiseBurst(1.2);
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.Q.value = 1.5;
		band.frequency.setValueAtTime(1800, t);
		band.frequency.exponentialRampToValueAtTime(250, t + 1.1);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.linearRampToValueAtTime(0.9, t + 0.08);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
		whoosh.connect(band);
		band.connect(gain);
		gain.connect(ctx.destination);
		whoosh.start(t);
		const roar = this._noiseBurst(1.2);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 180;
		const lowGain = ctx.createGain();
		lowGain.gain.setValueAtTime(1.2, t);
		lowGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
		roar.connect(low);
		low.connect(lowGain);
		lowGain.connect(ctx.destination);
		roar.start(t);
	}

	/** Взрыв огненного шара: удар шума с темнеющим фильтром и низкий гул; level — громкость (далеко — тише). */
	explosion(level: number): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -10;
		comp.ratio.value = 6;
		const master = ctx.createGain();
		master.gain.value = level;
		comp.connect(master);
		master.connect(ctx.destination);
		const blast = this._noiseBurst(1.0);
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(4000, t);
		filter.frequency.exponentialRampToValueAtTime(150, t + 0.8);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(1.6, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
		blast.connect(filter);
		filter.connect(gain);
		gain.connect(comp);
		blast.start(t);
		const sub = ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(70, t);
		sub.frequency.exponentialRampToValueAtTime(30, t + 0.6);
		const subGain = ctx.createGain();
		subGain.gain.setValueAtTime(1, t);
		subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
		sub.connect(subGain);
		subGain.connect(comp);
		sub.start(t);
		sub.stop(t + 0.75);
	}

	/** Запертую стеклянную дверь дёргают: лязг ручки и замка, дребезг стекла в раме — несколько рывков подряд. */
	doorRattle(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		for (const [delay, level] of [
			[0, 1],
			[0.16, 0.8],
			[0.3, 0.9],
			[0.47, 0.6],
			[0.62, 0.4],
		] as const) {
			this._clack(t + delay, [650 + Math.random() * 150, 1700, 3200 + Math.random() * 500], 0.3 * level, 0.08);
			// Стекло дребезжит чуть позже рывка.
			this._clack(t + delay + 0.02, [4200 + Math.random() * 800, 5600], 0.08 * level, 0.12);
			this._soft(t + delay, 0.05, 400, 0.15 * level);
		}
	}

	/** Игрока ударили: глухой удар по телу и короткий сдавленный выдох героя. */
	playerHurt(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		const hit = this._noiseBurst(0.12);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.setValueAtTime(900, t);
		low.frequency.exponentialRampToValueAtTime(160, t + 0.1);
		const hitGain = ctx.createGain();
		hitGain.gain.setValueAtTime(1.1, t);
		hitGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
		hit.connect(low);
		low.connect(hitGain);
		hitGain.connect(ctx.destination);
		hit.start(t);

		// Выдох «ых»: низкий голос через «гласную», быстро гаснет, тон падает.
		const voice = ctx.createOscillator();
		voice.type = 'sawtooth';
		voice.frequency.setValueAtTime(150, t + 0.03);
		voice.frequency.exponentialRampToValueAtTime(95, t + 0.25);
		const vowel = ctx.createBiquadFilter();
		vowel.type = 'bandpass';
		vowel.frequency.value = 600;
		vowel.Q.value = 3;
		const voiceGain = ctx.createGain();
		voiceGain.gain.setValueAtTime(0.0001, t + 0.03);
		voiceGain.gain.linearRampToValueAtTime(0.3, t + 0.06);
		voiceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
		voice.connect(vowel);
		vowel.connect(voiceGain);
		voiceGain.connect(ctx.destination);
		voice.start(t + 0.03);
		voice.stop(t + 0.3);
		this._soft(t + 0.03, 0.2, 1500, 0.1);
	}

	/** Обрез достают: шорох одежды и лязг металла, когда его перехватывают в руках. */
	shotgunDraw(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._soft(t, 0.25, 1800, 0.08);
		this._clack(t + 0.3, [900, 2300], 0.2, 0.06);
	}

	/** Обрез убирают: шорох одежды и глухой стук. */
	shotgunHolster(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._soft(t, 0.25, 1500, 0.08);
		this._clack(t + 0.22, [500, 1300], 0.12, 0.05);
	}

	/** Обрез переламывают: щелчок рычага запирания и металлический лязг стволов на шарнире. */
	shotgunOpen(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._latch(ctx.destination, t);
		this._clack(t + 0.12, [1100, 2600], 0.25, 0.07);
	}

	/** Экстракторы выкидывают две гильзы: лёгкий лязг, потом гильзы звякают об пол. */
	shotgunEject(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._clack(t, [1800, 3900], 0.15, 0.05);
		for (const delay of [0.38, 0.46, 0.6]) this._clack(t + delay, [2900 + Math.random() * 800, 5200], 0.07, 0.06);
	}

	/** Патрон досылают в патронник: пластиковый шорох и глухой щелчок закраины. */
	shotgunInsert(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._soft(t, 0.08, 2200, 0.06);
		this._clack(t + 0.06, [900, 2000], 0.18, 0.04);
	}

	/** Стволы защёлкивают: тяжёлый металлический «клац» и низкий стук. */
	shotgunClose(): void {
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime + 0.01;
		this._clack(t, [700, 1900, 3100], 0.35, 0.09);
		const thud = this._noiseBurst(0.04);
		const low = ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 300;
		const gain = ctx.createGain();
		gain.gain.value = 0.5;
		thud.connect(low);
		low.connect(gain);
		gain.connect(ctx.destination);
		thud.start(t);
	}

	/** Короткий металлический стук: щелчок шума через узкие резонансы на заданных частотах. */
	private _clack(start: number, freqs: number[], level: number, decay: number): void {
		const ctx = this._context();
		const hit = this._noiseBurst(0.01);
		for (const freq of freqs) {
			const ring = ctx.createBiquadFilter();
			ring.type = 'bandpass';
			ring.frequency.value = freq;
			ring.Q.value = 12;
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(level * 3, start);
			gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
			hit.connect(ring);
			ring.connect(gain);
			gain.connect(ctx.destination);
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
