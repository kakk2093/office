import * as THREE from 'three';

/**
 * Обстановка советской столовой: столы с табуретками, линия раздачи с направляющими для подносов, посуда и еда,
 * касса, столы для грязной посуды, а также входная дверь (она же — снаружи на фасаде).
 * Соглашение: лицевая сторона предмета — +Z (к посетителю), начало координат — на полу/опоре (y = 0).
 */

const materials = new Map<string, THREE.MeshStandardMaterial>();
/** Материалы кэшируются по цвету — предметов много, а цветов мало. */
function mat(color: string, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
	const key = `${color}|${roughness}|${metalness}`;
	let material = materials.get(key);
	if (!material) materials.set(key, (material = new THREE.MeshStandardMaterial({ color, roughness, metalness })));
	return material;
}

const STEEL = mat('#c3c7c9', 0.35, 0.6);
const ALU = mat('#aeb3b5', 0.4, 0.5);
const PORCELAIN = mat('#f3f1ea', 0.3);
const DARK = mat('#2e3134', 0.7);
/** Гранёное стекло: полупрозрачное, чтобы был виден напиток. */
const GLASS = new THREE.MeshStandardMaterial({
	color: '#dfe8e6',
	roughness: 0.1,
	transparent: true,
	opacity: 0.35,
	depthWrite: false,
});

function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x = 0, y = h / 2, z = 0): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	parent.add(mesh);
	return mesh;
}

function cylinder(
	parent: THREE.Object3D,
	rTop: number,
	rBottom: number,
	h: number,
	material: THREE.Material,
	x = 0,
	y = h / 2,
	z = 0,
	segments = 12
): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	parent.add(mesh);
	return mesh;
}

/** Труба вдоль X длиной length с центром в (x, y, z). */
function tubeX(parent: THREE.Object3D, length: number, r: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
	const mesh = cylinder(parent, r, r, length, material, x, y, z, 6);
	mesh.rotation.z = Math.PI / 2;
	return mesh;
}

export function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function makeRand(seed: number): () => number {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ─── Дверь ────────────────────────────────────────────────────────────────────────────────────────────────

export const CANTEEN_DOOR_WIDTH = 2.4;
export const CANTEEN_DOOR_HEIGHT = 2.95;

export interface CanteenDoor {
	group: THREE.Group;
	/** Правая створка; начало координат — на петле, открывание — поворот вокруг Y. */
	leaf: THREE.Group;
}

/** Табличка «Режим работы» на стекле: красная шапка и строчки часов. */
function createHoursSignTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 24;
	canvas.height = 32;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#f2efe6';
	ctx.fillRect(0, 0, 24, 32);
	ctx.fillStyle = '#b8342a';
	ctx.fillRect(2, 2, 20, 5);
	ctx.fillStyle = '#55585a';
	for (let y = 10; y < 30; y += 4) ctx.fillRect(3, y, 6 + ((y * 7) % 11), 1);
	return pixelTexture(canvas);
}

/**
 * Двустворчатая дверь в алюминиевой раме: остеклённые створки с глухой филёнкой снизу, фрамуга сверху,
 * вертикальные ручки-скобы с обеих сторон. Левая створка неподвижна, правая открывается.
 * glass — материал стекла: снаружи тёмное с тёплым отсветом зала, изнутри — светлое (пасмурный день).
 * Начало координат — середина порога, лицом к +Z (наружу).
 */
export function createCanteenDoor(glass: THREE.Material, withSign = false): CanteenDoor {
	const group = new THREE.Group();
	const W = CANTEEN_DOOR_WIDTH;
	const H = CANTEEN_DOOR_HEIGHT;
	const doorH = 2.2;
	const f = 0.07;
	const depth = 0.09;

	// Короб рамы: стойки, верх, импост под фрамугой, порог.
	box(group, f, H, depth, ALU, -W / 2 + f / 2, H / 2);
	box(group, f, H, depth, ALU, W / 2 - f / 2, H / 2);
	box(group, W, f, depth, ALU, 0, H - f / 2);
	box(group, W, f, depth, ALU, 0, doorH + f / 2);
	box(group, W, 0.03, depth + 0.04, ALU, 0, 0.015);
	const transom = new THREE.Mesh(new THREE.PlaneGeometry(W - f * 2, H - doorH - f * 2), glass);
	transom.position.set(0, (doorH + f + H - f) / 2, 0);
	group.add(transom);

	const leafW = (W - f * 2) / 2;
	const buildLeaf = (sign: boolean): THREE.Group => {
		// Створка строится от петли влево (−X): так её удобно поворачивать.
		const leaf = new THREE.Group();
		const s = 0.06;
		const kick = 0.4;
		box(leaf, s, doorH - 0.03, 0.05, ALU, -s / 2, doorH / 2 + 0.015);
		box(leaf, s, doorH - 0.03, 0.05, ALU, -leafW + s / 2, doorH / 2 + 0.015);
		box(leaf, leafW, s, 0.05, ALU, -leafW / 2, doorH - s / 2);
		box(leaf, leafW, kick, 0.05, mat('#8d9295', 0.5, 0.4), -leafW / 2, 0.03 + kick / 2);
		box(leaf, leafW, 0.04, 0.05, ALU, -leafW / 2, 0.03 + kick + 0.02);
		const pane = new THREE.Mesh(new THREE.PlaneGeometry(leafW - s * 2, doorH - kick - s - 0.1), glass);
		pane.position.set(-leafW / 2, (0.03 + kick + 0.04 + doorH - s) / 2, 0);
		leaf.add(pane);
		// Ручки-скобы у притвора, по обе стороны полотна.
		for (const side of [-1, 1]) {
			const bar = cylinder(leaf, 0.015, 0.015, 0.7, STEEL, -leafW + 0.12, 1.05, side * 0.09, 6);
			bar.castShadow = false;
			for (const y of [0.74, 1.36]) box(leaf, 0.025, 0.025, 0.07, STEEL, -leafW + 0.12, y, side * 0.05);
		}
		if (sign) {
			const plate = new THREE.Mesh(
				new THREE.PlaneGeometry(0.3, 0.4),
				new THREE.MeshStandardMaterial({ map: createHoursSignTexture() })
			);
			plate.position.set(-leafW / 2, 1.55, 0.03);
			leaf.add(plate);
		}
		return leaf;
	};

	// Левая створка — отражение правой, неподвижна.
	const left = buildLeaf(withSign);
	left.scale.x = -1;
	left.position.x = -W / 2 + f;
	group.add(left);
	const leaf = buildLeaf(false);
	leaf.position.x = W / 2 - f;
	group.add(leaf);
	return { group, leaf };
}

