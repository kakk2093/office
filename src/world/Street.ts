import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import { Rain } from './Rain.js';
import { createBench, createTrashBin, createTree, createSandbox, createFenceTexture, createGate } from './YardProps.js';

const SIZE = 120;
const FOG_FAR = 55;
const SKY_COLOR = '#b3ac9e';

const FLOORS = 17;
const FLOOR_HEIGHT = 3;
const BUILDING_WIDTH = 24;
const BUILDING_DEPTH = 12;
const BUILDING_HEIGHT = FLOORS * FLOOR_HEIGHT;
/** Фасад подъезда — по оси Z, лицом на юг (к игроку). */
const FACADE_Z = -8;

/** Двор, огороженный забором: прямоугольник вокруг дома, с калиткой в заборе со стороны спавна. */
const YARD_MIN_X = -16;
const YARD_MAX_X = 16;
const YARD_MIN_Z = -22;
const YARD_MAX_Z = 12;
const GATE_HALF = 1.0;
/** Выше игрока (глаза на 1.7): забор не перешагнуть и не заглянуть за него. */
const FENCE_HEIGHT = 2.2;
const FENCE_BAR_SPACING = 1.0;
const GATE_ANIM_TIME = 0.5;

export interface SpawnPoint {
	x: number;
	z: number;
}

export interface GatePoint {
	x: number;
	z: number;
}

/** Улица — отдельная сцена вне офиса, с ним никак не связана. 17-этажный дом с одним подъездом,
 * тусклый пасмурный осенний день. */
export class Street {
	readonly scene = new THREE.Scene();
	/** У чёрной двери слева от подъезда — сюда переносит игрока переход с улицы. */
	readonly spawnPoint: SpawnPoint = { x: -2.5, z: -5 };
	/** Калитка в заборе — со стороны спавна. */
	readonly gate: GatePoint = { x: 0, z: YARD_MAX_Z };
	private readonly rain = new Rain();
	/** Начало координат полотна калитки — на петле (см. createGate): анимация — поворот группы. */
	private readonly gateLeaf = createGate(GATE_HALF * 2, FENCE_HEIGHT);
	private gateOpenState = false;
	private readonly gateClosedRot = 0;
	/** Открыта наружу двора: полотно лежит вдоль забора. */
	private readonly gateOpenRot = -Math.PI / 2;
	private gateAnimFrom = this.gateClosedRot;
	private gateAnimTo = this.gateClosedRot;
	private gateAnimT = 1;
	private gateColliders: { x: number; z: number; radius: number }[] = [];

	get isGateOpen(): boolean {
		return this.gateOpenState;
	}

	constructor(private readonly colliders: CircleColliders) {
		this.scene.background = new THREE.Color(SKY_COLOR);
		this.scene.fog = new THREE.Fog(SKY_COLOR, 10, FOG_FAR);
		this.scene.add(new THREE.AmbientLight('#ffffff', 0.65));
		const sun = new THREE.DirectionalLight('#d7d0c0', 0.5);
		sun.position.set(4, 6, 3);
		this.scene.add(sun);

		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(SIZE, SIZE),
			new THREE.MeshStandardMaterial({ color: '#8b8479' })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.receiveShadow = true;
		this.scene.add(ground);

		this._buildBuilding();
		this._buildBlackDoor();
		this._registerFacadeColliders(colliders);
		this._buildFence(colliders);
		this._buildGate();
		this._buildYardProps();

		this.scene.add(this.rain.points);
	}

	/** Пол ровный: высота везде 0. */
	getHeightAt(_x: number, _z: number): number {
		return 0;
	}

	/** Дождь и анимация калитки — на каждый кадр. */
	update(dt: number, cameraPosition: THREE.Vector3): void {
		this.rain.update(dt, cameraPosition);
		if (this.gateAnimT < 1) {
			this.gateAnimT = Math.min(1, this.gateAnimT + dt / GATE_ANIM_TIME);
			const eased = 1 - (1 - this.gateAnimT) ** 3;
			this.gateLeaf.rotation.y = THREE.MathUtils.lerp(this.gateAnimFrom, this.gateAnimTo, eased);
		}
	}

