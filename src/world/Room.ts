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

export interface RoomBounds {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

/** Простой офис: пол/стены/потолок, окна на одной стене, два ряда столов с мониторами и стульями. */
export class Room {
	readonly scene = new THREE.Scene();
	readonly bounds: RoomBounds = { minX: -WIDTH / 2, maxX: WIDTH / 2, minZ: -DEPTH / 2, maxZ: DEPTH / 2 };

	constructor(private readonly colliders: CircleColliders) {
		this.scene.background = new THREE.Color('#dfe3e6');
		this.scene.add(new THREE.AmbientLight('#ffffff', 0.7));
		const sun = new THREE.DirectionalLight('#fff3d8', 1);
		sun.position.set(4, 6, 3);
		sun.castShadow = true;
		this.scene.add(sun);

		this._buildShell();
		this._buildWindows();
		this._buildAc();
		this._buildDeskBlock(-1.9);
		this._buildDeskBlock(1.9);
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
		const east = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT, DEPTH), wallMat);
		east.position.set(WIDTH / 2, HEIGHT / 2, 0);
		const west = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT, DEPTH), wallMat);
		west.position.set(-WIDTH / 2, HEIGHT / 2, 0);
		for (const wall of [north, south, east, west]) {
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
			this.colliders.add(x, z, 0.55);

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
