import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import type { RoomBounds } from './Room.js';
import {
	createCanteenDoor,
	SwingLeaf,
	createCanteenTable,
	createStool,
	createNapkinHolder,
	createShaker,
	createServingCounter,
	createDisplayCase,
	createMarmite,
	createSoupPot,
	createWaterBoiler,
	createCashDesk,
	createSteelTable,
	createCutleryBox,
	createSpoon,
	createDishRack,
	createTrayStack,
	createTray,
	createBreadTray,
	createBreadSlice,
	createDirtyTray,
	createPlate,
	createBowl,
	createGlass,
	createPlateStack,
	createFluorescentLamp,
	createWashbasin,
	createCoatRack,
	createFicus,
	createWallClock,
	createPoster,
	createTextTexture,
	createMenuTexture,
	createFloorTileTexture,
	createWallTileTexture,
	createCanteenWindow,
	TABLE_HEIGHT,
	COUNTER_HEIGHT,
	COUNTER_DEPTH,
	TRAY_RAIL_OFFSET,
	CANTEEN_DOOR_WIDTH,
	SOUP_COLOR,
	type FoodKind,
	type BreadKind,
	type DrinkKind,
} from './CanteenProps.js';
import { DinnerLady, Cashier } from './People.js';
import type { Interaction, Seat, CameraPose } from '../core/Interaction.js';

/**
 * Столовая изнутри — отдельная сцена, как офис. Вход с юга (+Z); за входом зал: 12 столов в два ряда
 * по 6 (слева и справа от прохода), у каждого 4 табуретки. В глубине, вдоль северной стены — линия раздачи
 * слева направо: подносы и приборы → холодные закуски → первое → второе → напитки → касса.
 * Напротив раздачи, через проход, — столы для подносов с грязной посудой.
 */

const WIDTH = 12;
const NORTH_Z = -10;
const SOUTH_Z = 10;
const DEPTH = SOUTH_Z - NORTH_Z;
const CENTER_Z = (NORTH_Z + SOUTH_Z) / 2;
const HEIGHT = 3.6;
const WALL_THICKNESS = 0.2;
/** Высота кафеля на стенах зала; за раздачей кафель выше — там «кухня». */
const TILE_HEIGHT = 1.6;
const BACK_TILE_HEIGHT = 2.4;
/** Сторона плитки кафеля и пола, м (на тайл текстуры — 2×2 плитки). */
const WALL_TILE = 0.15;
const FLOOR_TILE = 0.3;
/** Отделка (кафель, панель) лежит на стене с зазором FINISH; настенные предметы крепим на MOUNT от стены —
 * поверх отделки, иначе они уходят в неё или в саму стену. */
const FINISH = 0.005;
const MOUNT = 0.015;
/** Внутренние поверхности стен, на которые вешаются предметы. */
const NORTH_MOUNT = NORTH_Z + WALL_THICKNESS / 2 + MOUNT;
const SOUTH_MOUNT = SOUTH_Z - WALL_THICKNESS / 2 - MOUNT;
const WEST_MOUNT = -WIDTH / 2 + WALL_THICKNESS / 2 + MOUNT;
const EAST_MOUNT = WIDTH / 2 - WALL_THICKNESS / 2 - MOUNT;

/** Линия раздачи: прилавок вдоль X, посетители — с юга (+Z), идут слева направо (с запада на восток). */
const COUNTER_Z = -7.0;
const COUNTER_X1 = -4.4;
const COUNTER_X2 = 3.4;
const COUNTER_TOP = COUNTER_HEIGHT;
/** Где на прилавке ставить блюда: ближе к посетителю и ближе к раздатчице. */
const FRONT_Z = COUNTER_Z + 0.18;
const BACK_Z = COUNTER_Z - 0.16;
/** Участки линии по X: холодные закуски, первое, второе, напитки. */
const COLD_X: [number, number] = [-4.4, -2.0];
const SOUP_X: [number, number] = [-2.0, 0.0];
const HOT_X: [number, number] = [0.0, 2.2];
const DRINK_X: [number, number] = [2.2, 3.4];
/** Стол перед началом линии: стопка подносов, лоток с приборами, лоток с нарезанным хлебом. */
const TRAY_TABLE_X = -5.15;
const TRAY_TABLE_WIDTH = 1.3;
const TRAY_STACK_POS = { x: -5.5, z: COUNTER_Z + 0.06 };
const BREAD_POS = { x: -4.74, z: COUNTER_Z + 0.02 };
const CUTLERY_POS = { x: -5.06, z: COUNTER_Z - 0.1 };
/** Сколько кусков хлеба кладут на поднос. */
const BREAD_PER_TRAY = 2;
/** С какого расстояния (от глаз, м) и под каким углом от центра взгляда предмет «в прицеле». */
const REACH = 1.9;
const FOCUS_COS = Math.cos(0.4);
/** Поднос в руках — в координатах камеры: чуть ниже центра экрана и вперёд; наклонён к игроку. */
const HELD_TRAY_OFFSET = new THREE.Vector3(0.04, -0.42, -0.66);
const HELD_TRAY_TILT = 0.25;
/** Место тарелки с супом на подносе в руках (локально: правее хлеба). */
const HELD_SOUP_SLOT: [number, number] = [0.09, 0];
/** Ложка на подносе — вдоль правого края, справа от тарелки (ближний край подноса уходит за низ экрана). */
const HELD_SPOON_SLOT: [number, number] = [0.2, 0.01];
/** Точки ложки при еде (в координатах подноса на столе; сидящий — со стороны +Z подноса, глаза выше на ~0.4 м). */
const SPOON_REST = new THREE.Vector3(HELD_SPOON_SLOT[0], 0.006, HELD_SPOON_SLOT[1]);
const SPOON_IN_BOWL = new THREE.Vector3(HELD_SOUP_SLOT[0], 0.05, HELD_SOUP_SLOT[1] + 0.02);
const SPOON_AT_MOUTH = new THREE.Vector3(0.0, 0.24, 0.12);
/** Куда на подносе в руках ложатся куски хлеба (локально, у левого края). */
const HELD_BREAD_SLOTS: [number, number][] = [
	[-0.15, 0.05],
	[-0.13, -0.06],
];

/** Высота глаз сидящего за столом, м. */
const SEATED_EYE_Y = 1.15;
/** Поднос на столе сдвинут от центра к сидящему. */
const TRAY_ON_TABLE_OFFSET = 0.2;
/** Кассир сидит за стойкой — до её лица дальше, чем до предметов на прилавке. */
const CASHIER_REACH = 2.5;

/** Касса — сразу за концом прилавка. */
const CASH_X = 4.3;
/** Табурет кассира — за стойкой, в её локальных координатах. */
const CASHIER_SEAT_Z = -0.72;
/** Раздатчица — у первого, между кастрюлями: черпает из правой (для неё) и наливает в тарелку перед собой. */
const DINNER_LADY_X = -1.25;
const DINNER_LADY_Z = COUNTER_Z - COUNTER_DEPTH / 2 - 0.17;
const SOUP_POT_X = -1.55;
const SOUP_BOWL = { x: -1.25, z: COUNTER_Z + 0.14 };

