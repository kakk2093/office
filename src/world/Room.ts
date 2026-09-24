import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import {
	createDesk,
	createMonitor,
	createChair,
	createWindow,
	createAcUnit,
	createMug,
	createKeyboard,
	createMouse,
	createMuralTexture,
	createDoor,
} from './Furniture.js';

const WIDTH = 10;
const DEPTH = 12;
const HEIGHT = 3;
const WALL_THICKNESS = 0.2;
/** Верх столешницы: createDesk кладёт её центр в y=0.74 при толщине 0.04. */
const DESK_SURFACE_Y = 0.76;
/** Столы в ряду стоят вплотную: шаг равен длине стола (вдвое длиннее обычного). Всего 2 ряда по 3 — 6 столов. */
const SEATS_PER_ROW = 3;
const DESK_LENGTH = 1.8;
const SEAT_SPACING = DESK_LENGTH;
const ROW_CENTER_Z = -1.2;
/** Половина ширины столешницы (0.7) — на этот шаг раздвинуты 2 колонки блока, чтобы столы касались краями. */
const DESK_HALF_WIDTH = 0.35;

/** Дверь в восточной стене: реальный вырез (проём), полотно открывается по E.
 * Сама улица — отдельная сцена (см. Street), сюда не пристроена: за дверью просто небо в проёме. */
const DOOR_WIDTH = 1.0;
const DOOR_HEIGHT = 2.1;
const DOOR_Z = 4.3;
/** Сколько секунд едет полотно между открытым и закрытым положением. */
const DOOR_ANIM_TIME = 0.5;
/** Небо пасмурного дня, видное в проёме открытой двери. */
const SKY_COLOR = '#b3ac9e';

export interface RoomBounds {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

export interface Doorway {
	wallX: number;
	z: number;
	zMin: number;
	zMax: number;
}

/** Простой офис: пол/стены/потолок, окна на одной стене, два ряда столов с мониторами и стульями. */
export class Room {
	readonly scene = new THREE.Scene();
	readonly bounds: RoomBounds = { minX: -WIDTH / 2, maxX: WIDTH / 2, minZ: -DEPTH / 2, maxZ: DEPTH / 2 };
	readonly doorway: Doorway = {
		wallX: WIDTH / 2,
		z: DOOR_Z,
		zMin: DOOR_Z - DOOR_WIDTH / 2,
		zMax: DOOR_Z + DOOR_WIDTH / 2,
	};
	private doorOpenState = false;
	/** Начало координат полотна — на петле (см. createDoor), поэтому анимация — просто поворот группы. */
	private readonly doorLeaf = createDoor(DOOR_WIDTH, DOOR_HEIGHT);
	private readonly doorClosedRot = -Math.PI / 2;
	/** Открыта наружу: полотно лежит вдоль стены, а не поперёк проёма. */
	private readonly doorOpenRot = 0;
	/** Ход анимации: 0 — у старта, 1 — доехало до цели. */
	private doorAnimFrom = this.doorClosedRot;
	private doorAnimTo = this.doorClosedRot;
	private doorAnimT = 1;

	get isDoorOpen(): boolean {
		return this.doorOpenState;
	}

	constructor(private readonly colliders: CircleColliders) {
		// Фон сцены виден только сквозь открытый проём — тусклое небо в тучах снаружи.
		this.scene.background = new THREE.Color(SKY_COLOR);
		this.scene.add(new THREE.AmbientLight('#ffffff', 0.7));
		// Тусклый рассеянный свет пасмурного дня — некоторые лампы в офисе ярче, эта лишь мягкая подсветка.
		const sun = new THREE.DirectionalLight('#d7d0c0', 0.5);
		sun.position.set(4, 6, 3);
		sun.castShadow = true;
		this.scene.add(sun);

		this._buildShell();
		this._buildWindows();
		this._buildAc();
		this._buildDoor();
		this._buildDeskBlock(-1.9);
		this._buildDeskBlock(1.9);
	}

	/** E у двери: переключает открыто/закрыто, полотно плавно поворачивается на петле (см. update). */
	toggleDoor(): void {
		this.doorOpenState = !this.doorOpenState;
		this.doorAnimFrom = this.doorLeaf.rotation.y;
		this.doorAnimTo = this.doorOpenState ? this.doorOpenRot : this.doorClosedRot;
		this.doorAnimT = 0;
	}

	/** Довести анимацию поворота полотна до текущего кадра. */
	update(dt: number): void {
		if (this.doorAnimT >= 1) return;
		this.doorAnimT = Math.min(1, this.doorAnimT + dt / DOOR_ANIM_TIME);
		const eased = 1 - (1 - this.doorAnimT) ** 3;
		this.doorLeaf.rotation.y = THREE.MathUtils.lerp(this.doorAnimFrom, this.doorAnimTo, eased);
	}

	/** Блок из 2 впритык составленных рядов по 3 стола (6 столов), стулья по обе стороны блока. */
	private _buildDeskBlock(centerX: number): void {
		const seatZ = Array.from(
			{ length: SEATS_PER_ROW },
			(_, i) => ROW_CENTER_Z + (i - (SEATS_PER_ROW - 1) / 2) * SEAT_SPACING
		);
		this._buildCeilingLamp(centerX - DESK_HALF_WIDTH, seatZ[1]);
		this._buildCeilingLamp(centerX + DESK_HALF_WIDTH, seatZ[1]);
		this._buildDeskRow(centerX - DESK_HALF_WIDTH, seatZ, -1);
		this._buildDeskRow(centerX + DESK_HALF_WIDTH, seatZ, 1);
	}

	/** Пол ровный: высота везде 0. */
	getHeightAt(_x: number, _z: number): number {
		return 0;
	}

