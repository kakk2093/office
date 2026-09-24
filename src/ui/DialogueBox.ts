import type { Dialogue, InteractionSound, Voice } from '../core/Interaction.js';

/** Скорость печати, символов в секунду. */
const CHARS_PER_SECOND = 28;
/** Пауза печати после знаков препинания, с. */
const PUNCTUATION_PAUSE = 0.18;
const ACCENT = '#e3b25a';

/**
 * Окно диалога внизу экрана: подложка, имя говорящего и текст с эффектом печатной машинки;
 * в углу — «ЛКМ ▶» (тусклая, пока реплика печатается; мигает, когда допечатана).
 * onBlip — на каждую вторую напечатанную букву: Game играет писк голоса говорящего.
 */
export class DialogueBox {
	private readonly root = document.createElement('div');
	private readonly speaker = document.createElement('div');
	private readonly text = document.createElement('div');
	private readonly hint = document.createElement('div');
	private dialogue: Dialogue | null = null;
	private lineIndex = 0;
	/** Сколько символов текущей реплики уже напечатано (дробное — копится по времени). */
	private shown = 0;
	private pause = 0;
	private time = 0;
	onBlip: ((voice: Voice) => void) | null = null;
	/** Разговор закончен — Game играет его endSound. */
	onEnd: ((sound: InteractionSound | undefined) => void) | null = null;

	constructor() {
		Object.assign(this.root.style, {
			position: 'fixed',
			left: '50%',
			bottom: '24px',
			transform: 'translateX(-50%)',
			width: 'min(860px, 92vw)',
			minHeight: '96px',
			boxSizing: 'border-box',
			padding: '14px 20px 30px',
			background: 'rgba(22, 8, 10, 0.88)',
			border: `2px solid ${ACCENT}`,
			borderRadius: '8px',
			color: '#f1e8d6',
			font: '20px/1.4 system-ui, sans-serif',
			textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
			pointerEvents: 'none',
			userSelect: 'none',
			display: 'none',
			zIndex: '6',
		});
		Object.assign(this.speaker.style, { color: ACCENT, font: 'bold 15px system-ui, sans-serif', marginBottom: '6px' });
		Object.assign(this.text.style, { fontWeight: '600', whiteSpace: 'pre-wrap' });
		Object.assign(this.hint.style, {
			position: 'absolute',
			right: '16px',
			bottom: '8px',
			font: 'bold 13px system-ui, sans-serif',
			color: ACCENT,
		});
		this.hint.textContent = 'ЛКМ ▶';
		this.root.append(this.speaker, this.text, this.hint);
		document.body.appendChild(this.root);
	}

	get active(): boolean {
		return this.dialogue !== null;
	}

	start(dialogue: Dialogue): void {
		this.dialogue = dialogue;
		this.lineIndex = 0;
		this.shown = 0;
		this.pause = 0;
		this.root.style.display = 'block';
		this._render();
	}

	/** ЛКМ: если реплика ещё печатается — допечатать сразу; иначе — следующая реплика или конец разговора. */
	advance(): void {
		const dialogue = this.dialogue;
		if (!dialogue) return;
		const text = dialogue.lines[this.lineIndex].text;
		if (this.shown < text.length) {
			this.shown = text.length;
			this._render();
			return;
		}
		this.lineIndex++;
		this.shown = 0;
		this.pause = 0;
		if (this.lineIndex >= dialogue.lines.length) {
			this.dialogue = null;
			this.root.style.display = 'none';
			dialogue.onEnd?.();
			this.onEnd?.(dialogue.endSound);
			return;
		}
		this._render();
	}

	update(dt: number): void {
		if (!this.dialogue) return;
		this.time += dt;
		const line = this.dialogue.lines[this.lineIndex];
		if (this.shown < line.text.length) {
			if (this.pause > 0) {
				this.pause -= dt;
			} else {
				const before = Math.floor(this.shown);
				this.shown = Math.min(line.text.length, this.shown + dt * CHARS_PER_SECOND);
				const after = Math.floor(this.shown);
				for (let i = before; i < after; i++) {
					const char = line.text[i];
					// Писк — на каждую вторую букву, чтобы голос не трещал; после знаков препинания — пауза.
					if (/[\p{L}\d]/u.test(char) && i % 2 === 0) this.onBlip?.(line.voice);
					if (/[.,!?…—]/.test(char)) {
						this.pause = PUNCTUATION_PAUSE;
						this.shown = i + 1;
						break;
					}
				}
			}
		}
		this._render();
	}

	private _render(): void {
		if (!this.dialogue) return;
		const line = this.dialogue.lines[this.lineIndex];
		if (this.speaker.textContent !== line.speaker) this.speaker.textContent = line.speaker;
		const visible = line.text.slice(0, Math.floor(this.shown));
		if (this.text.textContent !== visible) this.text.textContent = visible;
		const done = this.shown >= line.text.length;
		this.hint.style.opacity = done && Math.floor(this.time * 2.5) % 2 === 0 ? '1' : '0.35';
	}
}