/** Зал: столы в два ряда по 6, проход посередине. */
const TABLE_X = [-3.0, 3.0];
const TABLE_ROWS = 6;
const TABLE_Z0 = -2.2;
const TABLE_STEP = 1.8;
/** Табуретки — по одной с каждой стороны квадратного стола. */
const STOOL_OFFSET = 0.62;
const STOOL_COLORS = ['#7a4a2a', '#6a2e2a', '#7a4a2a', '#3f4f5a'];

/** Столы для грязной посуды — напротив раздачи, по бокам прохода (сам проход свободен). */
const RETURN_Z = -4.3;
const RETURN_X = [-4.2, 4.2];
const RETURN_LENGTH = 2.4;

/** Окна в боковых стенах зала — между рядами столов, задёрнуты плотными шторами. */
const WINDOW_Z = [-1.3, 2.3, 5.9];
const WINDOW_WIDTH = 2.2;
const WINDOW_HEIGHT = 2.2;
const WINDOW_Y = 1.95;

const LAMP_X = [-3, 0, 3];
const LAMP_Z = [-8.5, -5.5, -2.5, 0.5, 3.5, 6.5];
/** Точечный свет — у части ламп (свет ЛДС холодноватый). */
const LIGHTS: [number, number][] = [
	[0, -7.8],
	[-3, -4.8],
	[3, -4.8],
	[-3, 0.5],
	[3, 0.5],
	[-3, 5.5],
	[3, 5.5],
];
const LAMP_COLOR = '#eef4ee';
/** Во что гаснет свет зала, пока игрок доедает солянку. */
const CRIMSON = new THREE.Color('#8a1020');
const CRIMSON_AMBIENT = new THREE.Color('#4a0810');
const BACKGROUND = new THREE.Color('#1c1d1f');
const BACKGROUND_DARK = new THREE.Color('#12030a');
/** Сколько ложек — вся тарелка; после какой музыка начинает затихать (дальше каждая ложка гасит свет в багровый). */
export const BITES_TO_FINISH = 10;
export const MUSIC_FADE_BITE = 5;
/** Сколько длится одна ложка (зачерпнуть → ко рту → обратно), с. */
export const BITE_TIME = 1.4;
/** Доля ложки, когда она у рта (ключи — в _updateBite). */
export const BITE_AT_MOUTH = 0.5;
/**
 * Катсцена после последней ложки (с): пауза → встать (камера поднимается и отходит от стола) →
 * взять поднос со стола в руки → развернуться назад. Потом управление возвращается игроку.
 */
const CUTSCENE_PAUSE = 0.6;
const CUTSCENE_STAND = 1.2;
const CUTSCENE_TAKE = 0.8;
const CUTSCENE_TURN = 1.4;
/** Насколько отходим от табуретки, вставая (от стола), м. */
const STAND_BACK = 0.6;
const STANDING_EYE_Y = 1.7;

/** Входная дверь в южной стене; створка при выходе открывается наружу (от игрока). */
const DOOR_Z = SOUTH_Z - WALL_THICKNESS / 2 - 0.05;

export class Canteen {
	readonly scene = new THREE.Scene();
	readonly bounds: RoomBounds = { minX: -WIDTH / 2, maxX: WIDTH / 2, minZ: NORTH_Z, maxZ: SOUTH_Z };
	/** Сразу за дверью, лицом в зал — к раздаче (yaw 0 — взгляд на север, −Z). */
	readonly spawnPoint = { x: 0, z: SOUTH_Z - 1.2, yaw: 0 };
	/** Середина двери изнутри — у неё подсказка «выйти». */
	readonly exitDoor = { x: 0, z: SOUTH_Z };
	private readonly door: SwingLeaf;
	private readonly dinnerLady = new DinnerLady();
	private readonly cashier = new Cashier();
	/** Солянка в тарелке у раздатчицы: растекается от центра, пока та наливает (см. DinnerLady.bowlFill). */
	private soupInBowl!: THREE.Object3D;
	/** Тарелка у кастрюль — её, налитую, переносим на поднос в руках. */
	private soupBowl!: THREE.Group;
	private soupOrdered = false;
	/** Столы зала: центр и есть ли на нём чужой поднос (за такой не садимся). */
	private readonly tables: { x: number; z: number; dirty: boolean }[] = [];
	/** Лицо кассира в мире — для прицела и маркера. */
	private readonly cashierHead = new THREE.Vector3();
	private paid = false;
	/** Стол, за который предлагаем сесть после оплаты (ближайший к кассе свободный). */
	private targetTable: { x: number; z: number } | null = null;
	/** Сидим ли сейчас и садились ли уже (после этого цепочка закончена). */
	private seated = false;
	/** Где и как сидим — для катсцены вставания. */
	private seat: Seat | null = null;
	/** Время катсцены после еды, с; −1 — не идёт (ещё не доели или уже закончилась). */
	private cutsceneTime = -1;
	private readonly trayOnTablePosition = new THREE.Vector3();
	private trayOnTableYaw = 0;
	private readonly heldPosition = new THREE.Vector3();
	private satDown = false;
	/** Где поднос: 1 — в руках (перед камерой), 0 — на столе; между — его берут со стола (катсцена). */
	private trayPickup = 1;
	/** Game подставляет посадку/подъём игрока: сама столовая игроком не управляет. */
	onSit: ((seat: Seat) => void) | null = null;
	onStand: ((x: number, z: number) => void) | null = null;
	/** Катсцена ведёт камеру сама: Game ставит её в эту позу (управление в это время заблокировано). */
	onCameraPose: ((pose: CameraPose) => void) | null = null;
	private cutleryBox!: THREE.Group;
	private spoonTaken = false;
	private soupTaken = false;
	/** Стопка подносов на столе у линии: берут верхний (последний ребёнок группы). */
	private trayStack!: THREE.Group;
	/** Куски белого хлеба в лотке в порядке, в каком их забирают (чёрный не берут — он для вида). */
	private breadSlices: { mesh: THREE.Group; kind: BreadKind }[] = [];
	/** Поднос в руках игрока: живёт в сцене, каждый кадр ставится перед камерой (см. _updateHeldTray). */
	private readonly heldTray = createTray();
	private trayHeld = false;
	private breadOnTray = 0;
	/** Свет зала с исходными цветом/яркостью: при darkness → 1 уходит в багровый и тускнеет на долю dim. */
	private readonly lighting: { light: THREE.Light; color: THREE.Color; intensity: number; dark: THREE.Color; dim: number }[] = [];
	/** Общий материал трубок ЛДС — их свечение тоже краснеет. */
	private readonly tubeMaterial = new THREE.MeshStandardMaterial({ color: '#f4fbf6', emissive: '#eaf6ee', emissiveIntensity: 1.5 });
	private readonly tubeEmissive = new THREE.Color('#eaf6ee');
	/** Сколько ложек съедено; ложка на подносе и её анимация (−1 — не идёт). */
	private bites = 0;
	private traySpoon: THREE.Group | null = null;
	private spoonSoup: THREE.Mesh | null = null;
	private biteTime = -1;
	/** Багровость света: текущая (плавно догоняет) и целевая (растёт с каждой ложкой после MUSIC_FADE_BITE). */
	private darkness = 0;
	private darknessTarget = 0;
	private readonly focusDir = new THREE.Vector3();
	private readonly focusTo = new THREE.Vector3();

