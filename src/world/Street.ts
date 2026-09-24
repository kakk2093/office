import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import { Rain } from './Rain.js';
import { Sky, SKY_HORIZON, SUN_DIRECTION } from './Sky.js';
import { createPanelBuilding, createCanteen, createYardRoadTexture, PANEL_BUILDING_DEPTH, CANTEEN_SIZE } from './Buildings.js';
import {
	createBench,
	createTrashBin,
	createTree,
	createSandbox,
	createFenceTexture,
	createGate,
	createBush,
	createLampPost,
	createPullUpBar,
	createCarpetRack,
	createSwing,
	createSlide,
	createCar,
	createPuddle,
	createLeafLitter,
	createNoiseTexture,
} from './YardProps.js';

const SIZE = 120;
/** Пасмурная дымка: верх дома и дальние планы размываются, двор виден чётко. */
const FOG_NEAR = 6;
const FOG_FAR = 42;

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
/** Дворовая дорога за забором (вдоль X) и столовая в её восточном конце. */
const ROAD_X1 = -50;
const ROAD_X2 = 30;
const ROAD_Z1 = YARD_MAX_Z + 3;
const ROAD_Z2 = ROAD_Z1 + 5;
const CANTEEN_X = 40;
/** Коллайдеры забора: шаг меньше диаметра игрока (0.7) — между кругами не протиснуться. */
const FENCE_COLLIDER_STEP = 0.5;
const FENCE_COLLIDER_RADIUS = 0.25;

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
	private readonly sky = new Sky();
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
		// Туман — цвета горизонта: дальние планы растворяются в небе, а не в сером пятне.
		this.scene.background = new THREE.Color(SKY_HORIZON);
		this.scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);
		this.scene.add(new THREE.HemisphereLight('#b3b6b9', '#5f5648', 0.95));
		const sun = new THREE.DirectionalLight('#c9c8c4', 0.25);
		sun.position.copy(SUN_DIRECTION).multiplyScalar(20);
		this.scene.add(sun);
		this.scene.add(this.sky.group);

		this._buildGround();
		this._buildBuilding();
		this._buildBlackDoor();
		this._registerFacadeColliders(colliders);
		this._buildFence(colliders);
		this._buildGate();
		this._buildYardProps();
		this._buildDistrict();

		this.scene.add(this.rain.points);
	}

	/** Пол ровный: высота везде 0. */
	getHeightAt(_x: number, _z: number): number {
		return 0;
	}

	/** Дождь, облака и анимация калитки — на каждый кадр. */
	update(dt: number, cameraPosition: THREE.Vector3): void {
		this.rain.update(dt, cameraPosition);
		this.sky.update(dt, cameraPosition);
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

	/** Земля: осенняя трава с проплешинами везде, поверх — асфальт дорожек и парковок, площадка с песком. */
	private _buildGround(): void {
		const grass = new THREE.Mesh(
			new THREE.PlaneGeometry(SIZE, SIZE),
			new THREE.MeshStandardMaterial({
				map: createNoiseTexture(['#7d7e48', '#88844c', '#767843', '#948652', '#837547', '#78804b'], SIZE / 4, SIZE / 4),
			})
		);
		grass.rotation.x = -Math.PI / 2;
		grass.receiveShadow = true;
		this.scene.add(grass);

		const asphalt = ['#5c5d5f', '#58595b', '#616264', '#555658'];
		// [x1, x2, z1, z2] — прямоугольники асфальта во дворе.
		const paved: [number, number, number, number][] = [
			[-12.5, 12.5, -8, -5.2], // тротуар вдоль фасада
			[-1.4, 1.4, -5.2, YARD_MAX_Z + 3.2], // дорожка от подъезда к калитке и до дороги
			[-15.8, -12, -14.5, -3.8], // парковка слева
			[12, 15.8, -8, -3], // парковка справа
		];
		for (const [x1, x2, z1, z2] of paved) {
			this._groundPatch(x1, x2, z1, z2, 0.003, createNoiseTexture(asphalt, (x2 - x1) / 2, (z2 - z1) / 2, 16, 5));
		}

		// Площадка под качелями и горкой — утоптанная земля с песком.
		const dirt = new THREE.Mesh(
			new THREE.CircleGeometry(4.2, 12),
			new THREE.MeshStandardMaterial({
				map: createNoiseTexture(['#8c7657', '#94805f', '#7f6b4f', '#9b8a68'], 4, 4, 16, 9),
			})
		);
		dirt.rotation.x = -Math.PI / 2;
		dirt.position.set(9, 0.002, 2);
		dirt.scale.set(1.1, 0.85, 1);
		dirt.receiveShadow = true;
		this.scene.add(dirt);

	}

	/** Район за забором: дворовая дорога без разметки вдоль южной стороны, панельные пятиэтажки вокруг,
	 * в восточном конце дороги — столовая «Спутник» фасадом к дороге. */
	private _buildDistrict(): void {
		// Дорога и тротуары — [x1, x2, z1, z2].
		this._groundPatch(ROAD_X1, ROAD_X2, ROAD_Z1, ROAD_Z2, 0.004, createYardRoadTexture((ROAD_X2 - ROAD_X1) / 8));
		const sidewalk = ['#6a6a6b', '#666667', '#707071', '#636364'];
		for (const [x1, x2, z1, z2] of [
			[-46, 27, ROAD_Z2 + 1.5, ROAD_Z2 + 3.5], // перед пятиэтажками южнее дороги
			[-23.5, -21.5, -26, ROAD_Z1], // перед западной
			[18, 20, -28, ROAD_Z1], // перед восточной
			[ROAD_X2, 34, ROAD_Z1 - 5, ROAD_Z2 + 5], // площадка перед столовой
		] as const) {
			this._groundPatch(x1, x2, z1, z2, 0.0035, createNoiseTexture(sidewalk, (x2 - x1) / 2, (z2 - z1) / 2, 16, 13));
		}

		// Бордюры; на северной стороне — разрыв под дорожку от калитки.
		const curbMat = new THREE.MeshStandardMaterial({ color: '#9d9a92' });
		for (const [x1, x2, z] of [
			[ROAD_X1, -1.4, ROAD_Z1],
			[1.4, ROAD_X2, ROAD_Z1],
			[ROAD_X1, ROAD_X2, ROAD_Z2],
		] as const) {
			const curb = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 0.12, 0.22), curbMat);
			curb.position.set((x1 + x2) / 2, 0.06, z);
			curb.receiveShadow = true;
			this.scene.add(curb);
		}

		// Пятиэтажки: [центр x, центр z, длина, подъездов, поворот, цвет]. Поворот π — подъезды на север, к дороге.
		const panels: [number, number, number, number, number, string][] = [
			[-27, 30, 38, 3, Math.PI, '#c9c3b5'],
			[13, 30, 28, 2, Math.PI, '#bdb9ae'],
			[-30, -6, 40, 3, Math.PI / 2, '#cdbfa8'],
			[27, -11, 34, 3, -Math.PI / 2, '#c4c0b6'],
		];
		panels.forEach(([x, z, length, sections, rot, color], i) => {
			const building = createPanelBuilding(length, sections, color, 17 + i * 31);
			building.position.set(x, 0, z);
			building.rotation.y = rot;
			this.scene.add(building);
			const alongX = Math.abs(Math.sin(rot)) < 0.5;
			this._rectColliders(x, z, alongX ? length : PANEL_BUILDING_DEPTH, alongX ? PANEL_BUILDING_DEPTH : length);
		});

		// Столовая в конце дороги, фасадом на запад — к дороге.
		const canteen = createCanteen();
		canteen.position.set(CANTEEN_X, 0, (ROAD_Z1 + ROAD_Z2) / 2);
		canteen.rotation.y = -Math.PI / 2;
		this.scene.add(canteen);
		this._rectColliders(CANTEEN_X, (ROAD_Z1 + ROAD_Z2) / 2, CANTEEN_SIZE.depth, CANTEEN_SIZE.width);
	}

	/** Коллайдеры по периметру прямоугольного здания (внутрь всё равно не попасть — хватает контура). */
	private _rectColliders(cx: number, cz: number, sizeX: number, sizeZ: number): void {
		const step = 0.8;
		const r = 0.5;
		const hx = sizeX / 2;
		const hz = sizeZ / 2;
		for (let x = -hx; x <= hx + 0.01; x += step) {
			this.colliders.add(cx + x, cz - hz, r);
			this.colliders.add(cx + x, cz + hz, r);
		}
		for (let z = -hz; z <= hz + 0.01; z += step) {
			this.colliders.add(cx - hx, cz + z, r);
			this.colliders.add(cx + hx, cz + z, r);
		}
	}

	/** Плоский прямоугольник на земле от (x1, z1) до (x2, z2) на высоте y (над травой, чтобы не мерцал). */
	private _groundPatch(x1: number, x2: number, z1: number, z2: number, y: number, map: THREE.Texture): void {
		const patch = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map }));
		patch.rotation.x = -Math.PI / 2;
		patch.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
		patch.receiveShadow = true;
		this.scene.add(patch);
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

		// Мелкие частые круги: крупные у краёв проёма (r=1.7 на x=±GATE_HALF) целиком перекрывали калитку.
		const segments = Math.max(2, Math.ceil(length / FENCE_COLLIDER_STEP));
		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			colliders.add(x1 + dx * t, z1 + dz * t, FENCE_COLLIDER_RADIUS);
		}
	}

	/** Пропсы двора многоквартирного дома. Проход от подъезда к калитке (x≈0) оставлен свободным. */
	private _buildYardProps(): void {
		this._place(createBench(), 6, -2, -Math.PI / 2, [[0, 0, 0.8]]);
		this._place(createBench(), -8, 3, Math.PI / 2, [[0, 0, 0.8]]);
		this._place(createBench(), 4.5, 8, Math.PI, [[0, 0, 0.8]]);
		this._place(createTrashBin(), 7.4, -3, 0, [[0, 0, 0.3]]);
		this._place(createTrashBin(), -6.6, 4, 0, [[0, 0, 0.3]]);
		this._place(createTrashBin(), 3.2, -6.8, 0, [[0, 0, 0.3]]);

		// Деревья: [x, z, масштаб, цвет листвы]. Часть — в полосах сбоку и позади дома.
		const trees: [number, number, number, string][] = [
			[10, -4, 1.1, '#8a6a3d'],
			[-11, -3, 1.0, '#9c5a2a'],
			[9, 7, 1.25, '#a8872f'],
			[-14, 10, 0.9, '#8a6a3d'],
			[13.5, 11, 1.0, '#9c5a2a'],
			[-5.5, 10, 0.85, '#a8872f'],
			[14, -12, 1.2, '#8a6a3d'],
			[-14, -15, 1.1, '#a8872f'],
			[14, -18, 1.0, '#9c5a2a'],
		];
		for (const [x, z, scale, color] of trees) {
			this._place(createTree(scale, color), x, z, x * 1.7 + z, [[0, 0, 0.35 * scale]]);
			this._place(createLeafLitter(2.2 * scale, color), x + 0.4, z - 0.3);
		}

		for (const [x, z, s] of [
			[-7, -7, 1],
			[-9, -7.2, 0.8],
			[-5.2, -7.1, 0.9],
			[7, -7, 1],
			[9.2, -7.1, 0.85],
			[15, 4, 1.1],
			[15, 1.8, 0.9],
			[-15, 6, 1],
		] as const) {
			this._place(createBush(s), x, z, x, [[0, 0, 0.7 * s]]);
		}

		// Детская площадка — восточная половина двора.
		this._place(createSandbox(), 2.5, 9);
		this._place(createSwing(), 7, 3, Math.PI / 2, [
			[-1.2, 0, 0.4],
			[1.2, 0, 0.4],
		]);
		this._place(createSlide(), 11.5, 1, -Math.PI / 2, [
			[0, 0, 0.7],
			[0, 1.5, 0.4],
		]);

		// Западная половина: турник, выбивалка, машины вдоль забора.
		this._place(createPullUpBar(), -9, 8.5, 0, [
			[-0.7, 0, 0.15],
			[0.7, 0, 0.15],
		]);
		this._place(createCarpetRack(), -13.5, 1.5, Math.PI / 2, [
			[-1.3, 0, 0.15],
			[1.3, 0, 0.15],
		]);
		const carCircles: [number, number, number][] = [
			[0, -1.3, 0.85],
			[0, 0, 0.85],
			[0, 1.3, 0.85],
		];
		this._place(createCar('#7a2b25'), -13.8, -6.5, 0, carCircles);
		this._place(createCar('#d8d2c0'), 13.8, -5.5, Math.PI, carCircles);
		this._place(createCar('#3d5566'), -13.8, -12, 0.05, carCircles);

		for (const [x, z] of [
			[-4, -6.5],
			[4.5, -6.5],
			[-2.2, 4],
			[2.2, 11],
		] as const) {
			this._place(createLampPost(), x, z, x < 0 ? 0 : Math.PI, [[0, 0, 0.15]]);
		}

		for (const [x, z, w, d] of [
			[1, 2, 2.4, 1.3],
			[-4.5, 7, 1.6, 1.0],
			[8.5, -5.5, 2.0, 1.4],
			[-1, -3, 1.2, 0.8],
		] as const) {
			this._place(createPuddle(w, d), x, z);
		}
	}

	/** Ставит объект в сцену с поворотом вокруг вертикали; circles — коллайдеры в локальных координатах [x, z, r]. */
	private _place(obj: THREE.Object3D, x: number, z: number, rotY = 0, circles: [number, number, number][] = []): void {
		obj.position.x = x;
		obj.position.z = z;
		// Плоские пятна (лужи, листья) уже положены на землю поворотом по X — вертикаль у них локальная Z.
		if (obj instanceof THREE.Mesh) obj.rotation.z = rotY;
		else obj.rotation.y = rotY;
		this.scene.add(obj);
		const cos = Math.cos(rotY);
		const sin = Math.sin(rotY);
		for (const [lx, lz, r] of circles) {
			this.colliders.add(x + lx * cos + lz * sin, z - lx * sin + lz * cos, r);
		}
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
			// Не рисуем окна у самой земли (не знаем точно, какой край текстуры — верх/низ фасада из-за flipY,
			// поэтому пропускаем оба крайних ряда) — там вход и чёрная дверь, окна поверх них смотрелись бы криво.
			if (floor === 0 || floor === FLOORS - 1) continue;
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
