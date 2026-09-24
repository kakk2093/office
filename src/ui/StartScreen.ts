const ACCENT = '#e3b25a';
/** Сколько экран гаснет после «Старт», с. */
const FADE_TIME = 0.6;

/**
 * Стартовый экран поверх игры: крупный мигающий совет надеть наушники, описание и кнопка «Старт» (или Enter).
 * Пока он открыт, игра стоит.
 * onStart вызывается внутри жеста пользователя — в нём можно захватить мышь и включить звук.
 */
export class StartScreen {
	private readonly root = document.createElement('div');
	private started = false;
	onStart: (() => void) | null = null;

	constructor(description: string[]) {
		Object.assign(this.root.style, {
			position: 'fixed',
			inset: '0',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: '36px',
			padding: '24px',
			boxSizing: 'border-box',
			background: '#0b0a0c',
			color: '#f1e8d6',
			font: '600 22px/1.6 system-ui, sans-serif',
			textAlign: 'center',
			zIndex: '10',
			transition: `opacity ${FADE_TIME}s ease`,
		});
		// Совет про наушники — крупно, цветом акцента и медленно пульсирует, чтобы бросался в глаза.
		const style = document.createElement('style');
		style.textContent = '@keyframes start-notice-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }';
		document.head.appendChild(style);
		const notice = document.createElement('div');
		notice.textContent = '🎧 Надень наушники';
		Object.assign(notice.style, {
			color: ACCENT,
			font: 'bold 34px system-ui, sans-serif',
			letterSpacing: '0.04em',
			textTransform: 'uppercase',
			padding: '10px 28px',
			border: `2px solid ${ACCENT}`,
			borderRadius: '8px',
			animation: 'start-notice-pulse 1.6s ease-in-out infinite',
		});
		const text = document.createElement('div');
		text.style.maxWidth = '640px';
		for (const line of description) {
			const p = document.createElement('p');
			p.textContent = line;
			p.style.margin = '0 0 10px';
			text.appendChild(p);
		}
		const button = document.createElement('button');
		button.textContent = 'Старт';
		Object.assign(button.style, {
			font: 'bold 20px system-ui, sans-serif',
			color: '#16080a',
			background: ACCENT,
			border: 'none',
			borderRadius: '6px',
			padding: '12px 48px',
			cursor: 'pointer',
		});
		button.addEventListener('click', () => this._start());
		window.addEventListener('keydown', (e) => {
			if (e.code === 'Enter') this._start();
		});
		this.root.append(notice, text, button);
		document.body.appendChild(this.root);
	}

	get open(): boolean {
		return !this.started;
	}

	private _start(): void {
		if (this.started) return;
		this.started = true;
		this.onStart?.();
		this.root.style.opacity = '0';
		this.root.style.pointerEvents = 'none';
		window.setTimeout(() => this.root.remove(), FADE_TIME * 1000);
	}
}