	private _buildShell(): void {
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, DEPTH), new THREE.MeshStandardMaterial({ color: '#2b2c2e' }));
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);

		const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, DEPTH), new THREE.MeshStandardMaterial({ color: '#f2f2f0' }));
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.y = HEIGHT;
		this.scene.add(ceiling);

		const wallMat = new THREE.MeshStandardMaterial({ color: '#eae7df' });
		const muralMat = new THREE.MeshStandardMaterial({ map: createMuralTexture() });
		const north = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, HEIGHT, WALL_THICKNESS), muralMat);
		north.position.set(0, HEIGHT / 2, -DEPTH / 2);
		const south = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, HEIGHT, WALL_THICKNESS), wallMat);
		south.position.set(0, HEIGHT / 2, DEPTH / 2);
		const west = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT, DEPTH), wallMat);
		west.position.set(-WIDTH / 2, HEIGHT / 2, 0);
		for (const wall of [north, south, west]) {
			wall.receiveShadow = true;
			this.scene.add(wall);
		}
		this._buildEastWallWithDoorway(wallMat);
	}

	/** Восточная стена с реальным вырезом под дверь: 2 простенка по бокам + перемычка сверху. */
	private _buildEastWallWithDoorway(wallMat: THREE.Material): void {
		const { zMin, zMax } = this.doorway;

		const northLen = zMin - -DEPTH / 2;
		const northWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT, northLen), wallMat);
		northWall.position.set(WIDTH / 2, HEIGHT / 2, -DEPTH / 2 + northLen / 2);

		const southLen = DEPTH / 2 - zMax;
		const southWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT, southLen), wallMat);
		southWall.position.set(WIDTH / 2, HEIGHT / 2, DEPTH / 2 - southLen / 2);

		const lintelHeight = HEIGHT - DOOR_HEIGHT;
		const lintel = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, lintelHeight, DOOR_WIDTH), wallMat);
		lintel.position.set(WIDTH / 2, DOOR_HEIGHT + lintelHeight / 2, DOOR_Z);

		for (const wall of [northWall, southWall, lintel]) {
			wall.receiveShadow = true;
			this.scene.add(wall);
		}
	}

	private _buildWindows(): void {
		for (const z of [-3, 1]) {
			const pane = createWindow(1.8, 1.4);
			pane.position.set(-WIDTH / 2 + WALL_THICKNESS / 2 + 0.01, 1.6, z);
			pane.rotation.y = Math.PI / 2;
			this.scene.add(pane);
		}
	}

	private _buildAc(): void {
		const ac = createAcUnit();
		ac.position.set(3, HEIGHT - 0.35, -DEPTH / 2 + WALL_THICKNESS / 2 + 0.12);
		this.scene.add(ac);
	}

	/** Полотно двери (закрыто по умолчанию), петля — на северном крае проёма. */
	private _buildDoor(): void {
		this.doorLeaf.position.set(WIDTH / 2 - WALL_THICKNESS / 2 - 0.01, 0, this.doorway.zMin);
		this.doorLeaf.rotation.y = this.doorClosedRot;
		this.scene.add(this.doorLeaf);
	}

	/** Потолочный светильник над рядом столов: светящаяся панель + яркий точечный свет. */
	private _buildCeilingLamp(x: number, z: number): void {
		const panel = new THREE.Mesh(
			new THREE.BoxGeometry(1.6, 0.04, 0.5),
			new THREE.MeshStandardMaterial({ color: '#fff8e6', emissive: '#fff8e6', emissiveIntensity: 1.4 })
		);
		panel.position.set(x, HEIGHT - 0.03, z);
		this.scene.add(panel);

		const light = new THREE.PointLight('#fff3d8', 12, 8, 2);
		light.position.set(x, HEIGHT - 0.25, z);
		light.castShadow = true;
		this.scene.add(light);
	}

	/** Ряд рабочих мест: отдельный стол на каждое место (монитор/клавиатура/мышь/кружка) + стул.
	 * chairSide — в какую сторону от центра блока вынесен стул (наружу блока). */
	private _buildDeskRow(x: number, seatZ: number[], chairSide: -1 | 1): void {
		for (const z of seatZ) {
			const desk = createDesk(DESK_LENGTH);
			desk.position.set(x, 0, z);
			this.scene.add(desk);
			// Один круг не покрывает весь длинный стол — ставим два вдоль его длины.
			this.colliders.add(x, z - DESK_LENGTH / 4, 0.5);
			this.colliders.add(x, z + DESK_LENGTH / 4, 0.5);

			const monitor = createMonitor();
			monitor.position.set(x - chairSide * 0.15, DESK_SURFACE_Y, z);
			monitor.rotation.y = chairSide > 0 ? -Math.PI / 2 : Math.PI / 2;
			this.scene.add(monitor);

			const keyboard = createKeyboard();
			keyboard.position.set(x - chairSide * 0.02, DESK_SURFACE_Y + 0.01, z - 0.02);
			keyboard.rotation.y = Math.PI / 2;
			this.scene.add(keyboard);

			const mouse = createMouse();
			mouse.position.set(x - chairSide * 0.02, DESK_SURFACE_Y + 0.015, z + 0.14);
			this.scene.add(mouse);

			const mug = createMug();
			mug.position.set(x - chairSide * 0.25, DESK_SURFACE_Y, z - 0.15);
			this.scene.add(mug);

			const chair = createChair();
			chair.position.set(x + chairSide * 0.85, 0, z);
			chair.rotation.y = chairSide > 0 ? -Math.PI / 2 : Math.PI / 2;
			this.scene.add(chair);
			this.colliders.add(chair.position.x, chair.position.z, 0.3);
		}
	}
}
