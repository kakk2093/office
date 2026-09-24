import * as THREE from 'three';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { CircleColliders } from '../physics/CircleColliders.js';
import { Room } from '../world/Room.js';
import { PostProcess } from '../render/PostProcess.js';

/** Отступ от стен, на который не пускаем камеру (стены — не коллайдеры, а простой клэмп по границам комнаты). */
const WALL_MARGIN = 0.4;
/** Размер «пикселя» в экранных пикселях: чем больше, тем грубее картинка. */
const PIXEL_SIZE = 4;

/** Композиция: рендерер, цикл, ресайз. Логика — в Room / PlayerController. */
export class Game {
	private readonly renderer = new THREE.WebGLRenderer({ antialias: false });
	private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
	private readonly post = new PostProcess(this.renderer);
	private readonly timer = new THREE.Timer();
	private readonly input: Input;
	private readonly colliders = new CircleColliders();
	private readonly hint = document.getElementById('hint')!;
	readonly room: Room;
	readonly player: PlayerController;

	constructor() {
		this.renderer.setPixelRatio(1);
		this.renderer.shadowMap.enabled = true;
		document.body.appendChild(this.renderer.domElement);

		this.input = new Input(this.renderer.domElement);
		this.room = new Room(this.colliders);
		this.player = new PlayerController(this.camera, this.input, this.room, this.colliders);
		this.player.spawn(0, 4, 0);
		this.room.scene.add(this.camera);

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
		this._clampToRoom();
		this.hint.style.display = this.input.isPointerLocked ? 'none' : 'flex';

		this.post.render(this.room.scene, this.camera);
	}

	/** Стены пока не коллайдеры — просто не пускаем камеру за границы комнаты. */
	private _clampToRoom(): void {
		const { bounds } = this.room;
		const pos = this.camera.position;
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