/** Плавный поворот створки/калитки между закрытым и открытым положением. */
export class SwingLeaf {
	private from = 0;
	private to = 0;
	private t = 1;

	constructor(
		private readonly leaf: THREE.Object3D,
		private readonly openRot: number,
		private readonly duration = 0.5
	) {}

	open(): void {
		this.from = this.leaf.rotation.y;
		this.to = this.openRot;
		this.t = 0;
	}

	/** Мгновенно закрыть (при возвращении в сцену, пока экран залит вспышкой). */
	reset(): void {
		this.leaf.rotation.y = 0;
		this.from = this.to = 0;
		this.t = 1;
	}

	update(dt: number): void {
		if (this.t >= 1) return;
		this.t = Math.min(1, this.t + dt / this.duration);
		const eased = 1 - (1 - this.t) ** 3;
		this.leaf.rotation.y = THREE.MathUtils.lerp(this.from, this.to, eased);
	}
}

// ─── Зал ──────────────────────────────────────────────────────────────────────────────────────────────────

export const TABLE_SIZE = 0.8;
export const TABLE_HEIGHT = 0.75;

/** Квадратный стол: светлый пластик с алюминиевой кромкой на четырёх трубчатых ножках. */
export function createCanteenTable(): THREE.Group {
	const group = new THREE.Group();
	const s = TABLE_SIZE;
	box(group, s, 0.03, s, mat('#d9ceb2', 0.6), 0, TABLE_HEIGHT - 0.015);
	box(group, s + 0.02, 0.035, s + 0.02, ALU, 0, TABLE_HEIGHT - 0.02);
	const legMat = mat('#6f6a62', 0.5, 0.4);
	for (const x of [-1, 1]) {
		for (const z of [-1, 1]) cylinder(group, 0.018, 0.018, TABLE_HEIGHT - 0.05, legMat, x * (s / 2 - 0.07), (TABLE_HEIGHT - 0.05) / 2, z * (s / 2 - 0.07), 6);
	}
	// Царга под столешницей.
	box(group, s - 0.12, 0.06, s - 0.12, legMat, 0, TABLE_HEIGHT - 0.07);
	return group;
}

/** Табуретка: круглое сиденье на четырёх разведённых трубчатых ножках с кольцом-перемычкой. */
export function createStool(seat = '#7a4a2a'): THREE.Group {
	const group = new THREE.Group();
	const h = 0.46;
	cylinder(group, 0.17, 0.17, 0.035, mat(seat, 0.6), 0, h - 0.018, 0, 12);
	const legMat = mat('#55524c', 0.5, 0.4);
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		const leg = cylinder(group, 0.013, 0.013, h, legMat, Math.cos(a) * 0.14, h / 2, Math.sin(a) * 0.14, 5);
		// Ножки чуть расходятся книзу.
		leg.rotation.set(Math.sin(a) * -0.12, 0, Math.cos(a) * 0.12);
	}
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.01, 4, 12), legMat);
	ring.rotation.x = Math.PI / 2;
	ring.position.y = 0.18;
	group.add(ring);
	return group;
}

/** Салфетница: пластмассовое основание, две стенки и стопка треугольных салфеток. */
export function createNapkinHolder(): THREE.Group {
	const group = new THREE.Group();
	const plastic = mat('#d8a23a', 0.5);
	box(group, 0.14, 0.015, 0.06, plastic);
	for (const z of [-0.024, 0.024]) box(group, 0.12, 0.08, 0.006, plastic, 0, 0.055, z);
	box(group, 0.11, 0.1, 0.04, mat('#f4f2ec', 0.9), 0, 0.06);
	return group;
}

/** Солонка или перечница: гранёное стекло и металлическая крышка. */
export function createShaker(pepper = false): THREE.Group {
	const group = new THREE.Group();
	cylinder(group, 0.018, 0.02, 0.06, pepper ? mat('#5a5048', 0.4) : mat('#eeeeea', 0.4), 0, 0.03, 0, 6);
	cylinder(group, 0.017, 0.018, 0.015, STEEL, 0, 0.068, 0, 6);
	return group;
}

// ─── Посуда и еда ─────────────────────────────────────────────────────────────────────────────────────────

export type FoodKind =
	| 'mash'
	| 'buckwheat'
	| 'pasta'
	| 'cutlet'
	| 'fish'
	| 'vinegret'
	| 'olivier'
	| 'cabbage'
	| 'bread'
	| 'crumbs';

const FOOD_COLOR: Record<FoodKind, string> = {
	mash: '#eadba6',
	buckwheat: '#6b4a2e',
	pasta: '#e2c67e',
	cutlet: '#5a3a22',
	fish: '#c79e62',
	vinegret: '#9a2e3e',
	olivier: '#e6dcb2',
	cabbage: '#cfe0a8',
	bread: '#d9b27a',
	crumbs: '#8a6a4a',
};

/** Горка еды на тарелке — приплюснутая полусфера. */
function mound(parent: THREE.Object3D, kind: FoodKind, r: number, h: number, x = 0, y = 0, z = 0): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(FOOD_COLOR[kind], 0.9));
	mesh.scale.y = h / r;
	mesh.position.set(x, y, z);
	parent.add(mesh);
	return mesh;
}

