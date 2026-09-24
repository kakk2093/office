const ACCENT = '#e3b25a';
/** Сколько экран гаснет после «Старт», с. */
const FADE_TIME = 0.6;
/** Смена шагов стартового экрана (наушники → описание со «Старт»), с. */
const STEP_FADE_TIME = 0.5;

/**
 * Стартовый экран поверх игры в два шага. Сначала — только крупный мигающий совет надеть наушники и «нажми на экран»;
 * по клику (или клавише) «нажми на экран» гаснет, совет остаётся, под ним появляются описание и кнопка «Старт»
 * (или Enter). Пока экран открыт, игра стоит.
 * onStart вызывается внутри жеста пользователя — в нём можно захватить мышь и включить звук.
 */
export class StartScreen {
	private readonly root = document.createElement('div');
	private started = false;
	/** Первый шаг (наушники) пройден — видны описание и «Старт». */
	private noticeDone = false;
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
			cursor: 'pointer',
			transition: `opacity ${FADE_TIME}s ease`,
		});
		// Совет про наушники — крупно, цветом акцента и медленно пульсирует, чтобы бросался в глаза.
		// Кнопка «Старт» при наведении темнеет: тёмный фон, текст и рамка — цветом акцента. Размер не меняется.
		const style = document.createElement('style');
		style.textContent = `
			@keyframes start-notice-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
			.start-button {
				font: bold 20px system-ui, sans-serif;
				color: #16080a;
				background: ${ACCENT};
				border: 2px solid ${ACCENT};
				border-radius: 6px;
				padding: 12px 48px;
				cursor: pointer;
			}
			.start-button:hover, .start-button:focus-visible {
				color: ${ACCENT};
				background: #16080a;
				outline: none;
			}
		`;
		document.head.appendChild(style);

		// Совет про наушники виден на обоих шагах; «нажми на экран» — только на первом.
		const noticeStep = this._step('28px');
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
		const tap = document.createElement('div');
		tap.textContent = 'и нажми на экран';
		Object.assign(tap.style, { opacity: '0.7', fontSize: '18px', transition: `opacity ${STEP_FADE_TIME}s ease` });
		noticeStep.append(notice, tap);

		// Шаг 2: описание и «Старт» — сначала скрыты.
		const introStep = this._step('36px');
		introStep.style.display = 'none';
		introStep.style.opacity = '0';
		introStep.style.cursor = 'default';
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
		button.className = 'start-button';
		introStep.append(text, button);

		const showIntro = () => {
			if (this.noticeDone) return;
			this.noticeDone = true;
			this.root.style.cursor = 'default';
			tap.style.opacity = '0';
			window.setTimeout(() => {
				tap.remove();
				introStep.style.display = 'flex';
				// Кадр на применение display, иначе переход прозрачности не сыграет.
				requestAnimationFrame(() => requestAnimationFrame(() => (introStep.style.opacity = '1')));
			}, STEP_FADE_TIME * 1000);
		};
		this.root.addEventListener('click', showIntro);
		button.addEventListener('click', () => this._start());
		window.addEventListener('keydown', (e) => {
			if (!this.noticeDone) showIntro();
			// Enter срабатывает, только когда «Старт» уже виден (кнопка появилась).
			else if (e.code === 'Enter' && introStep.style.opacity === '1') this._start();
		});
		this.root.append(noticeStep, introStep);
		document.body.appendChild(this.root);
	}

	get open(): boolean {
		return !this.started;
	}

	/** Колонка одного шага экрана с плавной сменой прозрачности. */
	private _step(gap: string): HTMLDivElement {
		const step = document.createElement('div');
		Object.assign(step.style, {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap,
			transition: `opacity ${STEP_FADE_TIME}s ease`,
		});
		return step;
	}

	/** Убрать экран сразу, без onStart (отладка: старт без стартового экрана). */
	skip(): void {
		this.started = true;
		this.root.remove();
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
