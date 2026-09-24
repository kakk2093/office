const VOLUME = 0.0125;
const CUTOFF = 3200;
/** Постоянная времени плавного затухания/возврата при смене улица ⇄ помещение, с. */
const INDOOR_FADE = 0.3;

/** Фоновый шум дождя: закольцованный отфильтрованный шум, без файлов. Плавно нарастает при старте. */
export class RainSound {
	private ctx: AudioContext | null = null;
	private started = false;
	/** Отдельное звено «в помещении — тишина»: его двигаем при смене места, не трогая нарастание громкости при старте. */
	private indoorGain: GainNode | null = null;
	/** В помещениях дождя не слышно совсем. */
	private indoor = false;

	private _context(): AudioContext {
		if (!this.ctx) this.ctx = new AudioContext();
		return this.ctx;
	}

	start(): void {
		if (this.started) return;
		this.started = true;
		const ctx = this._context();
		if (ctx.state === 'suspended') void ctx.resume();

		const duration = 2;
		const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

		const noise = ctx.createBufferSource();
		noise.buffer = buffer;
		noise.loop = true;

		// Мягче и глуше, чем обычный «белый шум» — срезаны и низ, и резкие верха, чтобы не резало слух.
		const highpass = ctx.createBiquadFilter();
		highpass.type = 'highpass';
		highpass.frequency.value = 700;

		const lowpass = ctx.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.value = CUTOFF;

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 1.5);

		// Лёгкая плавающая громкость — иначе ровный шум быстро надоедает.
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 0.07;
		const lfoGain = ctx.createGain();
		lfoGain.gain.value = 0.003;
		lfo.connect(lfoGain);
		lfoGain.connect(gain.gain);
		lfo.start();

		const indoorGain = ctx.createGain();
		indoorGain.gain.value = this.indoor ? 0 : 1;
		this.indoorGain = indoorGain;

		noise.connect(highpass);
		highpass.connect(lowpass);
		lowpass.connect(gain);
		gain.connect(indoorGain);
		indoorGain.connect(ctx.destination);
		noise.start();
	}

	/** В помещении дождь плавно стихает до нуля, на улице — плавно возвращается. */
	setIndoor(indoor: boolean): void {
		if (indoor === this.indoor) return;
		this.indoor = indoor;
		if (!this.ctx || !this.indoorGain) return;
		this.indoorGain.gain.setTargetAtTime(indoor ? 0 : 1, this.ctx.currentTime, INDOOR_FADE);
	}
}