/** Мелкая тарелка общепита (белая, с зелёной каймой); food — что на ней лежит. */
export function createPlate(food: FoodKind[] = [], radius = 0.11): THREE.Group {
	const group = new THREE.Group();
	cylinder(group, radius, radius * 0.65, 0.018, PORCELAIN, 0, 0.009, 0, 14);
	const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.84, radius * 0.9, 14), mat('#4f8a64', 0.5));
	rim.rotation.x = -Math.PI / 2;
	rim.position.y = 0.0185;
	group.add(rim);
	const y = 0.018;
	for (const kind of food) {
		switch (kind) {
			case 'cutlet': {
				const c = mound(group, kind, 0.035, 0.022, 0.03, y, 0.01);
				c.scale.x = 1.4;
				break;
			}
			case 'fish':
				box(group, 0.09, 0.015, 0.05, mat(FOOD_COLOR.fish, 0.9), 0.03, y + 0.008, 0);
				break;
			case 'bread':
				for (let i = 0; i < 3; i++) {
					const slice = box(group, 0.07, 0.012, 0.08, mat(i === 1 ? '#3a2a1e' : FOOD_COLOR.bread, 0.9), -0.02 + i * 0.02, y + 0.006 + i * 0.012, 0);
					slice.rotation.y = (i - 1) * 0.3;
				}
				break;
			case 'crumbs':
				for (let i = 0; i < 4; i++) box(group, 0.012, 0.004, 0.012, mat(FOOD_COLOR.crumbs, 0.9), Math.sin(i * 2.3) * 0.05, y + 0.002, Math.cos(i * 1.7) * 0.05);
				break;
			default: {
				// Гарнир — сбоку, если на тарелке ещё и котлета/рыба.
				const side = food.length > 1 ? -0.035 : 0;
				mound(group, kind, food.length > 1 ? 0.045 : 0.065, 0.03, side, y, 0);
			}
		}
	}
	return group;
}

export type SoupKind = 'solyanka' | 'borsch' | 'shchi' | 'empty';

/** Цвет супа в тарелке и котле. */
export const SOUP_COLOR: Record<Exclude<SoupKind, 'empty'>, string> = {
	solyanka: '#b4471f',
	borsch: '#a8322b',
	shchi: '#c9a85a',
};

/** Что плавает в солянке: кружок лимона, маслины, кусочки колбасы. Точки — [x, z] от центра. */
function solyankaGarnish(parent: THREE.Object3D, y: number, spread: number): void {
	const lemon = new THREE.Mesh(new THREE.CircleGeometry(0.022 * spread, 8), mat('#f2d64a', 0.5));
	lemon.rotation.x = -Math.PI / 2;
	lemon.position.set(0.012 * spread, y + 0.002, -0.01 * spread);
	parent.add(lemon);
	const olive = mat('#2a2622', 0.4);
	for (const [x, z] of [
		[-0.035, 0.02],
		[0.03, 0.035],
		[-0.01, -0.045],
	]) {
		const ball = new THREE.Mesh(new THREE.SphereGeometry(0.008 * spread, 5, 3), olive);
		ball.position.set(x * spread, y + 0.002, z * spread);
		parent.add(ball);
	}
	const sausage = mat('#8a3a32', 0.6);
	for (const [x, z] of [
		[0.04, -0.02],
		[-0.04, -0.02],
		[0.0, 0.045],
	]) {
		const bit = new THREE.Mesh(new THREE.BoxGeometry(0.014 * spread, 0.006, 0.01 * spread), sausage);
		bit.position.set(x * spread, y + 0.002, z * spread);
		bit.rotation.y = x * 30;
		parent.add(bit);
	}
}

/** Глубокая тарелка с супом: у солянки — лимон и маслины, у борща — ложка сметаны.
 * Всё, что в тарелке, — в дочерней группе 'soup' (её можно прятать/масштабировать — тарелка наполняется). */
export function createBowl(soup: SoupKind = 'solyanka'): THREE.Group {
	const group = new THREE.Group();
	cylinder(group, 0.085, 0.05, 0.05, PORCELAIN, 0, 0.025, 0, 14);
	const rim = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.084, 14), mat('#4f8a64', 0.5));
	rim.rotation.x = -Math.PI / 2;
	rim.position.y = 0.052;
	group.add(rim);
	if (soup !== 'empty') {
		const contents = new THREE.Group();
		contents.name = 'soup';
		group.add(contents);
		const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.074, 14), mat(SOUP_COLOR[soup], 0.3));
		liquid.rotation.x = -Math.PI / 2;
		// Над крышкой цилиндра-тарелки (он сплошной), чуть ниже каймы.
		liquid.position.y = 0.051;
		contents.add(liquid);
		if (soup === 'solyanka') solyankaGarnish(contents, 0.051, 1);
		if (soup === 'borsch') mound(contents, 'mash', 0.018, 0.008, 0.01, 0.051, -0.01).material = mat('#f6f4ee', 0.6);
	}
	return group;
}

export type DrinkKind = 'kompot' | 'tea' | 'kisel' | 'sourCream' | 'empty';

const DRINK_COLOR: Record<Exclude<DrinkKind, 'empty'>, string> = {
	kompot: '#9a3a3a',
	tea: '#7a3e14',
	kisel: '#b8456a',
	sourCream: '#f4f1e8',
};

/** Гранёный стакан; компот — с ягодами на дне. */
export function createGlass(drink: DrinkKind = 'kompot'): THREE.Group {
	const group = new THREE.Group();
	const h = drink === 'sourCream' ? 0.06 : 0.1;
	if (drink !== 'empty') {
		const liquid = cylinder(group, 0.03, 0.027, h * 0.8, mat(DRINK_COLOR[drink], 0.4), 0, h * 0.4 + 0.004, 0, 12);
		liquid.castShadow = false;
		if (drink === 'kompot') box(group, 0.03, 0.012, 0.03, mat('#5a2230', 0.8), 0, 0.012);
	}
	const glass = cylinder(group, 0.034, 0.03, h, GLASS, 0, h / 2, 0, 12);
	glass.castShadow = false;
	return group;
}

/** Стопка тарелок (deep — глубоких). */
export function createPlateStack(count: number, deep = false): THREE.Group {
	const group = new THREE.Group();
	const step = deep ? 0.022 : 0.012;
	for (let i = 0; i < count; i++) {
		if (deep) cylinder(group, 0.085, 0.05, 0.05, PORCELAIN, 0, 0.025 + i * step, 0, 14);
		else cylinder(group, 0.11, 0.07, 0.018, PORCELAIN, 0, 0.009 + i * step, 0, 14);
	}
	return group;
}

export const TRAY_SIZE = { width: 0.46, depth: 0.33 } as const;

