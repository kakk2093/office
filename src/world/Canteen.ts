import * as THREE from 'three';
import type { CircleColliders, Circle } from '../physics/CircleColliders.js';
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
	createBowlShards,
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
import { DinnerLady, Cashier, Zombie } from './People.js';
import { PLAYER_NAME, type Interaction, type Seat, type CameraPose, type Dialogue } from '../core/Interaction.js';

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

/** Касса — сразу за концом прилавка. В катсцене она исчезает, и на её месте — проход за прилавок. */
const CASH_X = 4.3;
/** Коллайдеры ряда у прилавка восточнее этого X перекрывают проход. */
const PASSAGE_FROM_X = COUNTER_X2 - 0.2;
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

/** Стол для грязной посуды — напротив раздачи, слева от прохода (справа — свободно: там стол, за который садимся). */
const RETURN_Z = -4.3;
const RETURN_X = -4.2;
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
 * взять поднос со стола в руки → развернуться через правое плечо к пустой раздаче → поднос падает, тряска.
 * Потом управление возвращается игроку.
 */
const CUTSCENE_PAUSE = 0.6;
const CUTSCENE_STAND = 1.2;
const CUTSCENE_TAKE = 0.8;
const CUTSCENE_TURN = 2.4;
/**
 * Обернулись — у раздачи темно (CUTSCENE_DARK), потом дверь распахивается за DOOR_SLAM и загорается
 * красный свет; через CUTSCENE_REACT поднос выпадает из рук. Тряска камеры — от хлопка двери и от удара подноса.
 */
const CUTSCENE_DARK = 1.4;
const DOOR_SLAM = 0.12;
const CUTSCENE_REACT = 0.9;
const SLAM_SHAKE = 0.5;
const CUTSCENE_SHAKE = 0.9;
const SHAKE_OFFSET = 0.035;
const SHAKE_ANGLE = 0.035;
const GRAVITY = 9.8;
/** Насколько отходим от табуретки, вставая (от стола), м. */
const STAND_BACK = 0.6;
const STANDING_EYE_Y = 1.7;

/** Дверь за раздачей (петли слева, открывается в зал); за ней — пустота, залитая красным светом. */
const KITCHEN_DOOR_X = 1.4;
const KITCHEN_DOOR_WIDTH = 0.9;
const KITCHEN_DOOR_HEIGHT = 2.05;
const KITCHEN_DOOR_OPEN = -1.75;
const KITCHEN_ROOM = { width: 3, depth: 3, height: 2.8 };
/** Кровавый свет из-за двери: цвет света в зале, цвет самой пустоты (слепяще-яркий) и яркость; первые мгновения мигает. */
const BLOOD = new THREE.Color('#ff1020');
const BLOOD_GLARE = new THREE.Color('#ff3030');
const KITCHEN_LIGHT = 30;
const FLICKER_TIME = 0.35;

/** Входная дверь в южной стене; створка при выходе открывается наружу (от игрока). */
const DOOR_Z = SOUTH_Z - WALL_THICKNESS / 2 - 0.05;

/**
 * Побег (продолжение катсцены после разбитого подноса): из распахнутой двери выходят зомби (ESCAPE_EMERGE) →
 * герой разворачивается и бежит к выходу по проходу → дёргает дверь (ESCAPE_RATTLE) — «Не поддаётся.» →
 * оборачивается (ESCAPE_TURN): в зале уже толпа зомби и идут на него → смотрит (ESCAPE_LOOK) — «Ну всё, суки.» →
 * достаёт обрез (ESCAPE_DRAW), управление — игроку.
 */
const ESCAPE_EMERGE = 2.6;
const ESCAPE_RUN_SPEED = 4.2;
/** Как быстро поворачивается на бегу, рад/с; длина шага бегом, м; качание головы, м. */
const ESCAPE_TURN_RATE = 5;
const ESCAPE_STEP = 1.5;
const ESCAPE_BOB = 0.045;
const ESCAPE_RATTLE_START = 0.35;
const ESCAPE_RATTLE = 0.9;
const ESCAPE_TURN = 1.1;
const ESCAPE_LOOK = 0.9;
const ESCAPE_DRAW = 0.6;
/** Реплики побега закрываются сами — столько висят допечатанными, с. */
const ESCAPE_LINE_HOLD = 1.2;
/** Где герой останавливается у двери (лицом к ней). */
const ESCAPE_DOOR_STOP = SOUTH_Z - 1.1;
/** Зомби: откуда выходят (из красной пустоты за дверью) и куда доходят за прилавком. */
const ZOMBIE_EMERGE: { from: [number, number]; to: [number, number] }[] = [
	{ from: [KITCHEN_DOOR_X, NORTH_Z - 0.8], to: [0.7, -8.4] },
	{ from: [KITCHEN_DOOR_X + 0.2, NORTH_Z - 1.9], to: [2.1, -8.6] },
];
/** Где стоят зомби в зале, когда герой оборачивается от двери (сколько точек — столько и зомби): по проходу
 * и у раздачи, в 9–14 м от него. */
