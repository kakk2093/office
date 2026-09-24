import * as THREE from 'three';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { CircleColliders } from '../physics/CircleColliders.js';
import { Room } from '../world/Room.js';
import { Street } from '../world/Street.js';
import { PostProcess } from '../render/PostProcess.js';
import { Footsteps } from '../audio/Footsteps.js';
import { Sfx } from '../audio/Sfx.js';
import { Music } from '../audio/Music.js';
import { RainSound } from '../audio/RainSound.js';

/** Отступ от стен, на который не пускаем камеру (стены — не коллайдеры, а простой клэмп по границам). */
const WALL_MARGIN = 0.4;
/** Размер «пикселя» в экранных пикселях: чем больше, тем грубее картинка. */
const PIXEL_SIZE = 4;
/** С какого расстояния до двери появляется подсказка E. */
const DOOR_REACH = 2.2;
/** Вспышка при выходе из офиса: скрывает смену сцены. Мягкая, не резкая. */
const FLASH_IN = 0.35;
const FLASH_HOLD = 0.15;
const FLASH_OUT = 0.6;
const FLASH_COLOR = '#f5d94a';
/** Граница уличного плейна, за которую не пускаем камеру. */
const STREET_HALF = 74;

/** Композиция: рендерер, цикл, ресайз. Логика — в Room / Street / PlayerController. */
export class Game {
	private readonly renderer = new THREE.WebGLRenderer({ antialias: false });
	private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
	private readonly post = new PostProcess(this.renderer);
	private readonly timer = new THREE.Timer();
	private readonly input: Input;
	private readonly colliders = new CircleColliders();
	private readonly streetColliders = new CircleColliders();
	private readonly footsteps = new Footsteps();
	private readonly sfx = new Sfx();
	private readonly music = new Music();
	private readonly rainSound = new RainSound();
	private readonly hint = document.getElementById('hint')!;
	private readonly prompt = document.getElementById('prompt')!;
	private readonly flash = document.getElementById('flash')!;
	/** Время с начала перехода, с; null — переход не идёт. */
	private flashTime: number | null = null;
	private flashTeleported = false;
	/** true — мы на улице: отдельная сцена, офис в этот момент не рендерится и не виден. Переход — только сюда, без возврата. */
	private outside = false;
	readonly room: Room;
	readonly street: Street;
	readonly player: PlayerController;

	constructor() {
		this.renderer.setPixelRatio(1);
		this.renderer.shadowMap.enabled = true;
		document.body.appendChild(this.renderer.domElement);

		this.input = new Input(this.renderer.domElement);
		this.room = new Room(this.colliders);
		this.street = new Street(this.streetColliders);
		this.player = new PlayerController(this.camera, this.input, this.room, this.colliders);
		this.player.onStep = (loud) => this.footsteps.play(loud);
		this.player.spawn(0, 4, 0);
		this.flash.style.background = FLASH_COLOR;

		// Автоплей звука запрещён без жеста пользователя — запускаем музыку на первый клик/клавишу.
		const startMusic = () => this.music.start();
		window.addEventListener('pointerdown', startMusic, { once: true });
		window.addEventListener('keydown', startMusic, { once: true });

		window.addEventListener('resize', () => this._resize());
		this._resize();
	}

	start(): void {
		this.timer.connect(document);
		this.renderer.setAnimationLoop((time) => this._frame(time));
	}

	private _frame(time: number): void {
		this.timer.update(time);
		const dt = Math.min(this.timer.getDelta(), 0.1);

		this.player.update(dt);
		this.room.update(dt);
		this.street.update(dt, this.camera.position);
		this._updateDoor();
		this._updateFlash(dt);
		this._clamp();
		this.hint.style.display = this.input.isPointerLocked ? 'none' : 'flex';

		this.post.render(this.outside ? this.street.scene : this.room.scene, this.camera);
	}

