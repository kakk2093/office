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
}