/** Поднос: пластмасса с бортиком. */
export function createTray(color = '#6b4a33'): THREE.Group {
	const group = new THREE.Group();
	const { width: w, depth: d } = TRAY_SIZE;
	const m = mat(color, 0.6);
	box(group, w, 0.008, d, m);
	box(group, w, 0.02, 0.012, m, 0, 0.01, d / 2 - 0.006);
	box(group, w, 0.02, 0.012, m, 0, 0.01, -d / 2 + 0.006);
	box(group, 0.012, 0.02, d, m, w / 2 - 0.006, 0.01);
	box(group, 0.012, 0.02, d, m, -w / 2 + 0.006, 0.01);
	return group;
}

/** Стопка подносов. */
export function createTrayStack(count: number, color = '#6b4a33'): THREE.Group {
	const group = new THREE.Group();
	for (let i = 0; i < count; i++) {
		const tray = createTray(color);
		tray.position.y = i * 0.014;
		tray.rotation.y = Math.sin(i * 12.9) * 0.03;
		group.add(tray);
	}
	return group;
}

export type BreadKind = 'white' | 'black';

/** Кусок хлеба: мякиш с тонкой корочкой по краю. Лежит плашмя, начало координат — снизу по центру. */
export function createBreadSlice(kind: BreadKind): THREE.Group {
	const group = new THREE.Group();
	const crust = kind === 'white' ? '#b98a4a' : '#2a1c14';
	const crumb = kind === 'white' ? '#ead8a8' : '#4a3222';
	box(group, 0.1, 0.012, 0.075, mat(crust, 0.9));
	box(group, 0.088, 0.013, 0.063, mat(crumb, 0.95));
	return group;
}

/**
 * Лоток с нарезанным хлебом: алюминиевый противень, два ряда кусков внахлёст — белый и чёрный.
 * slices — куски в порядке, в каком их забирают.
 */
export function createBreadTray(perRow = 6): { group: THREE.Group; slices: { mesh: THREE.Group; kind: BreadKind }[] } {
	const group = new THREE.Group();
	const w = 0.4;
	const d = 0.3;
	box(group, w, 0.006, d, ALU);
	box(group, w, 0.025, 0.008, ALU, 0, 0.0125, d / 2);
	box(group, w, 0.025, 0.008, ALU, 0, 0.0125, -d / 2);
	box(group, 0.008, 0.025, d, ALU, w / 2, 0.0125);
	box(group, 0.008, 0.025, d, ALU, -w / 2, 0.0125);
	const slices: { mesh: THREE.Group; kind: BreadKind }[] = [];
	// Ряд у посетителя — белый, дальний — чёрный; куски лежат внахлёст, как их раскладывают на раздаче.
	for (const [kind, z] of [
		['white', 0.07],
		['black', -0.07],
	] as const) {
		for (let i = 0; i < perRow; i++) {
			const slice = createBreadSlice(kind);
			// Поперёк ряда, каждый следующий чуть выше и заходит на предыдущий — видны корочки.
			slice.position.set(-w / 2 + 0.06 + i * 0.056, 0.006 + i * 0.005, z);
			slice.rotation.set(0, Math.PI / 2 + Math.sin(i * 3.7) * 0.1, 0.12);
			group.add(slice);
			slices.push({ mesh: slice, kind });
		}
	}
	// Берут сверху ряда: последний положенный — первый.
	const order: { mesh: THREE.Group; kind: BreadKind }[] = [];
	for (const row of [0, 1]) for (let i = perRow - 1; i >= 0; i--) order.push(slices[row * perRow + i]);
	return { group, slices: order };
}

/** Столовая ложка: плоский черенок и овальный черпачок. Вдоль Z, черпачок — у −Z. */
export function createSpoon(): THREE.Group {
	const group = new THREE.Group();
	box(group, 0.012, 0.004, 0.12, ALU, 0, 0.004, 0.035);
	const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ALU);
	bowl.scale.set(0.9, 0.35, 1.4);
	bowl.position.set(0, 0.009, -0.05);
	group.add(bowl);
	return group;
}

/** Ложка или вилка — тонкая пластинка, для пиксельного вида форма не важна. */
export function createCutlery(): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.17), ALU);
	mesh.position.y = 0.002;
	return mesh;
}

/** Поднос с остатками обеда — для столов под грязную посуду и для зала. */
export function createDirtyTray(seed: number, color = '#6b4a33'): THREE.Group {
	const rand = makeRand(seed * 7919 + 13);
	const tray = createTray(color);
	const plate = createPlate(rand() < 0.5 ? ['crumbs'] : ['crumbs', 'buckwheat']);
	plate.scale.setScalar(0.9);
	plate.position.set(-0.1, 0.008, 0.02);
	tray.add(plate);
	const bowl = createBowl('empty');
	bowl.position.set(0.12, 0.008, -0.06);
	tray.add(bowl);
	const glass = createGlass(rand() < 0.5 ? 'empty' : 'tea');
	glass.position.set(0.15, 0.008, 0.09);
	tray.add(glass);
	const spoon = createCutlery();
	spoon.position.set(0.02, 0.012, 0.1);
	spoon.rotation.y = 1.2 + rand();
	tray.add(spoon);
	return tray;
}

// ─── Раздача ──────────────────────────────────────────────────────────────────────────────────────────────

export const COUNTER_HEIGHT = 0.88;
export const COUNTER_DEPTH = 0.7;
/** Направляющие для подносов вынесены от прилавка к посетителю. */
export const TRAY_RAIL_OFFSET = 0.33;

/**
 * Прилавок линии раздачи длиной length: корпус с облицовкой под дерево, стальная столешница,
 * вдоль лицевой стороны — направляющие из трёх труб на кронштейнах, по ним двигают поднос.
 */