const ZOMBIE_HALL: [number, number][] = [
	[-0.4, -0.4],
	[0.9, -1.7],
	[-1.5, -2.9],
	[1.6, 0.6],
	[2.0, -3.6],
	[-2.4, -4.8],
];
const ZOMBIE_WALK_SPEED = 0.6;

type EscapePhase = 'emerge' | 'run' | 'door' | 'turn' | 'draw';

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
	/** Дверь за раздачей (группа на петле), красный свет из-за неё и сама пустота за ней (без освещения — ровная заливка). */
	private kitchenDoor!: THREE.Group;
	private kitchenLight!: THREE.PointLight;
	private readonly voidMaterial = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide });
	/** Время с момента, когда дверь распахнулась, с (−1 — ещё закрыта). */
	private slamTime = -1;
	/** Касса со стойкой, табуретом и кассиром — исчезает в катсцене. */
	private cashDesk!: THREE.Group;
	/** Коллайдеры, перекрывающие проход за прилавок на месте кассы. */
	private readonly passageColliders: Circle[] = [];
	/** Хлеб на подносе — при падении разлетается по полу. */
	private readonly trayBread: THREE.Group[] = [];
	/** Поднос выронили: летит (trayFalling) и лежит на полу; crashTime — с удара, с (−1 — ещё не упал). */
	private trayDropped = false;
	private trayFalling = false;
	private readonly trayVelocity = new THREE.Vector3();
	private crashTime = -1;
	/** Game играет звук разбитой посуды и страшный звук распахнувшейся двери. */
	onTrayCrash: (() => void) | null = null;
	onDoorSlam: (() => void) | null = null;
	/** Побег: реплика героя (катсцена ждёт её конца), шаги на бегу, дёрнули входную дверь, достать обрез. */
	onDialogue: ((dialogue: Dialogue) => void) | null = null;
	onFootstep: (() => void) | null = null;
	onDoorRattle: (() => void) | null = null;
	onDrawWeapon: (() => void) | null = null;
	/** Зомби зала: до побега спрятаны; Game регистрирует их как врагов (попадания, стоны). */
	readonly zombies: Zombie[] = [];
	/** Створка входной двери — дёргается, когда герой пытается выйти. */
	private doorLeaf!: THREE.Object3D;
	/** Побег идёт: фаза, время в ней, поза камеры, путь, шаги; null — ещё не начался или закончился (см. escaped). */
	private escape: {
		phase: EscapePhase;
		t: number;
		x: number;
		z: number;
		yaw: number;
		pitch: number;
		waypoints: THREE.Vector2[];
		stepDistance: number;
		bobPhase: number;
		turnFrom: number;
		dialogueStarted: boolean;
		dialogueDone: boolean;
	} | null = null;
	/** Побег закончился — управление у игрока, зомби идут на него. */
	private escaped = false;
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

		for (let i = 0; i < ZOMBIE_HALL.length; i++) {
			const zombie = new Zombie();
			zombie.group.visible = false;
			zombie.speed = ZOMBIE_WALK_SPEED;
			const margin = 0.25;
			zombie.bounds = { minX: -WIDTH / 2 + margin, maxX: WIDTH / 2 - margin, minZ: NORTH_Z + margin, maxZ: SOUTH_Z - margin };
			this.scene.add(zombie.group);
			this.zombies.push(zombie);
		}
	}

	/**
	 * Текущий шаг цепочки — первое, что ещё не сделано: текст задачи и точка над предметом для маркера HUD.
	 * null — задачи нет (например, идёт катсцена).
	 */
	get objective(): { text: string; at: THREE.Vector3 | null } | null {
		const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		// После побега — перебить зомби (без маркеров: они и так идут на тебя), потом — к красной двери за раздачей.
		// TODO: у красной двери пока ничего не происходит (и зайти за неё нельзя: не пускает граница зала).
		if (this.escaped) {
			const killed = this.zombies.filter((zombie) => !zombie.alive).length;
			if (killed < this.zombies.length) return { text: `Убей всех (${killed}/${this.zombies.length})`, at: null };
			return { text: 'Иди к красной двери', at: at(KITCHEN_DOOR_X, KITCHEN_DOOR_HEIGHT + 0.2, NORTH_Z + WALL_THICKNESS / 2) };
		}
		// Разбили поднос — дальше катсцена побега, задач нет.
		if (this.trayDropped) return null;
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
		if (this.trayDropped) return null;
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
			spots.push({ x: this.targetTable.x, y: TABLE_HEIGHT, z: this.targetTable.z, reach: 2.2, get: () => this._tableInteraction() });
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
					{ speaker: PLAYER_NAME, text: 'Солянку целую.', voice: 'player' },
					{ speaker: 'Раздатчица', text: 'С собой что-то будет?', voice: 'dinnerLady' },
					{ speaker: PLAYER_NAME, text: 'Нет.', voice: 'player' },
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

	/** Катсцена после еды позади: поднос разбит, управление снова у игрока. */
	get finished(): boolean {
		return this.trayDropped && !this.cutsceneActive;
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
		this._eatBread();
		this.darknessTarget = THREE.MathUtils.clamp((this.bites - MUSIC_FADE_BITE) / (BITES_TO_FINISH - MUSIC_FADE_BITE), 0, 1);
		return this.bites;
	}

	/**
	 * Хлеб едят вприкуску: куски по очереди, каждый — за равную долю ложек. Кусок убывает с одного края
	 * (дальний край остаётся на месте), доеденный — пропадает.
	 */
	private _eatBread(): void {
		const perSlice = BITES_TO_FINISH / this.trayBread.length;
		this.trayBread.forEach((slice, i) => {
			const left = THREE.MathUtils.clamp(1 - (this.bites - i * perSlice) / perSlice, 0, 1);
			if (left === 1) return;
			// Исходное место куска на подносе — в userData, чтобы сдвигать от него, а не накапливать.
			const origin: THREE.Vector3 = (slice.userData.origin ??= slice.position.clone());
			slice.visible = left > 0;
			if (!slice.visible) return;
			slice.scale.x = left;
			slice.position.copy(origin);
			slice.translateX(-(1 - left) * 0.05);
		});
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
					{ speaker: PLAYER_NAME, text: 'Картой.', voice: 'player' },
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

	/** Стол после оплаты: сесть на табуретку спиной к кассе (поднос — на стол). */
	private _tableInteraction(): Interaction | null {
		const table = this.targetTable;
		if (!table) return null;
		// Сидя — никаких действий у стола: встаём сами, катсценой после последней ложки.
		if (this.seated || this.satDown) return null;
		return {
			text: 'сесть',
			sound: 'tray',
			run: () => {
				// Садимся всегда спиной к кассе: табуретка — со стороны стола, ближайшей к кассе, с неё смотрим на центр стола.
				const dx = this.cashierHead.x - table.x;
				const dz = this.cashierHead.z - table.z;
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
				this.trayBread.push(slice);
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
	 * Катсцена после еды: встать (подняться и отойти от стола), взять поднос в руки, развернуться назад —
	 * а за спиной раздача пуста, с кухни льётся кровавый свет. Поднос падает из рук, посуда бьётся, камеру трясёт.
	 * Камеру ставит Game по onCameraPose; в конце — onStand, дальше управляет игрок.
	 */
	private _updateCutscene(dt: number): void {
		const seat = this.seat;
		if (this.cutsceneTime < 0 || !seat) return;
		if (this.escape) {
			this._updateEscape(dt);
			return;
		}
		// Пока игрок сидит спиной к раздаче — всё меняется незаметно.
		if (this.cutsceneTime === 0) this._emptyHall();
		this.cutsceneTime += dt;
		if (this.crashTime >= 0) this.crashTime += dt;
		if (this.slamTime >= 0) this.slamTime += dt;
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
		// Разворот через правое плечо.
		const yaw = seat.yaw - Math.PI * turn;
		this.trayPickup = take;

		// Обернулись — темно; дверь распахивается, загорается красный свет.
		const slamAt = CUTSCENE_PAUSE + CUTSCENE_STAND + CUTSCENE_TAKE + CUTSCENE_TURN + CUTSCENE_DARK;
		if (t >= slamAt && this.slamTime < 0) {
			this.slamTime = 0;
			this._openKitchenDoor();
		}
		this._updateKitchenDoor();

		// Испугались — поднос выскальзывает из рук и падает к ногам.
		if (t >= slamAt + CUTSCENE_REACT && this.trayHeld) {
			this.trayHeld = false;
			this.trayDropped = true;
			this.trayFalling = true;
			this.trayVelocity.set(Math.sin(yaw) * 0.35, 0.3, Math.cos(yaw) * 0.35);
		}

		// Тряска: вздрогнули от хлопка двери (слабее) и от удара подноса; обе быстро затухают.
		const fade = (time: number, duration: number) => (time < 0 ? 0 : (1 - Math.min(1, time / duration)) ** 2);
		const a = 0.5 * fade(this.slamTime, SLAM_SHAKE) + fade(this.crashTime, CUTSCENE_SHAKE);
		const shakeX = Math.sin(t * 71) * SHAKE_OFFSET * a;
		const shakeY = Math.sin(t * 53 + 1) * SHAKE_OFFSET * a;
		const shakeYaw = Math.sin(t * 47 + 2) * SHAKE_ANGLE * a;
		const shakePitch = Math.sin(t * 61 + 3) * SHAKE_ANGLE * a;
		this.onCameraPose?.({ x: x + shakeX, y: y + shakeY, z, yaw: yaw + shakeYaw, pitch: pitch + shakePitch });

		// Дверь распахнулась — из неё сразу выходят зомби.
		if (this.slamTime >= 0 && !this.zombies[0].group.visible) this._emergeZombies();
		if (this.crashTime >= CUTSCENE_SHAKE) {
			this.escape = {
				phase: 'emerge',
				t: 0,
				x,
				z,
				yaw,
				pitch,
				waypoints: [],
				stepDistance: 0,
				bobPhase: 0,
				turnFrom: yaw,
				dialogueStarted: false,
				dialogueDone: false,
			};
		}
	}

	/** Двое выходят из красной пустоты за распахнутой дверью за прилавок — видно поверх него. Идут насквозь (без коллайдеров). */
	private _emergeZombies(): void {
		ZOMBIE_EMERGE.forEach(({ from, to }, i) => {
			const zombie = this.zombies[i];
			zombie.group.visible = true;
			zombie.group.position.set(from[0], 0, from[1]);
			zombie.group.rotation.y = 0;
			zombie.target = new THREE.Vector3(to[0], 0, to[1]);
			zombie.stopDistance = 0.05;
			zombie.speed = 0.9;
		});
	}

	/** Где встаёт игрок, когда бой начинается заново (после смерти): у входной двери, лицом в зал. */
	readonly fightSpawn = { x: 0, z: ESCAPE_DOOR_STOP, yaw: 0 };

	/**
	 * Бой заново (игрок погиб): старые зомби с останками и кровью убираются, новые — на местах в зале, сразу охотятся.
	 * Game после этого заново регистрирует zombies.
	 */
	restartFight(): void {
		for (const zombie of this.zombies) zombie.dispose();
		this.zombies.length = 0;
		for (const [x, z] of ZOMBIE_HALL) {
			const zombie = new Zombie();
			const margin = 0.25;
			zombie.bounds = { minX: -WIDTH / 2 + margin, maxX: WIDTH / 2 - margin, minZ: NORTH_Z + margin, maxZ: SOUTH_Z - margin };
			zombie.group.position.set(x, 0, z);
			zombie.group.rotation.y = Math.atan2(this.fightSpawn.x - x, this.fightSpawn.z - z);
			zombie.target = new THREE.Vector3(this.fightSpawn.x, 0, this.fightSpawn.z);
			zombie.stopDistance = 1.0;
			zombie.speed = ZOMBIE_WALK_SPEED;
			zombie.colliders = this.colliders;
			zombie.hunting = true;
			this.scene.add(zombie.group);
			this.zombies.push(zombie);
		}
	}

	/** Пока герой у двери спиной к залу — все зомби уже в зале, стоят лицом к нему (пойдут, когда он обернётся). */
	private _zombiesInHall(): void {
		ZOMBIE_HALL.forEach(([x, z], i) => {
			const zombie = this.zombies[i];
			zombie.group.visible = true;
			zombie.group.position.set(x, 0, z);
			zombie.group.rotation.y = Math.atan2(-x, ESCAPE_DOOR_STOP - z);
			zombie.target = null;
			zombie.stopDistance = 1.0;
			zombie.speed = ZOMBIE_WALK_SPEED;
			zombie.colliders = this.colliders;
		});
	}

	/** Побег: фазы — см. ESCAPE_*. Камеру ведём сами (onCameraPose); игрок всё ещё «сидит» — управления нет. */
	private _updateEscape(dt: number): void {
		const e = this.escape!;
		e.t += dt;
		let bob = 0;
		const turnToward = (want: number, rate: number) => {
			const diff = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));
			e.yaw += THREE.MathUtils.clamp(diff, -rate * dt, rate * dt);
			return diff;
		};
		const ease = (k: number) => {
			const c = THREE.MathUtils.clamp(k, 0, 1);
			return c * c * (3 - 2 * c);
		};
		const next = (phase: EscapePhase) => {
			e.phase = phase;
			e.t = 0;
			e.turnFrom = e.yaw;
			e.dialogueStarted = false;
			e.dialogueDone = false;
		};
		const say = (text: string) => {
			if (e.dialogueStarted) return;
			e.dialogueStarted = true;
			this.onDialogue?.({
				lines: [{ speaker: PLAYER_NAME, text, voice: 'player', autoClose: ESCAPE_LINE_HOLD }],
				onEnd: () => (e.dialogueDone = true),
			});
		};

		switch (e.phase) {
			case 'emerge':
				// Смотрим, как они выходят; взгляд чуть опускается к ним.
				e.pitch = THREE.MathUtils.lerp(e.pitch, -0.05, 1 - Math.exp(-dt * 2));
				if (e.t >= ESCAPE_EMERGE) {
					// Путь к выходу: в проход между рядами столов, по нему — к двери.
					e.waypoints = [new THREE.Vector2(0, e.z), new THREE.Vector2(0, ESCAPE_DOOR_STOP)];
					next('run');
				}
				break;
			case 'run': {
				const target = e.waypoints[0];
				// Камера смотрит вдоль −Z при yaw 0: yaw на точку — atan2(−dx, −dz).
				const diff = turnToward(Math.atan2(-(target.x - e.x), -(target.y - e.z)), ESCAPE_TURN_RATE);
				e.pitch = THREE.MathUtils.lerp(e.pitch, 0, 1 - Math.exp(-dt * 4));
				// Пока разворачивается — почти стоит; бежит, когда смотрит туда, куда бежит.
				const speed = ESCAPE_RUN_SPEED * Math.max(0, 1 - Math.abs(diff) / 1.2);
				const distance = Math.hypot(target.x - e.x, target.y - e.z);
				const step = Math.min(speed * dt, distance);
				if (distance > 1e-6) {
					e.x += ((target.x - e.x) / distance) * step;
					e.z += ((target.y - e.z) / distance) * step;
				}
				e.stepDistance += step;
				e.bobPhase += (step / ESCAPE_STEP) * Math.PI;
				if (e.stepDistance >= ESCAPE_STEP) {
					e.stepDistance -= ESCAPE_STEP;
					this.onFootstep?.();
				}
				bob = Math.abs(Math.sin(e.bobPhase)) * ESCAPE_BOB;
				if (distance < 0.05) {
					e.waypoints.shift();
					if (e.waypoints.length === 0) {
						this._zombiesInHall();
						next('door');
					}
				}
				break;
			}
			case 'door': {
				// Лицом к двери (+Z); дёргаем — створка дребезжит, но не открывается.
				turnToward(Math.PI, ESCAPE_TURN_RATE);
				const r = e.t - ESCAPE_RATTLE_START;
				if (r >= 0 && r < ESCAPE_RATTLE) {
					if (r - dt < 0) this.onDoorRattle?.();
					this.doorLeaf.rotation.y = -Math.abs(Math.sin(r * 38)) * 0.025 * (1 - r / ESCAPE_RATTLE);
				} else this.doorLeaf.rotation.y = 0;
				if (r >= ESCAPE_RATTLE + 0.2) say('Не поддаётся.');
				if (e.dialogueDone) {
					// Оборачивается — а они уже идут.
					for (const zombie of this.zombies) zombie.target = new THREE.Vector3(e.x, 0, e.z);
					next('turn');
				}
				break;
			}
			case 'turn': {
				// Оборачивается к залу — через левое плечо; смотрит на идущих к нему.
				e.yaw = e.turnFrom + Math.PI * ease(e.t / ESCAPE_TURN);
				if (e.t >= ESCAPE_TURN + ESCAPE_LOOK) say('Ну всё, суки.');
				if (e.dialogueDone) {
					this.onDrawWeapon?.();
					next('draw');
				}
				break;
			}
			case 'draw':
				if (e.t >= ESCAPE_DRAW) {
					this.escape = null;
					this.escaped = true;
					this.cutsceneTime = -1;
					this.seated = false;
					this.onCameraPose?.({ x: e.x, y: STANDING_EYE_Y, z: e.z, yaw: e.yaw, pitch: e.pitch });
					this.onStand?.(e.x, e.z);
					return;
				}
				break;
		}
		this.onCameraPose?.({ x: e.x, y: STANDING_EYE_Y + bob, z: e.z, yaw: e.yaw, pitch: e.pitch });
	}

	/**
	 * Начало катсцены, пока игрок сидит спиной к раздаче: раздатчица и касса с кассиром исчезают
	 * (на месте кассы — проход за прилавок, к двери).
	 */
	private _emptyHall(): void {
		this.dinnerLady.group.visible = false;
		this.cashDesk.visible = false;
		for (const circle of this.passageColliders) this.colliders.remove(circle);
	}

	/** Дверь распахивается: звук, коллайдеры открытой створки (она стоит поперёк стены — сквозь неё не пройти). */
	private _openKitchenDoor(): void {
		this.onDoorSlam?.();
		const { x, z } = this.kitchenDoor.position;
		for (const d of [0.3, 0.7]) {
			this.colliders.add(x + Math.cos(KITCHEN_DOOR_OPEN) * d, z - Math.sin(KITCHEN_DOOR_OPEN) * d, 0.12);
		}
	}

	/** Створка резко распахивается и отскакивает; свет за ней вспыхивает, мигает и горит ровно. */
	private _updateKitchenDoor(): void {
		const s = this.slamTime;
		if (s < 0) return;
		const swing = Math.min(1, s / DOOR_SLAM);
		const after = s - DOOR_SLAM;
		const bounce = after > 0 ? Math.sin(after * 30) * 0.12 * Math.exp(-after * 6) : 0;
		this.kitchenDoor.rotation.y = KITCHEN_DOOR_OPEN * (1 - (1 - swing) ** 3) - bounce;
		const on = s > FLICKER_TIME || Math.sin(s * 70) > -0.2 ? 1 : 0.15;
		this.kitchenLight.intensity = KITCHEN_LIGHT * on;
		this.voidMaterial.color.copy(BLOOD_GLARE).multiplyScalar(on);
	}

	/** Поднос летит по параболе и кувыркается; об пол — тарелка вдребезги, хлеб и ложка разлетаются. */
	private _updateFallingTray(dt: number): void {
		if (!this.trayFalling) return;
		const tray = this.heldTray;
		this.trayVelocity.y -= GRAVITY * dt;
		tray.position.addScaledVector(this.trayVelocity, dt);
		// Ближний край уходит вниз, поднос заваливается набок.
		tray.rotation.x += 2.5 * dt;
		tray.rotation.z += 1.2 * dt;
		if (tray.position.y > 0.005) return;

		this.trayFalling = false;
		tray.position.y = 0.005;
		tray.rotation.set(0, tray.rotation.y + 0.4, 0.06, 'YXZ');
		tray.updateMatrixWorld(true);

		const impact = this.soupBowl.getWorldPosition(new THREE.Vector3());
		this.soupBowl.removeFromParent();
		this._add(createBowlShards(), impact.x, 0, impact.z, Math.random() * Math.PI * 2);

		// Хлеб и ложка слетают с подноса на пол, рядом.
		const scatter = (obj: THREE.Object3D, distance: number, y: number) => {
			this.scene.attach(obj);
			const angle = Math.random() * Math.PI * 2;
			obj.position.set(obj.position.x + Math.cos(angle) * distance, y, obj.position.z + Math.sin(angle) * distance);
			obj.rotation.set(0, Math.random() * Math.PI * 2, 0);
		};
		this.trayBread.forEach((slice, i) => scatter(slice, 0.2 + i * 0.15, 0));
		if (this.traySpoon) scatter(this.traySpoon, 0.3, 0);

		this.crashTime = 0;
		this.onTrayCrash?.();
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
		this._updateFallingTray(dt);
		this._updateDarkness(dt);
		this.cashier.update(dt);
		// После побега зомби идут туда, где игрок, и бьют, подойдя.
		if (this.escaped) {
			for (const zombie of this.zombies) {
				zombie.hunting = true;
				zombie.target?.set(camera.position.x, 0, camera.position.z);
			}
		}
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
		// Северная стена — с дверным проёмом: слева и справа от него и перемычка над ним.
		const doorL = KITCHEN_DOOR_X - KITCHEN_DOOR_WIDTH / 2;
		const doorR = KITCHEN_DOOR_X + KITCHEN_DOOR_WIDTH / 2;
		const walls: [number, number, number, number][] = [
			// [x, z, длина, поворот]: длина — вдоль стены.
			[(doorL - WIDTH / 2) / 2, NORTH_Z, doorL + WIDTH / 2, 0],
			[(doorR + WIDTH / 2) / 2, NORTH_Z, WIDTH / 2 - doorR, 0],
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
		const lintel = new THREE.Mesh(new THREE.BoxGeometry(KITCHEN_DOOR_WIDTH, HEIGHT - KITCHEN_DOOR_HEIGHT, WALL_THICKNESS), paint);
		lintel.position.set(KITCHEN_DOOR_X, (HEIGHT + KITCHEN_DOOR_HEIGHT) / 2, NORTH_Z);
		this.scene.add(lintel);

		// За раздачей — кафель; в зале — панель масляной краской до TILE_HEIGHT с тёмной полосой-бордюром.
		const inner = WALL_THICKNESS / 2 + FINISH;
		// Кафель за раздачей — тремя кусками вокруг проёма; сдвиг текстуры — чтобы швы шли как по целой стене.
		const tileBand = (x1: number, x2: number, bottom: number): void => {
			const tiles = createWallTileTexture();
			tiles.repeat.set((x2 - x1) / (WALL_TILE * 2), (BACK_TILE_HEIGHT - bottom) / (WALL_TILE * 2));
			tiles.offset.set((x1 + WIDTH / 2) / (WALL_TILE * 2), bottom / (WALL_TILE * 2));
			const material = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35 });
			this._wallBand((x1 + x2) / 2, NORTH_Z + inner, x2 - x1, BACK_TILE_HEIGHT - bottom, 0, material, bottom);
		};
		tileBand(-WIDTH / 2, doorL, 0);
		tileBand(doorR, WIDTH / 2, 0);
		tileBand(doorL, doorR, KITCHEN_DOOR_HEIGHT);
		const oilPaint = new THREE.MeshStandardMaterial({ color: '#8fae9f', roughness: 0.4 });
		this._wallBand(0, SOUTH_Z - inner, WIDTH, TILE_HEIGHT, Math.PI, oilPaint);
		this._wallBand(-WIDTH / 2 + inner, CENTER_Z, DEPTH, TILE_HEIGHT, Math.PI / 2, oilPaint);
		this._wallBand(WIDTH / 2 - inner, CENTER_Z, DEPTH, TILE_HEIGHT, -Math.PI / 2, oilPaint);
	}

	/** Полоса отделки стены высотой height от bottom (по умолчанию от пола) с бордюром поверху. rotY — плоскость смотрит в зал. */
	private _wallBand(x: number, z: number, length: number, height: number, rotY: number, material: THREE.Material, bottom = 0): void {
		const band = new THREE.Mesh(new THREE.PlaneGeometry(length, height), material);
		band.position.set(x, bottom + height / 2, z);
		band.rotation.y = rotY;
		band.receiveShadow = true;
		this.scene.add(band);
		const border = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, MOUNT), new THREE.MeshStandardMaterial({ color: '#4f6f62', roughness: 0.35 }));
		border.position.set(x, bottom + height + 0.025, z);
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
		this.doorLeaf = leaf;
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
		this.cashDesk = kassa;

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
		for (let x = -WIDTH / 2; x <= WIDTH / 2 + 0.01; x += 0.5) {
			const circle = this.colliders.add(x, railZ - 0.35, 0.36);
			if (x > PASSAGE_FROM_X) this.passageColliders.push(circle);
		}
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
		this.colliders.add((x1 + x2) / 2, NORTH_Z + 0.9, 0.3);
	}

	/** Задняя стена за раздачей: стеллаж с посудой, дверь с комнатой за ней, лозунг под потолком. */
	private _buildBackWall(): void {
		const face = NORTH_MOUNT;
		this._add(createDishRack(1.6), -3.6, 0, face + 0.25);

		// Дверь — обитая жестью, с табличкой; петли слева, в катсцене распахивается в зал.
		this.kitchenDoor = new THREE.Group();
		this.kitchenDoor.position.set(KITCHEN_DOOR_X - KITCHEN_DOOR_WIDTH / 2, 0, face + 0.03);
		this.scene.add(this.kitchenDoor);
		const leaf = new THREE.Mesh(
			new THREE.BoxGeometry(KITCHEN_DOOR_WIDTH, KITCHEN_DOOR_HEIGHT, 0.05),
			new THREE.MeshStandardMaterial({ color: '#b8b9b4', roughness: 0.5, metalness: 0.3 })
		);
		leaf.position.set(KITCHEN_DOOR_WIDTH / 2, KITCHEN_DOOR_HEIGHT / 2, 0);
		this.kitchenDoor.add(leaf);

		// За дверью — пустота: коробка, видимая изнутри, ровно залитая слепящим красным (ни углов, ни теней — не понять,
		// что там). Свет в зал — от проёма; добавлен сразу с нулевой яркостью: новая лампа посреди катсцены
		// пересобрала бы шейдеры.
		const { width, depth, height } = KITCHEN_ROOM;
		const room = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.voidMaterial);
		room.position.set(KITCHEN_DOOR_X, height / 2, NORTH_Z - WALL_THICKNESS / 2 - depth / 2);
		this.scene.add(room);
		this.kitchenLight = new THREE.PointLight(BLOOD, 0, 18, 1.4);
		this.kitchenLight.position.set(KITCHEN_DOOR_X, 1.3, NORTH_Z - WALL_THICKNESS / 2 - 0.3);
		this.scene.add(this.kitchenLight);

		// За прилавком (туда попадают только через проход на месте кассы): задняя сторона прилавка и столика с подносами,
		// стеллаж, титан (его коллайдер — в _buildDrinks).
		for (let x = -WIDTH / 2 + 0.3; x <= COUNTER_X2 - 0.1 + 0.01; x += 0.4) this.colliders.add(x, COUNTER_Z - 0.15, 0.2);
		this.colliders.add(COUNTER_X2 - 0.1, COUNTER_Z, 0.2);
		for (const x of [-4.2, -3.6, -3.0]) this.colliders.add(x, face + 0.25, 0.3);
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
		// Табличка — на лицевой стороне створки (толщина полотна 0.05), открывается вместе с ней.
		staff.position.set(KITCHEN_DOOR_WIDTH / 2, 1.6, 0.025);
		this.kitchenDoor.add(staff);

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

	/** Стол для грязной посуды напротив раздачи: подносы с пустыми тарелками и стаканами, табличка. */
	private _buildReturnTables(): void {
		const x = RETURN_X;
		this._add(createSteelTable(RETURN_LENGTH, 0.6), x, 0, RETURN_Z);
		for (let dx = -RETURN_LENGTH / 2 + 0.3; dx <= RETURN_LENGTH / 2 - 0.3 + 0.01; dx += 0.5) this.colliders.add(x + dx, RETURN_Z, 0.35);
		for (let i = 0; i < 3; i++) {
			const tray = createDirtyTray(i, i % 2 ? '#a89f8c' : '#6b4a33');
			this._add(tray, x - 0.8 + i * 0.55, 0.86, RETURN_Z + (i % 2) * 0.05, (i - 1) * 0.1);
			// Иногда подносы ставят один на другой.
			if (i === 0) this._add(createDirtyTray(5), x - 0.8, 0.86 + 0.06, RETURN_Z + 0.02, 0.15);
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
		// Табличка на стойке у края стола со стороны прохода, лицом к залу.
		const stand = new THREE.Group();
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#c3c7c9', metalness: 0.6, roughness: 0.35 }));
		post.position.y = 0.15;
		stand.add(post);
		sign.position.set(0, 0.36, 0.012);
		stand.add(sign);
		this._add(stand, x + 0.9, 0.86, RETURN_Z - 0.2);
		// Глубокие тарелки стопкой — уже собранные.
		this._add(createPlateStack(6, true), x + 0.65, 0.86, RETURN_Z + 0.1);
	}
}
