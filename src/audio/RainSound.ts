/** Фоновый шум дождя: закольцованный отфильтрованный шум, без файлов. Плавно нарастает при старте. */
export class RainSound {
	private ctx: AudioContext | null = null;
	private started = false;

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
		lowpass.frequency.value = 3200;

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.0125, ctx.currentTime + 1.5);

		// Лёгкая плавающая громкость — иначе ровный шум быстро надоедает.
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 0.07;
		const lfoGain = ctx.createGain();
		lfoGain.gain.value = 0.003;
		lfo.connect(lfoGain);
		lfoGain.connect(gain.gain);
		lfo.start();

		noise.connect(highpass);
		highpass.connect(lowpass);
		lowpass.connect(gain);
		gain.connect(ctx.destination);
		noise.start();
	}
}