export function createServingCounter(length: number): THREE.Group {
	const group = new THREE.Group();
	const d = COUNTER_DEPTH;
	const h = COUNTER_HEIGHT;
	box(group, length, h - 0.04, d, mat('#e8e4da', 0.6), 0, (h - 0.04) / 2);
	box(group, length + 0.04, 0.04, d + 0.04, STEEL, 0, h - 0.02);
	// Облицовка лицевой стороны: филёнки под шпон с тёмной щелью цоколя.
	const panels = Math.round(length / 0.9);
	const panelW = length / panels;
	for (let i = 0; i < panels; i++) {
		box(group, panelW - 0.04, h - 0.22, 0.02, mat('#8a5a3a', 0.7), -length / 2 + panelW * (i + 0.5), 0.12 + (h - 0.22) / 2 + 0.02, d / 2 + 0.01);
	}
	box(group, length, 0.1, 0.02, DARK, 0, 0.05, d / 2 - 0.03);

	// Направляющие: три трубы в одной плоскости, кронштейн-«язык» от прилавка через каждые ~1.2 м.
	const railY = h - 0.07;
	for (const dz of [0.14, 0.24, TRAY_RAIL_OFFSET]) tubeX(group, length, 0.016, STEEL, 0, railY, d / 2 + dz);
	const brackets = Math.max(2, Math.round(length / 1.2) + 1);
	for (let i = 0; i < brackets; i++) {
		const x = -length / 2 + 0.05 + ((length - 0.1) * i) / (brackets - 1);
		box(group, 0.03, 0.04, TRAY_RAIL_OFFSET + 0.03, STEEL, x, railY - 0.03, d / 2 + TRAY_RAIL_OFFSET / 2);
		box(group, 0.03, 0.12, 0.03, STEEL, x, railY - 0.09, d / 2 + 0.02);
	}
	return group;
}

/** Холодильная витрина-горка на прилавок: хромированные стойки, две стеклянные полки, наклонное стекло к посетителю. */
export function createDisplayCase(length: number): { group: THREE.Group; shelves: number[] } {
	const group = new THREE.Group();
	const d = 0.46;
	const shelves = [0.3, 0.58];
	const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe3e2', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
	for (const x of [-length / 2 + 0.02, length / 2 - 0.02]) {
		for (const z of [-d / 2, d / 2]) cylinder(group, 0.012, 0.012, 0.62, STEEL, x, 0.31, z, 6);
	}
	for (const y of shelves) {
		const shelf = box(group, length - 0.04, 0.012, d, glassMat, 0, y);
		shelf.castShadow = false;
		tubeX(group, length, 0.01, STEEL, 0, y, d / 2);
	}
	// Наклонное стекло от края прилавка до верхней полки.
	const front = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.04, 0.5), glassMat);
	front.position.set(0, 0.3, d / 2 + 0.12);
	front.rotation.x = -0.45;
	group.add(front);
	return { group, shelves };
}

/**
 * Мармит для вторых блюд: стальная ванна на прилавке с утопленными гастроёмкостями
 * (гарниры, котлеты, рыба); сверху — стеклянный экран на стойках.
 */
export function createMarmite(length: number, pans: FoodKind[]): THREE.Group {
	const group = new THREE.Group();
	const d = 0.56;
	const h = 0.14;
	box(group, length, h, d, STEEL);
	const panW = (length - 0.08) / pans.length;
	pans.forEach((kind, i) => {
		const x = -length / 2 + 0.04 + panW * (i + 0.5);
		box(group, panW - 0.03, 0.006, d - 0.12, DARK, x, h + 0.003).castShadow = false;
		const food = box(group, panW - 0.07, 0.01, d - 0.16, mat(FOOD_COLOR[kind], 0.9), x, h + 0.005);
		food.castShadow = false;
		if (kind === 'cutlet' || kind === 'fish') {
			// Штучные — рядами на гарнирном «подложке»: котлеты горками, рыба кусками.
			food.material = mat('#3a2a1e', 0.9);
			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 2; c++) {
					const px = x + (c - 0.5) * (panW * 0.4);
					const pz = (r - 1) * 0.12;
					if (kind === 'cutlet') mound(group, 'cutlet', 0.035, 0.022, px, h + 0.008, pz).scale.x = 1.4;
					else box(group, panW * 0.35, 0.018, 0.08, mat(FOOD_COLOR.fish, 0.9), px, h + 0.015, pz);
				}
			}
		} else {
			mound(group, kind, Math.min(panW, d) * 0.3, 0.05, x, h + 0.008, 0);
		}
		// Раздаточная ложка/лопатка на краю ёмкости.
		const spoon = box(group, 0.02, 0.012, 0.28, ALU, x + panW * 0.25, h + 0.04, -d / 2 + 0.12);
		spoon.rotation.x = 0.35;
	});
	// Защитный экран над мармитом.
	for (const x of [-length / 2 + 0.03, length / 2 - 0.03]) cylinder(group, 0.012, 0.012, 0.45, STEEL, x, 0.225, d / 2 - 0.02, 6);
	const guard = new THREE.Mesh(
		new THREE.BoxGeometry(length, 0.01, 0.34),
		new THREE.MeshStandardMaterial({ color: '#cfe3e2', roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false })
	);
	guard.position.set(0, 0.45, d / 2 - 0.12);
	group.add(guard);
	tubeX(group, length, 0.01, STEEL, 0, 0.45, d / 2 + 0.05);
	return group;
}

/** Алюминиевая кастрюля-котёл с супом; withLadle — половник оставлен в кастрюле. */
export function createSoupPot(soup: SoupKind, withLadle = true): THREE.Group {
	const group = new THREE.Group();
	const r = 0.2;
	const h = 0.34;
	// Стенки без крышки (изнутри тоже видны) и дно — иначе суп внутри скрыт.
	const potMat = ALU.clone();
	potMat.side = THREE.DoubleSide;
	const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, h, 16, 1, true), potMat);
	pot.position.y = h / 2;
	pot.castShadow = pot.receiveShadow = true;
	group.add(pot);
	cylinder(group, r * 0.95, r * 0.95, 0.01, ALU, 0, 0.005, 0, 16);
	for (const side of [-1, 1]) box(group, 0.06, 0.025, 0.04, ALU, side * (r + 0.02), h - 0.05);
	const liquid = new THREE.Mesh(new THREE.CircleGeometry(r - 0.012, 16), mat(soup === 'empty' ? '#8a8e90' : SOUP_COLOR[soup], 0.3));
	liquid.rotation.x = -Math.PI / 2;
	liquid.position.y = h - 0.04;
	group.add(liquid);
	if (soup === 'solyanka') solyankaGarnish(group, h - 0.04, 2.2);
	if (!withLadle) return group;
	// Половник: черпак в супе, ручка через край.
	const handle = cylinder(group, 0.008, 0.008, 0.42, STEEL, 0.06, h + 0.08, 0.05, 5);
	handle.rotation.z = -0.5;
	cylinder(group, 0.045, 0.035, 0.04, STEEL, -0.04, h - 0.06, 0.05, 8);
	return group;
}