	constructor(private readonly colliders: CircleColliders) {
		this.scene.background = BACKGROUND.clone();
		const ambient = new THREE.AmbientLight('#ffffff', 0.55);
		const hemisphere = new THREE.HemisphereLight('#f2f4ee', '#8a6a52', 0.35);
		this.scene.add(ambient, hemisphere);
		// Рассеянный свет из окон — единственный, что даёт тени (точечные тени дорогие).
		const daylight = new THREE.DirectionalLight('#d7dad6', 0.45);
		this.lighting.push(
			{ light: ambient, color: ambient.color.clone(), intensity: ambient.intensity, dark: CRIMSON_AMBIENT, dim: 0.7 },
			{ light: hemisphere, color: hemisphere.color.clone(), intensity: hemisphere.intensity, dark: CRIMSON, dim: 0.5 },
			{ light: daylight, color: daylight.color.clone(), intensity: daylight.intensity, dark: CRIMSON, dim: 0.8 }
		);
		daylight.position.set(-6, 8, 2);
		daylight.target.position.set(0, 0, 0);
		daylight.castShadow = true;
		daylight.shadow.camera.left = -12;
		daylight.shadow.camera.right = 12;
		daylight.shadow.camera.top = 12;
		daylight.shadow.camera.bottom = -12;
		daylight.shadow.mapSize.set(1024, 1024);
		this.scene.add(daylight, daylight.target);

		this._buildShell();
		this._buildWindows();
		this._buildLights();
		this.door = this._buildDoor();
		this._buildEntrance();
		this._buildHall();
		this._buildServingLine();
		this._buildBackWall();
		this._buildReturnTables();

		this.heldTray.visible = false;
		this.scene.add(this.heldTray);
	}

	/**
	 * Текущий шаг цепочки — первое, что ещё не сделано: текст задачи и точка над предметом для маркера HUD.
	 * null — всё сделано.
	 */
	get objective(): { text: string; at: THREE.Vector3 | null } | null {
		const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		if (!this.trayHeld) return { text: 'Возьми поднос', at: at(TRAY_STACK_POS.x, COUNTER_TOP + 0.25, TRAY_STACK_POS.z) };
		if (this.breadOnTray < BREAD_PER_TRAY) {
			return { text: `Возьми хлеб (${this.breadOnTray}/${BREAD_PER_TRAY})`, at: at(BREAD_POS.x, COUNTER_TOP + 0.08, BREAD_POS.z) };
		}
		if (!this.spoonTaken) return { text: 'Возьми ложку', at: at(CUTLERY_POS.x, COUNTER_TOP + 0.08, CUTLERY_POS.z) };
		if (!this.soupOrdered) return { text: 'Закажи солянку', at: at(DINNER_LADY_X, 1.95, DINNER_LADY_Z) };
		const bowl = at(SOUP_BOWL.x, COUNTER_TOP + 0.1, SOUP_BOWL.z);
		if (!this.dinnerLady.served) return { text: 'Подожди, пока нальют', at: bowl };
		if (!this.soupTaken) return { text: 'Возьми солянку', at: bowl };
		if (!this.paid) return { text: 'Оплати на кассе', at: this.cashierHead.clone().setY(this.cashierHead.y + 0.35) };
		if (this.eating) return { text: `Съешь солянку (${this.bites}/${BITES_TO_FINISH})`, at: null };
		if (!this.satDown && this.targetTable) {
			return { text: 'Сядь за стол', at: at(this.targetTable.x, TABLE_HEIGHT + 0.1, this.targetTable.z) };
		}
		return null;
	}

	/**
	 * Что игрок может сделать с предметом в прицеле (вблизи и почти по центру взгляда):
	 * взять поднос, затем положить на него хлеб. null — ничего подходящего.
	 */
	interaction(camera: THREE.Camera): Interaction | null {
		const spots: { x: number; y: number; z: number; reach?: number; get: () => Interaction | null }[] = [
			{ ...TRAY_STACK_POS, y: COUNTER_TOP + 0.1, get: () => this._trayInteraction() },
			{ ...BREAD_POS, y: COUNTER_TOP + 0.03, get: () => this._breadInteraction() },
			{ ...CUTLERY_POS, y: COUNTER_TOP + 0.03, get: () => this._spoonInteraction() },
			// Раздатчица — в прицеле её лицо (над прилавком, за кастрюлями).
			{ x: DINNER_LADY_X, y: 1.55, z: DINNER_LADY_Z, get: () => this._dinnerLadyInteraction() },
			{ ...SOUP_BOWL, y: COUNTER_TOP + 0.05, get: () => this._soupInteraction() },
			{ x: this.cashierHead.x, y: this.cashierHead.y, z: this.cashierHead.z, reach: CASHIER_REACH, get: () => this._cashierInteraction() },
		];
		if (this.targetTable) {
			spots.push({ x: this.targetTable.x, y: TABLE_HEIGHT, z: this.targetTable.z, reach: 2.2, get: () => this._tableInteraction(camera) });
		}
		camera.getWorldDirection(this.focusDir);
		let best: Interaction | null = null;
		let bestCos = FOCUS_COS;
		for (const spot of spots) {
			this.focusTo.set(spot.x, spot.y, spot.z).sub(camera.position);
			if (this.focusTo.length() > (spot.reach ?? REACH)) continue;
			const cos = this.focusTo.normalize().dot(this.focusDir);
			if (cos < bestCos) continue;
			const action = spot.get();
			if (!action) continue;
			best = action;
			bestCos = cos;
		}
		return best;
	}

	private _trayInteraction(): Interaction | null {
		if (this.trayHeld || this.trayStack.children.length === 0) return null;
		return {
			text: 'взять поднос',
			sound: 'tray',
			run: () => {
				this.trayStack.remove(this.trayStack.children[this.trayStack.children.length - 1]);
				this.trayHeld = true;
				this.heldTray.visible = true;
			},
		};
	}