	/** Подсказка E: внутри — у двери офиса, снаружи — у калитки в заборе. */
	private _updateDoor(): void {
		if (this.flashTime !== null) {
			this.prompt.style.display = 'none';
			return;
		}
		if (this.outside) {
			this._updateGate();
			return;
		}

		const { doorway } = this.room;
		const cam = this.camera.position;
		const near = Math.hypot(cam.x - doorway.wallX, cam.z - doorway.z) < DOOR_REACH;
		if (!near) {
			this.prompt.style.display = 'none';
			return;
		}
		this.prompt.textContent = `E — ${this.room.isDoorOpen ? 'закрыть' : 'открыть'} дверь`;
		this.prompt.style.display = 'block';
		if (this.input.consumePress('KeyE')) {
			const opening = !this.room.isDoorOpen;
			this.room.toggleDoor();
			this.sfx.door(opening);
			// Открыли — вспышкой прячем смену сцены и переносим на отдельную уличную сцену (без возврата).
			if (opening) this._beginTransition();
		}
	}

	/** Подсказка E у калитки: открыть/закрыть, коллайдер и полотно двигает Street сам (см. Street.toggleGate). */
	private _updateGate(): void {
		const { gate } = this.street;
		const cam = this.camera.position;
		const near = Math.hypot(cam.x - gate.x, cam.z - gate.z) < DOOR_REACH;
		if (!near) {
			this.prompt.style.display = 'none';
			return;
		}
		this.prompt.textContent = `E — ${this.street.isGateOpen ? 'закрыть' : 'открыть'} калитку`;
		this.prompt.style.display = 'block';
		if (this.input.consumePress('KeyE')) {
			const opening = !this.street.isGateOpen;
			this.street.toggleGate();
			this.sfx.door(opening);
		}
	}

	/** Мягкая жёлтая вспышка на весь экран: в середине хода — смена сцены и телепорт, к концу — исчезает. */
	private _beginTransition(): void {
		this.flashTime = 0;
		this.flashTeleported = false;
	}

	private _updateFlash(dt: number): void {
		if (this.flashTime === null) return;
		this.flashTime += dt;
		const t = this.flashTime;

		if (!this.flashTeleported && t >= FLASH_IN) {
			this._teleport();
			this.flashTeleported = true;
		}

		let opacity: number;
		if (t < FLASH_IN) {
			opacity = t / FLASH_IN;
		} else if (t < FLASH_IN + FLASH_HOLD) {
			opacity = 1;
		} else if (t < FLASH_IN + FLASH_HOLD + FLASH_OUT) {
			opacity = 1 - (t - FLASH_IN - FLASH_HOLD) / FLASH_OUT;
		} else {
			opacity = 0;
			this.flashTime = null;
		}
		this.flash.style.opacity = String(opacity);
	}

	/** Пока экран жёлтый — переключаем сцену и набор коллайдеров у игрока: офис и улица никак не связаны. */
	private _teleport(): void {
		this.outside = true;
		this.player.colliders = this.streetColliders;
		const { spawnPoint } = this.street;
		// Спиной к двери — лицом от дома (дверь и дом позади, к северу).
		this.player.spawn(spawnPoint.x, spawnPoint.z, Math.PI);
		this.rainSound.start();
		this.music.setPercussion(true);
	}

	/** Клэмп по границам текущей сцены — простой прямоугольник; офис и улица не пересекаются в пространстве. */
	private _clamp(): void {
		const pos = this.camera.position;
		if (this.outside) {
			pos.x = THREE.MathUtils.clamp(pos.x, -STREET_HALF, STREET_HALF);
			pos.z = THREE.MathUtils.clamp(pos.z, -STREET_HALF, STREET_HALF);
			return;
		}
		const { bounds } = this.room;
		pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX + WALL_MARGIN, bounds.maxX - WALL_MARGIN);
		pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ + WALL_MARGIN, bounds.maxZ - WALL_MARGIN);
	}

	private _resize(): void {
		// Рисуем в уменьшенном буфере; канвас растягивается на экран CSS (image-rendering: pixelated) — крупные пиксели.
		const width = Math.ceil(window.innerWidth / PIXEL_SIZE);
		const height = Math.ceil(window.innerHeight / PIXEL_SIZE);
		this.renderer.setSize(width, height, false);
		this.post.setSize(width, height);
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
	}
}