/** Кипятильник-титан для чая: цилиндр с краником и манометром. */
export function createWaterBoiler(): THREE.Group {
	const group = new THREE.Group();
	const body = cylinder(group, 0.24, 0.24, 1.0, mat('#d6d4cc', 0.4, 0.3), 0, 0.3 + 0.5, 0, 14);
	body.receiveShadow = true;
	for (const a of [0, 2.1, 4.2]) cylinder(group, 0.02, 0.02, 0.3, DARK, Math.cos(a) * 0.18, 0.15, Math.sin(a) * 0.18, 5);
	cylinder(group, 0.1, 0.24, 0.12, mat('#d6d4cc', 0.4, 0.3), 0, 1.36, 0, 14);
	box(group, 0.04, 0.04, 0.12, STEEL, 0, 0.5, 0.28);
	box(group, 0.03, 0.08, 0.03, STEEL, 0, 0.44, 0.33);
	const gauge = cylinder(group, 0.05, 0.05, 0.02, PORCELAIN, 0, 1.05, 0.25, 10);
	gauge.rotation.x = Math.PI / 2;
	return group;
}

/** Кассовый аппарат «как ОКА»: бежевый корпус, наклонная клавиатура, окошко с цифрами, ручка сбоку. */
export function createCashRegister(): THREE.Group {
	const group = new THREE.Group();
	const body = mat('#bfb59c', 0.5);
	box(group, 0.42, 0.1, 0.46, body);
	box(group, 0.42, 0.14, 0.2, body, 0, 0.17, -0.12);
	// Клавиатура: наклонная панель с рядами клавиш.
	const keys = new THREE.Group();
	keys.position.set(0, 0.14, 0.08);
	keys.rotation.x = 0.45;
	group.add(keys);
	box(keys, 0.4, 0.02, 0.26, mat('#8f8672', 0.5));
	const keyMat = [mat('#ecebe4', 0.5), mat('#2e2f31', 0.5), mat('#b8342a', 0.5)];
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 7; c++) box(keys, 0.035, 0.018, 0.035, keyMat[c === 6 ? 2 : (r + c) % 5 === 0 ? 1 : 0], -0.15 + c * 0.05, 0.018, -0.09 + r * 0.06);
	}
	// Окошко индикатора с цифрами.
	box(group, 0.3, 0.08, 0.04, DARK, 0, 0.29, -0.12);
	const digits = new THREE.Mesh(
		new THREE.PlaneGeometry(0.26, 0.05),
		new THREE.MeshStandardMaterial({ color: '#f2efe4', emissive: '#6b6456', emissiveIntensity: 0.4 })
	);
	digits.position.set(0, 0.29, -0.099);
	group.add(digits);
	// Денежный ящик внизу и рукоятка сбоку.
	box(group, 0.38, 0.06, 0.02, mat('#a39a82', 0.5), 0, 0.05, 0.23);
	const crank = cylinder(group, 0.012, 0.012, 0.18, STEEL, 0.25, 0.14, 0, 5);
	crank.rotation.z = Math.PI / 2;
	cylinder(group, 0.02, 0.02, 0.06, DARK, 0.34, 0.18, 0, 6);
	return group;
}

/** Кассовая стойка в конце линии: тумба с облицовкой, на ней касса клавишами к кассиру (−Z),
 * у покупателя (+Z) — блюдце для мелочи. */
export function createCashDesk(): THREE.Group {
	const group = new THREE.Group();
	const w = 0.9;
	const d = 0.65;
	// Ниже прилавка — кассир сидит, и её видно из-за аппарата.
	const h = 0.76;
	box(group, w, h - 0.03, d, mat('#e8e4da', 0.6));
	box(group, w + 0.04, 0.03, d + 0.04, mat('#8a5a3a', 0.6), 0, h - 0.015);
	box(group, w - 0.1, h - 0.25, 0.02, mat('#8a5a3a', 0.7), 0, 0.14 + (h - 0.25) / 2, d / 2 + 0.01);
	const register = createCashRegister();
	register.position.set(-0.05, h, -0.1);
	register.rotation.y = Math.PI;
	group.add(register);
	const saucer = cylinder(group, 0.06, 0.04, 0.012, PORCELAIN, 0.3, h + 0.006, 0.18, 10);
	saucer.castShadow = false;
	for (let i = 0; i < 3; i++) cylinder(group, 0.012, 0.012, 0.003, mat('#c9a23a', 0.3, 0.6), 0.29 + i * 0.012, h + 0.014 + i * 0.003, 0.18, 8);
	return group;
}

/** Стальной стол с нижней полкой — для подносов с грязной посудой и под подносы на раздаче. */
export function createSteelTable(length: number, depth = 0.6, height = 0.86): THREE.Group {
	const group = new THREE.Group();
	box(group, length, 0.03, depth, STEEL, 0, height - 0.015);
	box(group, length - 0.08, 0.02, depth - 0.08, STEEL, 0, 0.18);
	for (const x of [-1, 1]) {
		for (const z of [-1, 1]) cylinder(group, 0.02, 0.02, height - 0.03, STEEL, x * (length / 2 - 0.05), (height - 0.03) / 2, z * (depth / 2 - 0.05), 6);
	}
	return group;
}

/** Ящик для приборов: алюминиевый лоток с перегородками, в ячейках — ложки и вилки. */
export function createCutleryBox(): THREE.Group {
	const group = new THREE.Group();
	box(group, 0.36, 0.01, 0.24, ALU);
	for (const x of [-0.18, -0.06, 0.06, 0.18]) box(group, 0.008, 0.05, 0.24, ALU, x, 0.025);
	for (const z of [-0.12, 0.12]) box(group, 0.36, 0.05, 0.008, ALU, 0, 0.025, z);
	for (let c = 0; c < 3; c++) {
		for (let i = 0; i < 5; i++) {
			const piece = createCutlery();
			piece.name = 'cutlery';
			piece.position.set(-0.12 + c * 0.12 + (i - 2) * 0.012, 0.012 + i * 0.004, 0);
			piece.rotation.y = (i - 2) * 0.05;
			group.add(piece);
		}
	}
	return group;
}

