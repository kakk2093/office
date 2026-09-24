import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import { Rain } from './Rain.js';
import type { PortalFrame } from '../render/WindowPortal.js';
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
	createNoiseTexture,
	createGarage,
	createDumpster,
	createDumpsterShelter,
	createTrashBag,
	createCardboardBox,
	createBottle,
	createLitterPaper,
	createWaterVendingMachine,
	createWaterJug,
	createConcreteFenceTexture,
} from './YardProps.js';

/** Размер земли — с запасом за клэмпом игрока (STREET_HALF в Game), чтобы край земли не был виден сквозь туман. */
const SIZE = 240;
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
/** Окно офиса на фасаде (первый этаж, левее чёрной двери). */
const OFFICE_WINDOW_X = -7;
const OFFICE_WINDOW_Y = 1.6;

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
/** Дворовая дорога за забором: вдоль X на восток, затем поворот направо (на юг, +Z) — в её конце столовая. */
const ROAD_X1 = -50;
const ROAD_X2 = 43;
const ROAD_Z1 = YARD_MAX_Z + 3;
const ROAD_Z2 = ROAD_Z1 + 5;
const ROAD_WIDTH = ROAD_Z2 - ROAD_Z1;
/** Отрезок после поворота: x от TURN_X1 до ROAD_X2, z от ROAD_Z2 до TURN_Z2. */
const TURN_X1 = ROAD_X2 - ROAD_WIDTH;
const TURN_Z2 = 58;
const CANTEEN_Z = TURN_Z2 + 6;
/** Бетонный забор по периметру района — дальше игрок не уходит (внутри клэмпа STREET_HALF в Game, с запасом вокруг домов). */
const BOUNDARY_MIN_X = -56;
const BOUNDARY_MAX_X = 66;
const BOUNDARY_MIN_Z = -52;
const BOUNDARY_MAX_Z = 73;
/** Выше глаз (1.7) — не заглянуть и не перелезть. */
const BOUNDARY_HEIGHT = 2.5;
/** Длина одной плиты. */
const BOUNDARY_PANEL = 4;
const CAR_COLORS = ['#7a2b25', '#d8d2c0', '#3d5566', '#5a6b3a', '#b8a13a', '#2e2f33', '#8a8f94', '#6a3f5c'];
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
	/** Окно офиса на фасаде большого дома — левее чёрной двери, смотрит во двор (на юг). Через него офис видит улицу
	 * (см. WindowPortal); центр чуть перед фасадом, чтобы стена дома оставалась за ближней плоскостью камеры. */
	readonly officeWindow: PortalFrame = {
		center: new THREE.Vector3(OFFICE_WINDOW_X, OFFICE_WINDOW_Y, FACADE_Z + 0.06),
		right: new THREE.Vector3(-1, 0, 0),
		outward: new THREE.Vector3(0, 0, 1),
	};
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
		this._buildOfficeWindow();
		this._registerFacadeColliders(colliders);
		this._buildFence(colliders);
		this._buildGate();
		this._buildYardProps();
		this._buildDistrict();
		this._buildBoundary();

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

	/** Район за забором: дворовая дорога без разметки вдоль южной стороны, за последними домами — поворот направо,
	 * в конце — столовая «Спутник» фасадом к дороге. Вокруг — пятиэтажки, машины, гаражи, мелочи. */
	private _buildDistrict(): void {
		this._buildRoads();
		this._buildPanels();
		this._buildDistrictProps();

		const canteen = createCanteen();
		canteen.position.set((TURN_X1 + ROAD_X2) / 2, 0, CANTEEN_Z);
		canteen.rotation.y = Math.PI; // фасадом на север — к дороге
		this.scene.add(canteen);
		this._rectColliders((TURN_X1 + ROAD_X2) / 2, CANTEEN_Z, CANTEEN_SIZE.width, CANTEEN_SIZE.depth);
	}

	/** Асфальт дороги, тротуары и площадки, бордюры. */
	private _buildRoads(): void {
		this._groundPatch(ROAD_X1, ROAD_X2, ROAD_Z1, ROAD_Z2, 0.004, createYardRoadTexture((ROAD_X2 - ROAD_X1) / 8));
		this._groundPatch(TURN_X1, ROAD_X2, ROAD_Z2, TURN_Z2, 0.004, createYardRoadTexture(ROAD_WIDTH / 8, (TURN_Z2 - ROAD_Z2) / 5));

		const sidewalk = ['#6a6a6b', '#666667', '#707071', '#636364'];
		// [x1, x2, z1, z2]
		for (const [x1, x2, z1, z2] of [
			[-46, 27, ROAD_Z2 + 1.5, ROAD_Z2 + 3.5], // перед пятиэтажками южнее дороги
			[-23.5, -21.5, -26, ROAD_Z1], // перед западной
			[18, 20, -28, ROAD_Z1], // перед восточной
			[TURN_X1 - 2.2, TURN_X1 - 0.4, ROAD_Z2 + 2, TURN_Z2 - 2], // перед домом слева от поворота
			[ROAD_X2 + 0.4, ROAD_X2 + 3.2, ROAD_Z2 + 1, TURN_Z2 - 7], // перед домом справа от поворота
			[31, 50, TURN_Z2 - 6, TURN_Z2], // площадка перед столовой
			[20.5, 28.5, 9.3, 14.2], // площадка под контейнеры
		] as const) {
			this._groundPatch(x1, x2, z1, z2, 0.0035, createNoiseTexture(sidewalk, (x2 - x1) / 2, (z2 - z1) / 2, 16, 13));
		}
		// Асфальт перед гаражами.
		this._groundPatch(-50, -37, 10, ROAD_Z1, 0.0038, createYardRoadTexture(13 / 8, 1));

		// Бордюры: вдоль дороги до поворота и вдоль отрезка после; на севере — разрыв под дорожку от калитки.
		const curbMat = new THREE.MeshStandardMaterial({ color: '#9d9a92' });
		const curb = (x1: number, x2: number, z1: number, z2: number) => {
			const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
			const len = alongX ? x2 - x1 : z2 - z1;
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.22, 0.12, alongX ? 0.22 : len), curbMat);
			mesh.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
			mesh.receiveShadow = true;
			this.scene.add(mesh);
		};
		curb(ROAD_X1, -1.4, ROAD_Z1, ROAD_Z1);
		curb(1.4, ROAD_X2, ROAD_Z1, ROAD_Z1);
		curb(ROAD_X1, TURN_X1, ROAD_Z2, ROAD_Z2);
		curb(TURN_X1, TURN_X1, ROAD_Z2, TURN_Z2 - 6);
		curb(ROAD_X2, ROAD_X2, ROAD_Z1, TURN_Z2 - 6);
	}

	/** Пятиэтажки. Поворот π — подъезды на север, π/2 — на восток, −π/2 — на запад, 0 — на юг. */
	private _buildPanels(): void {
		// [центр x, центр z, длина, подъездов, поворот, цвет]
		const panels: [number, number, number, number, number, string][] = [
			[-27, 30, 38, 3, Math.PI, '#c9c3b5'], // вдоль дороги, южнее
			[13, 30, 28, 2, Math.PI, '#bdb9ae'],
			[-30, -6, 40, 3, Math.PI / 2, '#cdbfa8'], // слева от двора
			[27, -11, 34, 3, -Math.PI / 2, '#c4c0b6'], // справа от двора
			[29, 47, 18, 2, Math.PI / 2, '#cbc5b8'], // слева от поворота
			[53, 36, 30, 3, -Math.PI / 2, '#b8b4aa'], // справа от поворота
			[-20, 52, 40, 3, Math.PI, '#c6bda9'], // второй ряд за дорогой
			[54, -2, 26, 2, -Math.PI / 2, '#cfc8ba'], // за восточной
			[0, -40, 44, 3, 0, '#c2beb4'], // позади большого дома
		];
		panels.forEach(([x, z, length, sections, rot, color], i) => {
			const building = createPanelBuilding(length, sections, color, 17 + i * 31);
			building.position.set(x, 0, z);
			building.rotation.y = rot;
			this.scene.add(building);
			const alongX = Math.abs(Math.sin(rot)) < 0.5;
			this._rectColliders(x, z, alongX ? length : PANEL_BUILDING_DEPTH, alongX ? PANEL_BUILDING_DEPTH : length);
		});
	}

	/** Машины у обочин, фонари и деревья вдоль дороги, скамейки у подъездов, гаражи, контейнеры, киоск. */
	private _buildDistrictProps(): void {
		const carCircles: [number, number, number][] = [
			[0, -1.3, 0.85],
			[0, 0, 0.85],
			[0, 1.3, 0.85],
		];
		// [x, z, поворот]: π/2 и −π/2 — вдоль основной дороги, 0 и π — вдоль отрезка после поворота.
		const cars: [number, number, number][] = [
			[-42, ROAD_Z1 + 1.1, Math.PI / 2],
			[-20, ROAD_Z1 + 1.1, Math.PI / 2],
			[-14.5, ROAD_Z1 + 1.1, -Math.PI / 2],
			[9, ROAD_Z1 + 1.1, Math.PI / 2],
			[-33, ROAD_Z2 - 1.1, -Math.PI / 2],
			[4, ROAD_Z2 - 1.1, -Math.PI / 2],
			[30, ROAD_Z2 - 1.1, Math.PI / 2],
			[TURN_X1 + 1.1, 28, 0],
			[TURN_X1 + 1.1, 44, Math.PI],
			[ROAD_X2 - 1.1, 35, Math.PI],
			[47.5, TURN_Z2 - 3, -Math.PI / 2],
		];
		cars.forEach(([x, z, rot], i) => this._place(createCar(CAR_COLORS[i % CAR_COLORS.length]), x, z, rot + (i % 3) * 0.03, carCircles));

		// Фонари: вдоль северной обочины кронштейном над дорогой, вдоль отрезка после поворота — с западной стороны.
		for (const x of [-44, -30, -16, 14, 28, 40]) this._place(createLampPost(), x, ROAD_Z1 - 0.7, -Math.PI / 2, [[0, 0, 0.15]]);
		for (const z of [27, 39, 51]) this._place(createLampPost(), TURN_X1 - 0.6, z, 0, [[0, 0, 0.15]]);

		const trees: [number, number, number, string][] = [
			[-40, ROAD_Z2 + 0.8, 0.9, '#9c5a2a'],
			[-22, ROAD_Z2 + 0.8, 1.0, '#a8872f'],
			[-10, ROAD_Z2 + 0.8, 0.85, '#8a6a3d'],
			[20, ROAD_Z2 + 0.8, 0.95, '#9c5a2a'],
			[-4.5, 30, 1.1, '#8a6a3d'],
			[10, 44, 1.15, '#a8872f'],
			[18, 52, 1.0, '#9c5a2a'],
			[47.5, 12.5, 0.9, '#a8872f'],
			[-44, -2, 1.0, '#8a6a3d'],
			[40, -10, 1.1, '#9c5a2a'],
		];
		for (const [x, z, scale, color] of trees) {
			this._place(createTree(scale, color), x, z, x * 1.7 + z, [[0, 0, 0.35 * scale]]);
		}
		for (const [x, z, s] of [
			[-46, 23, 1],
			[26, 23, 0.9],
			[21, 40, 0.8],
			[12, 46, 1],
		] as const) {
			this._place(createBush(s), x, z, x, [[0, 0, 0.7 * s]]);
		}

		// Скамейки и урны у подъездов домов за дорогой — спинкой к дому, лицом к дороге.
		for (const x of [-38, -21, 9.5, 23]) {
			this._place(createBench(), x, ROAD_Z2 + 2.6, Math.PI, [[0, 0, 0.8]]);
			this._place(createTrashBin(), x + 1.2, ROAD_Z2 + 2.6, 0, [[0, 0, 0.3]]);
		}
		this._place(createBench(), 14, 47.5, 0.4, [[0, 0, 0.8]]);

		// Ряд гаражей в западном конце дороги, воротами к ней.
		const garageColors = ['#6b5a48', '#56606a', '#7a6a4a', '#5f6b52'];
		for (let i = 0; i < 4; i++) {
			this._place(createGarage(garageColors[i]), -48.4 + i * 3.2, 7, 0, [
				[0, -2, 1.5],
				[0, 0, 1.5],
				[0, 2, 1.5],
			]);
		}

		this._buildDumpsterSite(24.6, 10.8);

		// Автомат с водой у поворота, лицом к дороге; рядом кто-то оставил пустую бутыль.
		this._place(createWaterVendingMachine(), ROAD_X2 + 1.9, ROAD_Z1 + 1.5, -Math.PI / 2, [[0, 0, 0.8]]);
		this._place(createWaterJug(), ROAD_X2 + 1.3, ROAD_Z1 + 0.3, 0);

		for (const [x, z, w, d] of [
			[-25, 17.2, 2.2, 1.2],
			[16, 18, 1.6, 1.0],
			[40.5, 33, 1.8, 1.2],
		] as const) {
			this._place(createPuddle(w, d), x, z);
		}
	}

	/** Бетонный забор из плит по периметру района со сплошной цепочкой коллайдеров. */
	private _buildBoundary(): void {
		const x1 = BOUNDARY_MIN_X;
		const x2 = BOUNDARY_MAX_X;
		const z1 = BOUNDARY_MIN_Z;
		const z2 = BOUNDARY_MAX_Z;
		for (const [ax, bx, az, bz] of [
			[x1, x2, z1, z1],
			[x1, x2, z2, z2],
			[x1, x1, z1, z2],
			[x2, x2, z1, z2],
		] as const) {
			const length = Math.hypot(bx - ax, bz - az);
			const alongX = az === bz;
			// Плита текстурой на длинных гранях; для сторон вдоль Z — тот же бокс, повёрнутый на 90°.
			const wall = new THREE.Mesh(
				new THREE.BoxGeometry(length, BOUNDARY_HEIGHT, 0.18),
				new THREE.MeshStandardMaterial({ map: createConcreteFenceTexture(length / BOUNDARY_PANEL) })
			);
			wall.position.set((ax + bx) / 2, BOUNDARY_HEIGHT / 2, (az + bz) / 2);
			if (!alongX) wall.rotation.y = Math.PI / 2;
			wall.castShadow = wall.receiveShadow = true;
			this.scene.add(wall);

			const segments = Math.ceil(length / FENCE_COLLIDER_STEP);
			for (let i = 0; i <= segments; i++) {
				const t = i / segments;
				this.colliders.add(ax + (bx - ax) * t, az + (bz - az) * t, FENCE_COLLIDER_RADIUS);
			}
		}
	}

	/** Контейнерная площадка: навес с тремя открытыми мульдами, полными мусора, и немного мусора на земле перед ней. */
	private _buildDumpsterSite(cx: number, cz: number): void {
		const width = 6.4;
		const depth = 2.2;
		this._place(createDumpsterShelter(width, depth), cx, cz);
		// Задняя и боковые стенки навеса — сплошные.
		for (let x = -width / 2; x <= width / 2 + 0.01; x += 0.5) this.colliders.add(cx + x, cz - depth / 2, 0.25);
		for (let z = -depth / 2; z <= depth / 2 + 0.01; z += 0.5) {
			this.colliders.add(cx - width / 2, cz + z, 0.25);
			this.colliders.add(cx + width / 2, cz + z, 0.25);
		}

		for (const [dx, color, seed] of [
			[-1.8, '#3f5a44', 3],
			[0, '#4a5e6b', 8],
			[1.8, '#3f5a44', 13],
		] as const) {
			this._place(createDumpster(color, seed), cx + dx, cz, (seed % 3) * 0.04 - 0.04, [[0, 0, 0.8]]);
		}

		// Мусор на земле: пакеты у краёв, коробки, бутылки, бумажки — [dx, dz, поворот].
		const bags: [number, number, string, number][] = [
			[-3.6, 1.6, '#1f2022', 1],
			[-3.1, 2.1, '#3a4a6a', 0.85],
			[3.7, 1.3, '#262626', 1.1],
			[1.2, 1.9, '#d8d6cf', 0.8],
		];
		for (const [dx, dz, color, scale] of bags) this._place(createTrashBag(color, scale), cx + dx, cz + dz, dx * 2.3);
		this._place(createCardboardBox(0.6, 0.4, 0.45, true), cx + 2.9, cz + 2.0, 0.5);
		this._place(createCardboardBox(0.4, 0.25, 0.35), cx - 1.0, cz + 2.3, -0.7);
		for (const [dx, dz, rot, color] of [
			[-2.2, 2.6, 0.4, '#3f6a3a'],
			[0.6, 2.8, 2.1, '#6a4a2a'],
			[3.3, 2.7, -1.2, '#3f6a3a'],
		] as const) {
			this._place(createBottle(color), cx + dx, cz + dz, rot);
		}
		for (const [dx, dz, rot, color] of [
			[-0.4, 1.8, 0.3, '#d9d4c8'],
			[2.2, 2.6, 1.4, '#c9c2a8'],
			[-2.8, 2.9, 2.2, '#b8c4c8'],
			[0.9, 3.4, 0.9, '#d9d4c8'],
			[-1.6, 3.6, 1.9, '#a8a08a'],
		] as const) {
			this._place(createLitterPaper(color, 0.18 + (dx + 3) * 0.02), cx + dx, cz + dz, rot);
		}
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

	/** Окно офиса снаружи: белая рама и тёмное стекло на фасаде. Лежит за плоскостью officeWindow — в вид из офиса не попадает. */
	private _buildOfficeWindow(): void {
		const w = 1.8;
		const h = 1.4;
		const z = FACADE_Z + 0.02;
		const glass = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshStandardMaterial({ color: '#3a444a', roughness: 0.15, metalness: 0.4 })
		);
		glass.position.set(OFFICE_WINDOW_X, OFFICE_WINDOW_Y, z);
		this.scene.add(glass);
		const frameMat = new THREE.MeshStandardMaterial({ color: '#e8e7e2' });
		for (const [x, y, fw, fh] of [
			[0, h / 2, w + 0.1, 0.08],
			[0, -h / 2, w + 0.1, 0.08],
			[-w / 2, 0, 0.08, h],
			[w / 2, 0, 0.08, h],
			[0, 0, 0.06, h],
		] as const) {
			const bar = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.02), frameMat);
			bar.position.set(OFFICE_WINDOW_X + x, OFFICE_WINDOW_Y + y, z);
			this.scene.add(bar);
		}
		// Отлив под окном.
		const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#9a9c9e' }));
		sill.position.set(OFFICE_WINDOW_X, OFFICE_WINDOW_Y - h / 2 - 0.06, z);
		this.scene.add(sill);
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