	/** Разговор с раздатчицей: заказать солянку. Сначала — поднос, хлеб и ложка; после разговора она наливает. */
	private _dinnerLadyInteraction(): Interaction | null {
		if (this.soupOrdered) return null;
		const missing: string[] = [];
		if (!this.trayHeld) missing.push('поднос');
		if (this.breadOnTray < BREAD_PER_TRAY) missing.push('хлеб');
		if (!this.spoonTaken) missing.push('ложку');
		if (missing.length > 0) {
			const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} и ${missing[missing.length - 1]}` : missing[0];
			return { text: `Сначала возьмите ${list}` };
		}
		return {
			text: 'поговорить',
			dialogue: {
				lines: [
					{ speaker: 'Раздатчица', text: 'Чего тебе?', voice: 'dinnerLady' },
					{ speaker: 'Я', text: 'Солянку целую.', voice: 'player' },
					{ speaker: 'Раздатчица', text: 'С собой что-то будет?', voice: 'dinnerLady' },
					{ speaker: 'Я', text: 'Нет.', voice: 'player' },
				],
				onEnd: () => {
					this.soupOrdered = true;
					this.dinnerLady.pour();
				},
			},
		};
	}

	/** Налитую солянку — на поднос (нужен поднос в руках). */
	private _soupInteraction(): Interaction | null {
		if (!this.dinnerLady.served || this.soupTaken) return null;
		if (!this.trayHeld) return { text: 'Сначала возьмите поднос' };
		return {
			text: 'взять солянку',
			sound: 'dish',
			run: () => {
				this.soupTaken = true;
				this.soupBowl.removeFromParent();
				this.soupBowl.position.set(HELD_SOUP_SLOT[0], 0.008, HELD_SOUP_SLOT[1]);
				this.soupBowl.rotation.set(0, 0, 0);
				this.heldTray.add(this.soupBowl);
			},
		};
	}

	/** Сидим, ложка свободна и ещё есть что есть — ЛКМ ест. */
	get canEat(): boolean {
		return this.seated && this.bites < BITES_TO_FINISH && this.biteTime < 0;
	}

	get eating(): boolean {
		return this.seated && this.bites < BITES_TO_FINISH;
	}

	get finishedEating(): boolean {
		return this.bites >= BITES_TO_FINISH;
	}

	/** Одна ложка: анимация ложки, солянки в тарелке меньше; после MUSIC_FADE_BITE каждая ложка гасит свет в багровый.
	 * Возвращает, сколько ложек съедено. */
	eat(): number {
		if (!this.canEat) return this.bites;
		this.bites++;
		this.biteTime = 0;
		this.darknessTarget = THREE.MathUtils.clamp((this.bites - MUSIC_FADE_BITE) / (BITES_TO_FINISH - MUSIC_FADE_BITE), 0, 1);
		return this.bites;
	}

	/** Ложка в тарелку → с солянкой ко рту (к камере сидящего) → обратно на поднос. Координаты — подноса на столе. */
	private _updateBite(dt: number): void {
		const spoon = this.traySpoon;
		if (!spoon || this.biteTime < 0) return;
		this.biteTime += dt / BITE_TIME;
		const p = Math.min(1, this.biteTime);
		// К тарелке → зачерпнуть (задержка) → ко рту → подержать (едим) → на поднос.
		const keys: [number, THREE.Vector3][] = [
			[0, SPOON_REST],
			[0.18, SPOON_IN_BOWL],
			[0.28, SPOON_IN_BOWL],
			[BITE_AT_MOUTH, SPOON_AT_MOUTH],
			[0.72, SPOON_AT_MOUTH],
			[1, SPOON_REST],
		];
		for (let i = 0; i < keys.length - 1; i++) {
			const [t0, a] = keys[i];
			const [t1, b] = keys[i + 1];
			if (p > t1) continue;
			const k = (p - t0) / (t1 - t0);
			spoon.position.lerpVectors(a, b, k * k * (3 - 2 * k));
			break;
		}
		// Пока несём — черпачок приподнят к игроку.
		spoon.rotation.set(p > 0.26 && p < 0.85 ? 0.35 : 0, 0.08, 0);
		if (this.spoonSoup) this.spoonSoup.visible = p > 0.26 && p < 0.6;
		if (p >= 1) {
			this.biteTime = -1;
			spoon.position.copy(SPOON_REST);
			// Последняя ложка — дальше катсцена: встаём, берём поднос, разворачиваемся.
			if (this.finishedEating) this.cutsceneTime = 0;
		}
	}

	/** Свет зала плавно догоняет целевую багровость. */
	private _updateDarkness(dt: number): void {
		if (Math.abs(this.darknessTarget - this.darkness) < 1e-4) return;
		this.darkness += (this.darknessTarget - this.darkness) * (1 - Math.exp(-dt * 0.6));
		const m = this.darkness;
		for (const entry of this.lighting) {
			entry.light.color.lerpColors(entry.color, entry.dark, m);
			entry.light.intensity = entry.intensity * (1 - entry.dim * m);
		}
		this.tubeMaterial.emissive.lerpColors(this.tubeEmissive, CRIMSON, m);
		this.tubeMaterial.color.lerpColors(this.tubeEmissive, CRIMSON, m);
		(this.scene.background as THREE.Color).lerpColors(BACKGROUND, BACKGROUND_DARK, m);
	}

	/** Оплата на кассе — когда солянка уже на подносе. После оплаты выбираем стол. */
	private _cashierInteraction(): Interaction | null {
		if (this.paid) return null;
		if (!this.soupTaken) return { text: 'Сначала наберите обед' };
		return {
			text: 'поговорить',
			dialogue: {
				lines: [
					{ speaker: 'Кассир', text: 'Так, солянка целая, 2 хлеба. С вас 126 рублей.', voice: 'cashier' },
					{ speaker: 'Я', text: 'Картой.', voice: 'player' },
				],
				endSound: 'card',
				onEnd: () => {
					this.paid = true;
					this.targetTable = this._nearestFreeTable(this.cashierHead);
				},
			},
		};
	}

	private _nearestFreeTable(from: THREE.Vector3): { x: number; z: number } | null {
		let best: { x: number; z: number } | null = null;
		let bestDistance = Infinity;
		for (const table of this.tables) {
			if (table.dirty) continue;
			const distance = Math.hypot(table.x - from.x, table.z - from.z);
			if (distance < bestDistance) {
				best = table;
				bestDistance = distance;
			}
		}
		return best;
	}

	/** Стол после оплаты: сесть на табуретку с ближней к игроку стороны (поднос — на стол) или встать. */
	private _tableInteraction(camera: THREE.Camera): Interaction | null {
		const table = this.targetTable;
		if (!table) return null;
		// Сидя — никаких действий у стола: встаём сами, катсценой после последней ложки.
		if (this.seated || this.satDown) return null;
		return {
			text: 'сесть',
			sound: 'tray',
			run: () => {
				// Сторона стола, ближайшая к игроку: там и табуретка, с неё смотрим на центр стола.
				const dx = camera.position.x - table.x;
				const dz = camera.position.z - table.z;
				const [sx, sz] = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
				const yaw = Math.atan2(sx, sz);
				this.seated = true;
				this.satDown = true;
				this.trayPickup = 0;
				this.trayOnTablePosition.set(table.x + sx * TRAY_ON_TABLE_OFFSET, TABLE_HEIGHT, table.z + sz * TRAY_ON_TABLE_OFFSET);
				this.trayOnTableYaw = yaw;
				this.heldTray.position.copy(this.trayOnTablePosition);
				this.heldTray.rotation.set(0, yaw, 0);
				this.seat = { x: table.x + sx * STOOL_OFFSET, z: table.z + sz * STOOL_OFFSET, yaw, eyeY: SEATED_EYE_Y };
				this.onSit?.(this.seat);
			},
		};
	}

	/** Ложку — из лотка с приборами на поднос. */
	private _spoonInteraction(): Interaction | null {
		if (this.spoonTaken) return null;
		if (!this.trayHeld) return { text: 'Сначала возьмите поднос' };
		return {
			text: 'взять ложку',
			sound: 'bread',
			run: () => {
				this.spoonTaken = true;
				const pieces = this.cutleryBox.children.filter((child) => child.name === 'cutlery');
				pieces[pieces.length - 1]?.removeFromParent();
				const spoon = createSpoon();
				this.traySpoon = spoon;
				// Солянка в ложке — видна, пока несём её ко рту.
				this.spoonSoup = new THREE.Mesh(
					new THREE.CircleGeometry(0.018, 8),
					new THREE.MeshStandardMaterial({ color: SOUP_COLOR.solyanka, roughness: 0.3 })
				);
				this.spoonSoup.rotation.x = -Math.PI / 2;
				this.spoonSoup.position.set(0, 0.012, -0.05);
				this.spoonSoup.visible = false;
				spoon.add(this.spoonSoup);
				spoon.position.set(HELD_SPOON_SLOT[0], 0.006, HELD_SPOON_SLOT[1]);
				spoon.rotation.y = 0.08;
				this.heldTray.add(spoon);
			},
		};
	}

	private _breadInteraction(): Interaction | null {
		if (!this.trayHeld) return { text: 'Сначала возьмите поднос' };
		if (this.breadOnTray >= BREAD_PER_TRAY) return null;
		const next = this.breadSlices[0];
		if (!next) return null;
		return {
			text: `взять хлеб (${this.breadOnTray}/${BREAD_PER_TRAY})`,
			sound: 'bread',
			run: () => {
				this.breadSlices.shift();
				next.mesh.removeFromParent();
				const slice = createBreadSlice(next.kind);
				const [x, z] = HELD_BREAD_SLOTS[this.breadOnTray];
				slice.position.set(x, 0.008 + this.breadOnTray * 0.004, z);
				slice.rotation.y = this.breadOnTray * 0.5 - 0.2;
				this.heldTray.add(slice);
				this.breadOnTray++;
			},
		};
	}

	/** Поднос держим перед собой: позиция — от камеры, поворот — только по курсу, чтобы он оставался ровным. */
	private _updateHeldTray(camera: THREE.Camera): void {
		if (!this.trayHeld || this.trayPickup <= 0) return;
		camera.updateMatrixWorld();
		const held = this.heldPosition.copy(HELD_TRAY_OFFSET).applyMatrix4(camera.matrixWorld);
		const k = this.trayPickup;
		if (k >= 1) {
			this.heldTray.position.copy(held);
			this.heldTray.rotation.set(HELD_TRAY_TILT, camera.rotation.y, 0, 'YXZ');
			return;
		}
		// Берём со стола: поднос плывёт от стола в руки, поворот — по кратчайшей дуге.
		this.heldTray.position.lerpVectors(this.trayOnTablePosition, held, k);
		const turn = Math.atan2(Math.sin(camera.rotation.y - this.trayOnTableYaw), Math.cos(camera.rotation.y - this.trayOnTableYaw));
		this.heldTray.rotation.set(HELD_TRAY_TILT * k, this.trayOnTableYaw + turn * k, 0, 'YXZ');
	}

	/** Идёт катсцена после еды — управление у игрока заблокировано. */
	get cutsceneActive(): boolean {
		return this.cutsceneTime >= 0;
	}

	/**
	 * Катсцена после еды: встать (подняться и отойти от стола), взять поднос в руки, развернуться назад.
	 * Камеру ставит Game по onCameraPose; в конце — onStand, дальше управляет игрок.
	 */
	private _updateCutscene(dt: number): void {
		const seat = this.seat;
		if (this.cutsceneTime < 0 || !seat) return;
		this.cutsceneTime += dt;
		const t = this.cutsceneTime;
		const ease = (x: number) => {
			const c = THREE.MathUtils.clamp(x, 0, 1);
			return c * c * (3 - 2 * c);
		};
		const stand = ease((t - CUTSCENE_PAUSE) / CUTSCENE_STAND);
		const take = ease((t - CUTSCENE_PAUSE - CUTSCENE_STAND) / CUTSCENE_TAKE);
		const turn = ease((t - CUTSCENE_PAUSE - CUTSCENE_STAND - CUTSCENE_TAKE) / CUTSCENE_TURN);

		// Назад от стола — против направления взгляда сидящего.
		const backX = Math.sin(seat.yaw);
		const backZ = Math.cos(seat.yaw);
		const x = seat.x + backX * STAND_BACK * stand;
		const z = seat.z + backZ * STAND_BACK * stand;
		const y = THREE.MathUtils.lerp(seat.eyeY, STANDING_EYE_Y, stand);
		const pitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.45, -0.3, stand), 0, turn);
		const yaw = seat.yaw + Math.PI * turn;
		this.trayPickup = take;
		this.onCameraPose?.({ x, y, z, yaw, pitch });

		if (t >= CUTSCENE_PAUSE + CUTSCENE_STAND + CUTSCENE_TAKE + CUTSCENE_TURN) {
			this.cutsceneTime = -1;
			this.seated = false;
			this.trayPickup = 1;
			this.onStand?.(x, z);
		}
	}

	/** Открыть створку при выходе (переход прячет смену сцены). */
	openDoor(): void {
		this.door.open();
	}

	/** Вернуть створку в закрытое положение — при входе в столовую. */
	resetDoor(): void {
		this.door.reset();
	}

	/** camera — чтобы держать поднос перед игроком. */
	update(dt: number, camera: THREE.Camera): void {
		this.door.update(dt);
		this.dinnerLady.update(dt, camera.position);
		const fill = this.dinnerLady.bowlFill;
		// Наливают — растекается от центра; едят — убывает к центру; после последней ложки тарелка пустая.
		const left = 1 - (this.bites / BITES_TO_FINISH) * 0.75;
		const radius = (0.3 + 0.7 * fill) * left;
		this.soupInBowl.visible = fill > 0 && this.bites < BITES_TO_FINISH;
		this.soupInBowl.scale.set(radius, 1, radius);
		this._updateBite(dt);
		this._updateCutscene(dt);
		// После катсцены: камера уже в позе этого кадра — поднос встаёт перед ней.
		this._updateHeldTray(camera);
		this._updateDarkness(dt);
		this.cashier.update(dt);
	}

	/** Пол ровный: высота везде 0. */
	getHeightAt(_x: number, _z: number): number {
		return 0;
	}

	private _add(obj: THREE.Object3D, x: number, y: number, z: number, rotY = 0): THREE.Object3D {
		obj.position.set(x, y, z);
		obj.rotation.y = rotY;
		this.scene.add(obj);
		return obj;
	}

	/** Пол — метлахская плитка, потолок — побелка, стены: снизу кафель, выше — краска. */
	private _buildShell(): void {
		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(WIDTH, DEPTH),
			new THREE.MeshStandardMaterial({ map: createFloorTileTexture(WIDTH / (FLOOR_TILE * 2), DEPTH / (FLOOR_TILE * 2)), roughness: 0.6 })
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.z = CENTER_Z;
		floor.receiveShadow = true;
		this.scene.add(floor);

		const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, DEPTH), new THREE.MeshStandardMaterial({ color: '#efeee8' }));
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.set(0, HEIGHT, CENTER_Z);
		this.scene.add(ceiling);

		const paint = new THREE.MeshStandardMaterial({ color: '#e6dcbc' });
		const walls: [number, number, number, number][] = [
			// [x, z, длина, поворот]: длина — вдоль стены.
			[0, NORTH_Z, WIDTH, 0],
			[0, SOUTH_Z, WIDTH, 0],
			[-WIDTH / 2, CENTER_Z, DEPTH, Math.PI / 2],
			[WIDTH / 2, CENTER_Z, DEPTH, Math.PI / 2],
		];
		for (const [x, z, length, rot] of walls) {
			const wall = new THREE.Mesh(new THREE.BoxGeometry(length, HEIGHT, WALL_THICKNESS), paint);
			wall.position.set(x, HEIGHT / 2, z);
			wall.rotation.y = rot;
			wall.receiveShadow = true;
			this.scene.add(wall);
		}

		// За раздачей — кафель; в зале — панель масляной краской до TILE_HEIGHT с тёмной полосой-бордюром.
		const inner = WALL_THICKNESS / 2 + FINISH;
		const tiles = createWallTileTexture();
		tiles.repeat.set(WIDTH / (WALL_TILE * 2), BACK_TILE_HEIGHT / (WALL_TILE * 2));
		const tileMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35 });
		const oilPaint = new THREE.MeshStandardMaterial({ color: '#8fae9f', roughness: 0.4 });
		this._wallBand(0, NORTH_Z + inner, WIDTH, BACK_TILE_HEIGHT, 0, tileMat);
		this._wallBand(0, SOUTH_Z - inner, WIDTH, TILE_HEIGHT, Math.PI, oilPaint);
		this._wallBand(-WIDTH / 2 + inner, CENTER_Z, DEPTH, TILE_HEIGHT, Math.PI / 2, oilPaint);
		this._wallBand(WIDTH / 2 - inner, CENTER_Z, DEPTH, TILE_HEIGHT, -Math.PI / 2, oilPaint);
	}

	/** Полоса отделки стены от пола до height с бордюром поверху. rotY — плоскость смотрит в зал. */
	private _wallBand(x: number, z: number, length: number, height: number, rotY: number, material: THREE.Material): void {
		const band = new THREE.Mesh(new THREE.PlaneGeometry(length, height), material);
		band.position.set(x, height / 2, z);
		band.rotation.y = rotY;
		band.receiveShadow = true;
		this.scene.add(band);
		const border = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, MOUNT), new THREE.MeshStandardMaterial({ color: '#4f6f62', roughness: 0.35 }));
		border.position.set(x, height + 0.025, z);
		border.rotation.y = rotY;
		this.scene.add(border);
	}

	private _buildWindows(): void {
		// Окно чуть выступает из стены — поверх крашеной панели.
		const inner = WIDTH / 2 - WALL_THICKNESS / 2 - 0.03;
		for (const z of WINDOW_Z) {
			for (const side of [-1, 1]) {
				const win = createCanteenWindow(WINDOW_WIDTH, WINDOW_HEIGHT);
				// Лицом в зал: у западной стены — на восток, у восточной — на запад.
				this._add(win, side * inner, WINDOW_Y, z, -side * (Math.PI / 2));
			}
		}
	}

	/** Ряды ламп дневного света вдоль зала и точечный свет у части из них. */
	private _buildLights(): void {
		for (const x of LAMP_X) {
			for (const z of LAMP_Z) this._add(createFluorescentLamp(this.tubeMaterial), x, HEIGHT, z, Math.PI / 2);
		}
		for (const [x, z] of LIGHTS) {
			const light = new THREE.PointLight(LAMP_COLOR, 5, 9, 2);
			light.position.set(x, HEIGHT - 0.8, z);
			this.scene.add(light);
			this.lighting.push({ light, color: light.color.clone(), intensity: light.intensity, dark: CRIMSON, dim: 0.45 });
		}
	}

	/** Та же дверь, что на фасаде, изнутри: стекло светлое — за ним пасмурный день. */
	private _buildDoor(): SwingLeaf {
		const glass = new THREE.MeshBasicMaterial({ color: '#b9bcb8', side: THREE.DoubleSide });
		const { group, leaf } = createCanteenDoor(glass);
		// Лицом в зал; «наружу» у двери — это +Z мира, а у повёрнутой на π группы — −Z, отсюда знак угла.
		this._add(group, 0, 0, DOOR_Z, Math.PI);
		// Портал вокруг двери — светлая филёнка по стене.
		const surround = new THREE.Mesh(
			new THREE.BoxGeometry(CANTEEN_DOOR_WIDTH + 0.3, 3.1, 0.04),
			new THREE.MeshStandardMaterial({ color: '#d8d4c8' })
		);
		surround.position.set(0, 1.55, SOUTH_Z - WALL_THICKNESS / 2 - 0.02);
		this.scene.add(surround);
		return new SwingLeaf(leaf, -1.3);
	}

	/** У входа: раковина с зеркалом и плакатом про мытьё рук, вешалка, фикусы по углам, часы над дверью. */
	private _buildEntrance(): void {
		this._add(createWashbasin(), -3.6, 0, SOUTH_MOUNT, Math.PI);
		this.colliders.add(-3.6, SOUTH_MOUNT - 0.25, 0.3);
		const wash = createPoster(
			createTextTexture(['МОЙТЕ', 'РУКИ', 'ПЕРЕД ЕДОЙ!'], {
				width: 68,
				height: 44,
				background: '#f0ebdc',
				color: '#2c5aa0',
				font: 'bold 10px sans-serif',
				lineHeight: 13,
				top: 9,
			}),
			0.7
		);
		this._add(wash, -2.3, 1.55, SOUTH_MOUNT, Math.PI);

		this._add(createCoatRack(), EAST_MOUNT, 0, 8.4, -Math.PI / 2);
		this.colliders.add(WIDTH / 2 - 0.35, 8.4, 0.35);
		// Крона фикуса — до 0.5 м от ствола: кадку держим дальше от стен, чтобы листья не уходили в них.
		for (const x of [-5.2, 5.2]) {
			this._add(createFicus(), x, 0, SOUTH_Z - 0.75);
			this.colliders.add(x, SOUTH_Z - 0.75, 0.4);
		}
		this._add(createWallClock(), 0, 3.25, SOUTH_MOUNT, Math.PI);
	}

	/** Зал: 12 столов в два ряда, по 4 табуретки у каждого; на столах салфетницы, солонки, кое-где — чей-то поднос. */
	private _buildHall(): void {
		let index = 0;
		for (const x of TABLE_X) {
			for (let row = 0; row < TABLE_ROWS; row++) {
				const z = TABLE_Z0 + row * TABLE_STEP;
				this._buildTable(x, z, index++);
			}
		}
	}

	private _buildTable(x: number, z: number, index: number): void {
		let seed = index * 7907 + 31;
		const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

		// На паре столов кто-то не убрал за собой поднос — за такие не садятся.
		const dirty = index % 5 === 2;
		this._add(createCanteenTable(), x, 0, z);
		this.tables.push({ x, z, dirty });
		this.colliders.add(x, z, 0.5);
		// Табуретки чуть сдвинуты и повёрнуты — ими пользуются.
		const sides: [number, number][] = [
			[0, -1],
			[0, 1],
			[-1, 0],
			[1, 0],
		];
		sides.forEach(([dx, dz], i) => {
			const sx = x + dx * STOOL_OFFSET + (rand() - 0.5) * 0.08;
			const sz = z + dz * STOOL_OFFSET + (rand() - 0.5) * 0.08;
			this._add(createStool(STOOL_COLORS[(index + i) % STOOL_COLORS.length]), sx, 0, sz, rand() * Math.PI);
			this.colliders.add(sx, sz, 0.2);
		});

		// Салфетница и солонка с перечницей — посередине стола.
		const top = TABLE_HEIGHT;
		this._add(createNapkinHolder(), x, top, z, (rand() - 0.5) * 0.4);
		this._add(createShaker(), x + 0.12, top, z + 0.05);
		this._add(createShaker(true), x + 0.12, top, z - 0.04);
		if (dirty) this._add(createDirtyTray(index, index % 2 ? '#6b4a33' : '#a89f8c'), x - 0.15, top, z + 0.15, (rand() - 0.5) * 0.5);
	}

	/** Линия раздачи: столик с подносами и приборами → прилавок с витриной, котлами, мармитом и напитками → касса. */
	private _buildServingLine(): void {
		const length = COUNTER_X2 - COUNTER_X1;
		this._add(createServingCounter(length), (COUNTER_X1 + COUNTER_X2) / 2, 0, COUNTER_Z);

		// Перед началом линии: стопка подносов, лоток с приборами и лоток с нарезанным хлебом.
		this._add(createSteelTable(TRAY_TABLE_WIDTH, 0.65, COUNTER_HEIGHT), TRAY_TABLE_X, 0, COUNTER_Z);
		this.trayStack = createTrayStack(16);
		this._add(this.trayStack, TRAY_STACK_POS.x, COUNTER_TOP, TRAY_STACK_POS.z, 0.05);
		this.cutleryBox = createCutleryBox();
		this._add(this.cutleryBox, CUTLERY_POS.x, COUNTER_TOP, CUTLERY_POS.z, Math.PI / 2);
		const bread = createBreadTray();
		this.breadSlices = bread.slices.filter((slice) => slice.kind === 'white');
		this._add(bread.group, BREAD_POS.x, COUNTER_TOP, BREAD_POS.z, Math.PI / 2);
		const menu = createPoster(createMenuTexture(), 1.1);
		this._add(menu, WEST_MOUNT, 1.6, COUNTER_Z + 1.3, Math.PI / 2);

		this._buildColdSection();
		this._buildSoupSection();
		this._buildHotSection();
		this._buildDrinks();

		// Касса в конце линии: стойка, за ней на табурете — кассир, лицом к покупателям.
		const kassa = new THREE.Group();
		kassa.add(createCashDesk());
		const stool = createStool('#3f4f5a');
		stool.position.z = CASHIER_SEAT_Z;
		kassa.add(stool);
		this.cashier.group.position.z = CASHIER_SEAT_Z;
		kassa.add(this.cashier.group);
		this._add(kassa, CASH_X, 0, COUNTER_Z, -0.25);
		kassa.updateMatrixWorld(true);
		this.cashierHead.set(0, SEATED_EYE_Y + 0.05, 0).applyMatrix4(this.cashier.group.matrixWorld);

		// Раздатчица — за мармитом, лицом к посетителям.
		this._add(this.dinnerLady.group, DINNER_LADY_X, 0, DINNER_LADY_Z);
		// Точки половника — в координатах раздатчицы (она смотрит на +Z, стоит в начале своих координат).
		this.dinnerLady.setTargets(
			new THREE.Vector3(SOUP_POT_X - DINNER_LADY_X, COUNTER_TOP, BACK_Z - DINNER_LADY_Z),
			new THREE.Vector3(SOUP_BOWL.x - DINNER_LADY_X, COUNTER_TOP, SOUP_BOWL.z - DINNER_LADY_Z)
		);

		// Посетителю за прилавок не пройти: ряд коллайдеров по всей линии, от стены до стены,
		// с запасом до направляющих — к ним можно подойти вплотную.
		const railZ = COUNTER_Z + COUNTER_DEPTH / 2 + TRAY_RAIL_OFFSET;
		for (let x = -WIDTH / 2; x <= WIDTH / 2 + 0.01; x += 0.5) this.colliders.add(x, railZ - 0.35, 0.36);
	}

	/** Холодные закуски в витрине: салаты на блюдцах, хлеб, сметана в стаканах. */
	private _buildColdSection(): void {
		const [x1, x2] = COLD_X;
		const len = x2 - x1 - 0.1;
		const { group, shelves } = createDisplayCase(len);
		this._add(group, (x1 + x2) / 2, COUNTER_TOP, COUNTER_Z);
		const salads: FoodKind[][] = [['vinegret'], ['olivier'], ['cabbage']];
		const levels = [0, ...shelves];
		levels.forEach((y, level) => {
			const count = 7;
			for (let i = 0; i < count; i++) {
				const x = x1 + 0.25 + (i * (len - 0.3)) / (count - 1);
				const item =
					level === 2
						? createGlass('sourCream')
						: level === 1
							? createPlate(salads[i % 3], 0.075)
							: createPlate(i % 3 === 0 ? ['bread'] : salads[(i + 1) % 3], 0.075);
				this._add(item, x, COUNTER_TOP + y + 0.012, COUNTER_Z + (level === 0 ? 0.12 : 0.02));
				if (level === 1 && i % 2 === 0) this._add(createPlate(salads[(i + 2) % 3], 0.075), x + 0.05, COUNTER_TOP + y + 0.012, COUNTER_Z - 0.14);
			}
		});
	}

	/** Первое — солянка: два котла у раздатчицы, стопка глубоких тарелок, налитые тарелки у края. */
	private _buildSoupSection(): void {
		const [x1] = SOUP_X;
		// Из правой кастрюли раздатчица черпает своим половником — там своего нет.
		this._add(createSoupPot('solyanka', false), SOUP_POT_X, COUNTER_TOP, BACK_Z);
		this._add(createSoupPot('solyanka'), x1 + 1.05, COUNTER_TOP, BACK_Z);
		this._add(createPlateStack(9, true), x1 + 1.6, COUNTER_TOP, BACK_Z);
		// Одна тарелка — между кастрюлями ближе к посетителю: раздатчица наливает в неё, солянка появляется к концу.
		const bowl = createBowl('solyanka');
		this.soupBowl = bowl;
		this.soupInBowl = bowl.getObjectByName('soup')!;
		this.soupInBowl.visible = false;
		this._add(bowl, SOUP_BOWL.x, COUNTER_TOP, SOUP_BOWL.z);
	}

	/** Второе: мармит с гарнирами, котлетами и рыбой; перед ним уже разложенные порции, сбоку — стопки тарелок. */
	private _buildHotSection(): void {
		const [x1, x2] = HOT_X;
		this._add(createMarmite(x2 - x1 - 0.1, ['mash', 'buckwheat', 'pasta', 'cutlet', 'fish']), (x1 + x2) / 2, COUNTER_TOP, COUNTER_Z - 0.06);
		const portions: FoodKind[][] = [
			['mash', 'cutlet'],
			['buckwheat', 'cutlet'],
			['pasta', 'fish'],
			['mash', 'fish'],
		];
		portions.forEach((food, i) => {
			// Порции — на полочке-экране над мармитом, к посетителю.
			this._add(createPlate(food, 0.1), x1 + 0.35 + i * 0.47, COUNTER_TOP + 0.456, COUNTER_Z + 0.16);
		});
		this._add(createPlateStack(12), x2 - 0.05, COUNTER_TOP, BACK_Z - 0.12);
	}

	/** Напитки: ряды гранёных стаканов с компотом, чаем и киселём прямо на прилавке; за прилавком — титан. */
	private _buildDrinks(): void {
		const [x1, x2] = DRINK_X;
		const kinds: DrinkKind[] = ['kompot', 'kompot', 'tea', 'kisel'];
		for (let r = 0; r < 4; r++) {
			for (let c = 0; c < 6; c++) {
				const x = x1 + 0.12 + c * ((x2 - x1 - 0.24) / 5);
				this._add(createGlass(kinds[r]), x, COUNTER_TOP, FRONT_Z + 0.08 - r * 0.1);
			}
		}
		this._add(createWaterBoiler(), (x1 + x2) / 2, 0, NORTH_Z + 0.9);
	}

	/** Задняя стена за раздачей: стеллаж с посудой, окно выдачи с кухни, дверь на кухню, лозунг под потолком. */
	private _buildBackWall(): void {
		const face = NORTH_MOUNT;
		this._add(createDishRack(1.6), -3.6, 0, face + 0.25);

		// Окно выдачи с кухни: тёмный проём со стальным подоконником, в глубине — тёплый свет кухни.
		const hatch = new THREE.Mesh(
			new THREE.PlaneGeometry(1.4, 0.8),
			new THREE.MeshStandardMaterial({ color: '#3a3228', emissive: '#4a3a24', emissiveIntensity: 0.6 })
		);
		hatch.position.set(-0.6, 1.4, face + 0.02);
		this.scene.add(hatch);
		const sill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: '#c3c7c9', roughness: 0.35, metalness: 0.6 }));
		sill.position.set(-0.6, 1.0, face + 0.17);
		this.scene.add(sill);
		for (let i = 0; i < 3; i++) this._add(createPlateStack(5 + i * 2, i === 1), -1.1 + i * 0.4, 1.02, face + 0.2);

		// Дверь на кухню — обитая жестью, с табличкой.
		const kitchenDoor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.05, 0.05), new THREE.MeshStandardMaterial({ color: '#b8b9b4', roughness: 0.5, metalness: 0.3 }));
		kitchenDoor.position.set(1.4, 1.025, face + 0.03);
		this.scene.add(kitchenDoor);
		const staff = createPoster(
			createTextTexture(['ПОСТОРОННИМ', 'ВХОД', 'ВОСПРЕЩЁН'], {
				width: 48,
				height: 28,
				background: '#f2efe6',
				color: '#b8342a',
				font: 'bold 8px sans-serif',
				lineHeight: 8,
				top: 6,
			}),
			0.28
		);
		// Табличка — на лицевой стороне двери (полотно толщиной 0.05 стоит в face + 0.03).
		this._add(staff, 1.4, 1.6, face + 0.055);

		const slogan = createPoster(
			createTextTexture(['ПРИЯТНОГО АППЕТИТА!'], {
				width: 200,
				height: 18,
				background: '#e6dcbc',
				color: '#b8342a',
				font: 'bold 14px sans-serif',
				lineHeight: 14,
				top: 9,
			}),
			0.5
		);
		this._add(slogan, 0, 3.0, face);

		// Плакат на боковой стене у кассы.
		const bread = createPoster(
			createTextTexture(['ХЛЕБ —', 'ВСЕМУ', 'ГОЛОВА'], {
				width: 44,
				height: 56,
				background: '#d9a23a',
				color: '#6a2e1a',
				font: 'bold 11px sans-serif',
				lineHeight: 15,
				top: 12,
			}),
			1.0
		);
		this._add(bread, EAST_MOUNT, 1.9, -5.4, -Math.PI / 2);
	}

	/** Столы для грязной посуды напротив раздачи: подносы с пустыми тарелками и стаканами, табличка. */
	private _buildReturnTables(): void {
		RETURN_X.forEach((x, t) => {
			this._add(createSteelTable(RETURN_LENGTH, 0.6), x, 0, RETURN_Z);
			for (let dx = -RETURN_LENGTH / 2 + 0.3; dx <= RETURN_LENGTH / 2 - 0.3 + 0.01; dx += 0.5) this.colliders.add(x + dx, RETURN_Z, 0.35);
			const trays = t === 0 ? 3 : 2;
			for (let i = 0; i < trays; i++) {
				const tray = createDirtyTray(t * 10 + i, i % 2 ? '#a89f8c' : '#6b4a33');
				this._add(tray, x - 0.8 + i * 0.55, 0.86, RETURN_Z + (i % 2) * 0.05, (i - 1) * 0.1);
				// Иногда подносы ставят один на другой.
				if (i === 0) this._add(createDirtyTray(t * 10 + 5), x - 0.8, 0.86 + 0.06, RETURN_Z + 0.02, 0.15);
			}
			const sign = createPoster(
				createTextTexture(['ДЛЯ ГРЯЗНОЙ', 'ПОСУДЫ'], {
					width: 56,
					height: 22,
					background: '#f2efe6',
					color: '#2a2a2a',
					font: 'bold 8px sans-serif',
					lineHeight: 9,
					top: 6,
				}),
				0.22
			);
			// Табличка на стойке у дальнего края стола, лицом к залу.
			const stand = new THREE.Group();
			const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#c3c7c9', metalness: 0.6, roughness: 0.35 }));
			post.position.y = 0.15;
			stand.add(post);
			sign.position.set(0, 0.36, 0.012);
			stand.add(sign);
			this._add(stand, x + 0.9 * (t === 0 ? 1 : -1), 0.86, RETURN_Z - 0.2);
		});
		// Глубокие тарелки стопкой — уже собранные.
		this._add(createPlateStack(6, true), RETURN_X[1] + 0.8, 0.86, RETURN_Z);
	}
}