/** Стеллаж для чистой посуды у задней стены: стальные полки со стопками тарелок. */
export function createDishRack(length = 1.4): THREE.Group {
	const group = new THREE.Group();
	const d = 0.4;
	for (const x of [-length / 2 + 0.02, length / 2 - 0.02]) {
		for (const z of [-d / 2 + 0.02, d / 2 - 0.02]) cylinder(group, 0.015, 0.015, 1.8, STEEL, x, 0.9, z, 6);
	}
	[0.3, 0.8, 1.3, 1.78].forEach((y, level) => {
		box(group, length, 0.02, d, STEEL, 0, y);
		if (level === 3) return;
		for (let i = 0; i < 4; i++) {
			const stack = createPlateStack(6 + ((i + level) % 3) * 3, (i + level) % 2 === 0);
			stack.position.set(-length / 2 + 0.2 + i * ((length - 0.4) / 3), y + 0.01, 0);
			group.add(stack);
		}
	});
	return group;
}

// ─── Стены и мелочи ───────────────────────────────────────────────────────────────────────────────────────

/** Лампа дневного света (ЛДС): открытый белый короб с двумя трубками. Вешается на потолок (y = 0 — потолок).
 * tube — материал трубок (общий на все лампы зала, чтобы разом менять их свечение). */
export function createFluorescentLamp(tube: THREE.Material, length = 1.3): THREE.Group {
	const group = new THREE.Group();
	box(group, length, 0.06, 0.2, mat('#e8e8e2', 0.5), 0, -0.03).castShadow = false;
	for (const z of [-0.05, 0.05]) {
		const t = tubeX(group, length - 0.1, 0.017, tube, 0, -0.08, z);
		t.castShadow = false;
	}
	return group;
}

/** Раковина для мытья рук: фаянс, кран, зеркало и кусок мыла. Вешается на стену (лицом к +Z, начало — на полу у стены). */
export function createWashbasin(): THREE.Group {
	const group = new THREE.Group();
	box(group, 0.5, 0.18, 0.4, PORCELAIN, 0, 0.8, 0.2);
	box(group, 0.42, 0.02, 0.32, mat('#c9ccc8', 0.3), 0, 0.9, 0.22);
	cylinder(group, 0.04, 0.05, 0.62, PORCELAIN, 0, 0.31, 0.16, 8);
	box(group, 0.04, 0.12, 0.04, STEEL, 0, 0.97, 0.05);
	box(group, 0.03, 0.03, 0.14, STEEL, 0, 1.02, 0.1);
	box(group, 0.06, 0.02, 0.04, mat('#e0d06a', 0.6), 0.16, 0.9, 0.08);
	const mirror = box(group, 0.4, 0.5, 0.02, mat('#b9c6cc', 0.05, 0.8), 0, 1.4, 0.01);
	mirror.castShadow = false;
	return group;
}

/** Вешалка на стене: деревянная планка с крючками, на паре крючков — пальто. Лицом к +Z. */
export function createCoatRack(): THREE.Group {
	const group = new THREE.Group();
	box(group, 1.3, 0.1, 0.03, mat('#6b4a2e', 0.7), 0, 1.75, 0.015);
	for (let i = 0; i < 6; i++) box(group, 0.02, 0.02, 0.1, STEEL, -0.55 + i * 0.22, 1.72, 0.06);
	for (const [x, color, len] of [
		[-0.33, '#3a3d44', 1.0],
		[0.33, '#5a4a3a', 0.85],
	] as const) {
		const coat = box(group, 0.42, len, 0.14, mat(color, 0.9), x, 1.72 - len / 2, 0.1);
		coat.rotation.z = x * 0.08;
	}
	return group;
}

/** Фикус в деревянной кадке. */
export function createFicus(): THREE.Group {
	const group = new THREE.Group();
	box(group, 0.45, 0.45, 0.45, mat('#7a5a3a', 0.8));
	box(group, 0.47, 0.04, 0.47, mat('#5a3e28', 0.8), 0, 0.3);
	cylinder(group, 0.03, 0.04, 0.9, mat('#6a5040', 0.8), 0, 0.9, 0, 5);
	const leaves = mat('#2f5a2e', 0.8);
	for (let i = 0; i < 9; i++) {
		const a = i * 2.4;
		const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.04, 0), leaves);
		leaf.position.set(Math.cos(a) * 0.22, 1.0 + (i % 4) * 0.22, Math.sin(a) * 0.22);
		leaf.castShadow = true;
		group.add(leaf);
	}
	return group;
}

/** Круглые настенные часы. Лицом к +Z, начало — центр циферблата. */
export function createWallClock(): THREE.Group {
	const group = new THREE.Group();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 24;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#f3f1e8';
	ctx.fillRect(0, 0, 24, 24);
	ctx.fillStyle = '#2a2a2a';
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		ctx.fillRect(Math.round(12 + Math.cos(a) * 10) - (i % 3 === 0 ? 1 : 0), Math.round(12 + Math.sin(a) * 10), i % 3 === 0 ? 2 : 1, 1);
	}
	// Без двадцати два — стрелки.
	ctx.fillRect(12, 6, 1, 6);
	ctx.fillRect(7, 11, 5, 1);
	const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshStandardMaterial({ map: pixelTexture(canvas) }));
	face.position.z = 0.03;
	group.add(face);
	const rim = cylinder(group, 0.22, 0.22, 0.05, mat('#3a3d40', 0.5), 0, 0, 0.005, 16);
	rim.rotation.x = Math.PI / 2;
	return group;
}

/** Плакат/табличка: плоскость с текстурой, лицом к +Z; ширина по пропорциям текстуры.
 * Лист отстоит от начала координат на пару сантиметров — ставится прямо на поверхность стены и не тонет в ней. */
export function createPoster(texture: THREE.CanvasTexture, height: number): THREE.Group {
	const group = new THREE.Group();
	const image = texture.image as HTMLCanvasElement;
	const mesh = new THREE.Mesh(
		new THREE.PlaneGeometry((height * image.width) / image.height, height),
		new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })
	);
	mesh.position.z = 0.02;
	group.add(mesh);
	return group;
}

/** Текстура с текстом — строки крупным шрифтом по центру. */
export function createTextTexture(
	lines: string[],
	options: { width: number; height: number; background: string; color: string; font: string; lineHeight: number; top?: number }
): THREE.CanvasTexture {
	const { width, height, background, color, font, lineHeight, top = lineHeight / 2 + 2 } = options;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = color;
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	lines.forEach((line, i) => ctx.fillText(line, width / 2, top + i * lineHeight));
	return pixelTexture(canvas);
}