	/** E у калитки: переключает открыто/закрыто, полотно плавно поворачивается на петле; коллайдер снимается/ставится. */
	toggleGate(): void {
		this.gateOpenState = !this.gateOpenState;
		this.gateAnimFrom = this.gateLeaf.rotation.y;
		this.gateAnimTo = this.gateOpenState ? this.gateOpenRot : this.gateClosedRot;
		this.gateAnimT = 0;

		if (this.gateOpenState) {
			for (const c of this.gateColliders) this.colliders.remove(c);
			this.gateColliders = [];
		} else {
			const mid = this.colliders.add(this.gate.x, this.gate.z, GATE_HALF * 0.72);
			this.gateColliders = [mid];
		}
	}

	/** 17-этажный белый дом, окна — процедурная пиксельная текстура на весь объём (низкополи: один бокс). */
	private _buildBuilding(): void {
		const mat = new THREE.MeshStandardMaterial({ color: '#e9e6dd', map: this._createWindowsTexture() });
		const building = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_WIDTH, BUILDING_HEIGHT, BUILDING_DEPTH), mat);
		building.position.set(0, BUILDING_HEIGHT / 2, FACADE_Z - BUILDING_DEPTH / 2);
		building.castShadow = true;
		building.receiveShadow = true;
		this.scene.add(building);

		// Вход в подъезд — тёмный остеклённый проём с козырьком, по центру фасада.
		const entrance = new THREE.Mesh(
			new THREE.PlaneGeometry(2.0, 2.3),
			new THREE.MeshStandardMaterial({ color: '#2b2c2e' })
		);
		entrance.position.set(0, 1.15, FACADE_Z + 0.02);
		this.scene.add(entrance);

		const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.8), new THREE.MeshStandardMaterial({ color: '#c9c5ba' }));
		canopy.position.set(0, 2.5, FACADE_Z + 0.4);
		canopy.castShadow = true;
		this.scene.add(canopy);
	}

	/** Чёрная дверь слева от подъезда — точка появления, просто декоративная (не открывается). */
	private _buildBlackDoor(): void {
		const door = new THREE.Mesh(
			new THREE.BoxGeometry(0.9, 2.0, 0.06),
			new THREE.MeshStandardMaterial({ color: '#141414' })
		);
		door.position.set(this.spawnPoint.x, 1.0, FACADE_Z + 0.03);
		door.castShadow = true;
		this.scene.add(door);

		const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: '#8a867c' }));
		handle.position.set(this.spawnPoint.x + 0.3, 1.0, FACADE_Z + 0.06);
		this.scene.add(handle);
	}

	/** Калитка в проёме забора (петля — с западного края), закрыта по умолчанию. */
	private _buildGate(): void {
		this.gateLeaf.position.set(-GATE_HALF, 0, this.gate.z);
		this.gateLeaf.rotation.y = this.gateClosedRot;
		this.scene.add(this.gateLeaf);

		const mid = this.colliders.add(this.gate.x, this.gate.z, GATE_HALF * 0.72);
		this.gateColliders = [mid];
	}

	/** Не даём пройти сквозь фасад — ряд кругов вдоль передней стены дома (с запасом, чтобы не было просветов). */
	private _registerFacadeColliders(colliders: CircleColliders): void {
		const count = 6;
		const radius = 2.5;
		const step = BUILDING_WIDTH / (count - 1);
		for (let i = 0; i < count; i++) {
			const x = -BUILDING_WIDTH / 2 + i * step;
			colliders.add(x, FACADE_Z, radius);
		}
	}

	/** Железный забор по периметру двора: 4 стороны, с калиткой-проёмом в южной (со стороны спавна). */
	private _buildFence(colliders: CircleColliders): void {
		this._fenceSide(YARD_MIN_X, -GATE_HALF, YARD_MAX_Z, YARD_MAX_Z, colliders);
		this._fenceSide(GATE_HALF, YARD_MAX_X, YARD_MAX_Z, YARD_MAX_Z, colliders);
		this._fenceSide(YARD_MIN_X, YARD_MAX_X, YARD_MIN_Z, YARD_MIN_Z, colliders);
		this._fenceSide(YARD_MIN_X, YARD_MIN_X, YARD_MIN_Z, YARD_MAX_Z, colliders);
		this._fenceSide(YARD_MAX_X, YARD_MAX_X, YARD_MIN_Z, YARD_MAX_Z, colliders);
	}

	/** Один прямой отрезок забора между (x1,z1) и (x2,z2) — плоскость с текстурой прутьев + коллайдеры вдоль линии. */
	private _fenceSide(x1: number, x2: number, z1: number, z2: number, colliders: CircleColliders): void {
		const dx = x2 - x1;
		const dz = z2 - z1;
		const length = Math.hypot(dx, dz);
		if (length < 0.01) return;
		const vertical = Math.abs(dx) < Math.abs(dz);

		const mat = new THREE.MeshStandardMaterial({
			map: createFenceTexture(Math.max(1, Math.round(length / FENCE_BAR_SPACING))),
			transparent: true,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, FENCE_HEIGHT), mat);
		mesh.position.set((x1 + x2) / 2, FENCE_HEIGHT / 2, (z1 + z2) / 2);
		if (vertical) mesh.rotation.y = Math.PI / 2;
		this.scene.add(mesh);

		const segments = Math.max(2, Math.round(length / 3));
		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			colliders.add(x1 + dx * t, z1 + dz * t, 1.7);
		}
	}

	/** Скамейки, урны, деревья, песочница — чтобы двор читался как дворик многоквартирного дома. */
	private _buildYardProps(): void {
		const bench1 = createBench();
		bench1.position.set(6, 0, -2);
		bench1.rotation.y = -Math.PI / 2;
		this.scene.add(bench1);

		const bench2 = createBench();
		bench2.position.set(-8, 0, 3);
		bench2.rotation.y = Math.PI / 2;
		this.scene.add(bench2);

		const bin1 = createTrashBin();
		bin1.position.set(7.4, 0, -3);
		this.scene.add(bin1);

		const bin2 = createTrashBin();
		bin2.position.set(-6.6, 0, 4);
		this.scene.add(bin2);

		for (const [x, z] of [
			[10, -4],
			[-11, -3],
			[9, 7],
		] as const) {
			const tree = createTree();
			tree.position.set(x, 0, z);
			this.scene.add(tree);
		}

		const sandbox = createSandbox();
		sandbox.position.set(2.5, 0, 9);
		this.scene.add(sandbox);
	}

	/** Сетка окон — низкое разрешение и NearestFilter дают пиксельный вид, как у остальной сцены. */
	private _createWindowsTexture(): THREE.CanvasTexture {
		const cols = 10;
		const w = 80;
		const h = FLOORS * 8;
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#e9e6dd';
		ctx.fillRect(0, 0, w, h);

		const cellW = w / cols;
		const cellH = h / FLOORS;
		ctx.fillStyle = '#3c4b52';
		for (let floor = 0; floor < FLOORS; floor++) {
			for (let col = 0; col < cols; col++) {
				const x = col * cellW + cellW * 0.2;
				const y = floor * cellH + cellH * 0.25;
				ctx.fillRect(x, y, cellW * 0.6, cellH * 0.5);
			}
		}

		const texture = new THREE.CanvasTexture(canvas);
		texture.magFilter = THREE.NearestFilter;
		texture.minFilter = THREE.NearestFilter;
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}
}