/** Меню на стенде: шапка «МЕНЮ», дальше блюда с ценами в рублях — строками. */
export function createMenuTexture(): THREE.CanvasTexture {
	const w = 112;
	const h = 136;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#f0ebdc';
	ctx.fillRect(0, 0, w, h);
	ctx.strokeStyle = '#8a5a3a';
	ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
	ctx.fillStyle = '#b8342a';
	ctx.font = 'bold 15px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('МЕНЮ', w / 2, 12);
	ctx.font = '9px sans-serif';
	ctx.fillStyle = '#2a2a2a';
	// Цены — в рублях.
	const items: [string, number][] = [
		['Винегрет', 60],
		['Салат', 70],
		['Борщ', 110],
		['Щи', 90],
		['Солянка', 120],
		['Котлета', 90],
		['Рыба жар.', 100],
		['Пюре', 40],
		['Гречка', 35],
		['Макароны', 35],
		['Компот', 30],
		['Чай', 20],
		['Хлеб', 3],
	];
	items.forEach(([name, price], i) => {
		const y = 27 + i * 8.5;
		ctx.textAlign = 'left';
		ctx.fillText(name, 6, y);
		ctx.textAlign = 'right';
		ctx.fillText(`${price} р.`, w - 6, y);
	});
	return pixelTexture(canvas);
}

/** Метлахская плитка пола: шахматка бежевого и терракотового с затёртостями. Тайл текстуры — 2×2 плитки. */
export function createFloorTileTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
	const tile = 8;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = tile * 2;
	const ctx = canvas.getContext('2d')!;
	const rand = makeRand(5);
	for (let ty = 0; ty < 2; ty++) {
		for (let tx = 0; tx < 2; tx++) {
			const light = (tx + ty) % 2 === 0;
			for (let y = 0; y < tile; y++) {
				for (let x = 0; x < tile; x++) {
					const v = rand();
					ctx.fillStyle = light ? (v < 0.2 ? '#bfae90' : '#cbbb9c') : v < 0.2 ? '#8e5238' : '#9a5a3e';
					ctx.fillRect(tx * tile + x, ty * tile + y, 1, 1);
				}
			}
		}
	}
	ctx.fillStyle = '#6e645a';
	for (let i = 0; i < 2; i++) {
		ctx.fillRect(i * tile, 0, 1, tile * 2);
		ctx.fillRect(0, i * tile, tile * 2, 1);
	}
	const texture = pixelTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	return texture;
}

/** Кафель стен: светлая глазурованная плитка с серыми швами. Тайл текстуры — 2×2 плитки. */
export function createWallTileTexture(): THREE.CanvasTexture {
	const tile = 6;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = tile * 2;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#dfe8e3';
	ctx.fillRect(0, 0, tile * 2, tile * 2);
	ctx.fillStyle = '#e9f0ec';
	ctx.fillRect(1, 1, 2, 1);
	ctx.fillRect(tile + 1, tile + 1, 2, 1);
	ctx.fillStyle = '#b3bfb9';
	for (let i = 0; i < 2; i++) {
		ctx.fillRect(i * tile, 0, 1, tile * 2);
		ctx.fillRect(0, i * tile, tile * 2, 1);
	}
	const texture = pixelTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	return texture;
}

/** Плотная штора: бордовая ткань с вертикальными складками (светлые гребни, тёмные впадины) и подрубом внизу. */
function createCurtainTexture(): THREE.CanvasTexture {
	const w = 32;
	const h = 8;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	// Профиль складки по X: впадина → гребень → впадина, 8 px на складку.
	const shades = ['#4a1a1c', '#5a2022', '#6a2628', '#7a2e2e', '#843434', '#7a2e2e', '#6a2628', '#5a2022'];
	for (let x = 0; x < w; x++) {
		ctx.fillStyle = shades[x % shades.length];
		ctx.fillRect(x, 0, 1, h);
	}
	const texture = pixelTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	return texture;
}

/**
 * Окно зала, наглухо задёрнутое плотными шторами (улицы не видно): карниз, две сомкнутые шторы
 * до подоконника, под ними подоконник и чугунная батарея. Лицом к +Z, начало координат — центр проёма
 * на внутренней грани стены. Сквозь ткань чуть пробивается дневной свет.
 */
export function createCanteenWindow(width: number, height: number): THREE.Group {
	const group = new THREE.Group();
	box(group, width + 0.3, 0.04, 0.26, mat('#e6e3da', 0.5), 0, -height / 2 - 0.04, 0.13);

	// Батарея под окном.
	const radiator = mat('#dcd8cc', 0.6);
	for (let i = 0; i < 10; i++) box(group, 0.07, 0.5, 0.1, radiator, -0.35 + i * 0.078, -height / 2 - 0.45, 0.12);

	// Карниз с кольцами и две шторы внахлёст по центру — от карниза до подоконника, шире проёма.
	const top = height / 2 + 0.2;
	const bottom = -height / 2 + 0.02;
	const curtainH = top - bottom;
	const panelW = (width + 0.5) / 2 + 0.06;
	const texture = createCurtainTexture();
	// Складка ~12 см: 4 складки на тайл текстуры.
	texture.repeat.set(panelW / 0.48, 1);
	const fabric = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, emissive: '#3a1a14', emissiveIntensity: 0.25 });
	for (const side of [-1, 1]) {
		const panel = box(group, panelW, curtainH, 0.03, fabric, side * (panelW / 2 - 0.03), (top + bottom) / 2, 0.2 + (side > 0 ? 0.02 : 0));
		panel.receiveShadow = true;
		// Подрубка внизу — полоса темнее.
		box(group, panelW, 0.05, 0.035, mat('#3e1618', 0.95), side * (panelW / 2 - 0.03), bottom + 0.025, 0.2 + (side > 0 ? 0.02 : 0));
	}
	const rodY = top + 0.04;
	box(group, width + 0.7, 0.03, 0.03, STEEL, 0, rodY, 0.2).castShadow = false;
	for (const x of [-(width + 0.7) / 2, (width + 0.7) / 2]) box(group, 0.03, 0.03, 0.2, STEEL, x, rodY, 0.1);
	return group;
}
