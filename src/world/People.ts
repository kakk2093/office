import * as THREE from 'three';
import { SOUP_COLOR } from './CanteenProps.js';
import type { CircleColliders } from '../physics/CircleColliders.js';

/**
 * Работники столовой: низкополи-фигуры из коробок, как и вся сцена. Смотрят на +Z, начало координат — на полу
 * между ступнями (у сидящей — под тазом, на полу). Руки — цепочки «плечо → локоть → кисть» из групп-шарниров,
 * анимация — только повороты шарниров.
 */

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
	const key = `${color}|${roughness}`;
	let material = materials.get(key);
	if (!material) materials.set(key, (material = new THREE.MeshStandardMaterial({ color, roughness })));
	return material;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	parent.add(mesh);
	return mesh;
}

const SKIN = '#e2b59a';
const STOCKINGS = '#c7a08a';
const SHOES = '#3a2c26';
/** Верх торса (линия плеч) над его низом; низ торса — стоя на уровне бёдер, сидя — над сиденьем. */
const TORSO_HEIGHT = 0.44;
const STANDING_TORSO_Y = 0.98;
const SEATED_TORSO_Y = 0.58;
/** Верх ноги стоящей фигуры — ось шарнира бедра. */
const LEG_TOP = 0.55;

interface Arm {
	shoulder: THREE.Group;
	elbow: THREE.Group;
	hand: THREE.Group;
}

interface Look {
	coat: string;
	hair: string;
	/** cap — белый колпак поверх гладкой причёски с пучком; perm — химическая завивка. */
	hairStyle: 'cap' | 'perm';
	seated?: boolean;
	apron?: boolean;
	glasses?: boolean;
	/** Цвет кожи (по умолчанию — живой). */
	skin?: string;
	/** Мертвец: без румянца, помады и живых глаз — лицо дорисовывает Zombie. */
	dead?: boolean;
	/** Колпак съехал набок, рад. */
	capTilt?: number;
}

/** Общая фигура: ноги, халат, торс, голова с лицом и причёской, две руки на шарнирах. */
class Figure {
	readonly group = new THREE.Group();
	readonly head = new THREE.Group();
	readonly armR: Arm;
	readonly armL: Arm;
	/** Плечи/торс — для лёгкого покачивания. */
	readonly body = new THREE.Group();
	/** Ноги стоящей фигуры на шарнирах в бедре (для ходьбы); у сидящей — пусто. */
	readonly legs: THREE.Group[] = [];
	private readonly skin: string;

	constructor(look: Look) {
		this.skin = look.skin ?? SKIN;
		const coat = mat(look.coat, 0.85);
		const base = look.seated ? SEATED_TORSO_Y : STANDING_TORSO_Y;
		this.group.add(this.body);
		if (look.seated) this._seatedLegs(coat);
		else this._standingLegs(coat);

		// Торс в халате: прямоугольный, плотный; грудь — отдельным выступом; воротник — светлее.
		box(this.body, 0.4, TORSO_HEIGHT, 0.26, coat, 0, base + TORSO_HEIGHT / 2);
		box(this.body, 0.36, 0.14, 0.07, coat, 0, base + 0.27, 0.15);
		box(this.body, 0.2, 0.04, 0.2, mat('#ffffff', 0.8), 0, base + TORSO_HEIGHT - 0.01, 0.02);
		for (let i = 0; i < 3; i++) box(this.body, 0.018, 0.018, 0.01, mat('#d8d6cc', 0.5), 0.03, base + 0.08 + i * 0.1, 0.135);
		if (look.apron) {
			// Фартук поверх халата — от груди до колен, с завязками на поясе.
			const apron = mat('#f7f6f1', 0.9);
			box(this.body, 0.3, 0.25, 0.01, apron, 0, base + 0.18, 0.19);
			if (!look.seated) {
				const skirt = box(this.body, 0.36, 0.42, 0.01, apron, 0, base - 0.19, 0.225);
				skirt.rotation.x = -0.06;
			}
			box(this.body, 0.42, 0.03, 0.27, apron, 0, base + 0.05, 0);
		}

		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 6), mat(this.skin, 0.7));
		neck.position.y = base + TORSO_HEIGHT + 0.03;
		this.body.add(neck);

		this.head.position.y = base + TORSO_HEIGHT + 0.06;
		this.body.add(this.head);
		this._buildHead(look);

		const shoulderY = base + TORSO_HEIGHT - 0.05;
		// «Правая» рука — у самой фигуры: смотрит на +Z, значит правая — со стороны −X.
		this.armR = this._buildArm(coat, -0.245, shoulderY);
		this.armL = this._buildArm(coat, 0.245, shoulderY);
	}

	private _standingLegs(coat: THREE.Material): void {
		// Нога с туфлей — в группе-шарнире на уровне бедра (верх голени, под подолом).
		for (const x of [-0.1, 0.1]) {
			const hip = new THREE.Group();
			hip.position.set(x, LEG_TOP, 0);
			this.group.add(hip);
			this.legs.push(hip);
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.5, 6), mat(STOCKINGS, 0.6));
			leg.position.y = 0.3 - LEG_TOP;
			leg.castShadow = true;
			hip.add(leg);
			box(hip, 0.1, 0.07, 0.22, mat(SHOES, 0.6), 0, 0.035 - LEG_TOP, 0.03);
		}
		// Подол халата — расширяется книзу, до колен.
		const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.46, 8), coat);
		hem.position.y = STANDING_TORSO_Y - 0.23;
		hem.scale.z = 0.72;
		hem.castShadow = true;
		this.body.add(hem);
	}

	private _seatedLegs(coat: THREE.Material): void {
		// Бёдра вперёд, под халатом; голени — вниз до пола.
		box(this.body, 0.42, 0.16, 0.48, coat, 0, SEATED_TORSO_Y - 0.06, 0.12);
		for (const x of [-0.1, 0.1]) {
			const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.46, 6), mat(STOCKINGS, 0.6));
			shin.position.set(x, 0.27, 0.33);
			shin.castShadow = true;
			this.group.add(shin);
			box(this.group, 0.1, 0.07, 0.22, mat(SHOES, 0.6), x, 0.035, 0.38);
		}
	}

	/** Голова: лицо с глазами, бровями, румянцем и накрашенными губами; причёска или колпак; очки. */
	private _buildHead(look: Look): void {
		const h = this.head;
		const skin = mat(this.skin, 0.7);
		box(h, 0.19, 0.23, 0.21, skin, 0, 0.115, 0);
		box(h, 0.03, 0.05, 0.03, skin, 0, 0.1, 0.115);
		for (const x of [-0.105, 0.105]) box(h, 0.02, 0.05, 0.04, skin, x, 0.11, 0);
		const eye = mat('#2a2020', 0.5);
		const brow = mat(look.hair, 0.9);
		for (const x of [-0.045, 0.045]) {
			box(h, 0.045, 0.012, 0.01, brow, x, 0.163, 0.107);
			if (look.dead) continue;
			box(h, 0.03, 0.02, 0.01, mat('#f4f0ea', 0.5), x, 0.13, 0.106);
			box(h, 0.014, 0.018, 0.01, eye, x, 0.13, 0.109);
			box(h, 0.035, 0.022, 0.006, mat('#e39486', 0.8), x * 1.45, 0.075, 0.105);
		}
		if (!look.dead) box(h, 0.065, 0.018, 0.012, mat('#b23a44', 0.5), 0, 0.045, 0.107);

		const hair = mat(look.hair, 0.95);
		if (look.hairStyle === 'cap') {
			// Гладко зачёсанные волосы с пучком на затылке, сверху — накрахмаленный колпак.
			box(h, 0.2, 0.17, 0.08, hair, 0, 0.14, -0.08);
			box(h, 0.2, 0.05, 0.2, hair, 0, 0.215, 0.005);
			const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), hair);
			bun.position.set(0, 0.13, -0.14);
			h.add(bun);
			// Колпак с полями — одной группой, чтобы его можно было сдвинуть набок (capTilt).
			const capGroup = new THREE.Group();
			capGroup.position.set(0, 0.235, -0.005);
			capGroup.rotation.z = look.capTilt ?? 0;
			h.add(capGroup);
			const capColor = look.dead ? '#cfc9b4' : '#fbfbf8';
			const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.112, 0.13, 10), mat(capColor, 0.9));
			cap.position.y = 0.055;
			cap.castShadow = true;
			capGroup.add(cap);
			box(capGroup, 0.23, 0.03, 0.23, mat(capColor, 0.9));
		} else {
			// Химзавивка: шапка кудрей над лбом, по бокам и сзади.
			const curls: [number, number, number, number][] = [];
			for (let i = 0; i < 7; i++) {
				const a = (i / 6) * Math.PI;
				curls.push([Math.cos(a) * 0.09, 0.25 + Math.sin(a) * 0.02, -0.02 + Math.sin(a) * 0.03, 0.065]);
			}
			for (let i = 0; i < 6; i++) {
				const a = (i / 5) * Math.PI;
				curls.push([Math.cos(a) * 0.11, 0.16 + Math.sin(i * 2.1) * 0.03, -0.07 - Math.sin(a) * 0.04, 0.07]);
			}
			curls.push([0, 0.24, 0.07, 0.06], [-0.07, 0.22, 0.07, 0.05], [0.07, 0.22, 0.07, 0.05], [0, 0.08, -0.1, 0.07]);
			for (const [x, y, z, r] of curls) {
				const curl = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), hair);
				curl.position.set(x, y, z);
				curl.rotation.set(x * 20, y * 30, z * 10);
				curl.castShadow = true;
				h.add(curl);
			}
		}

		if (look.glasses) {
			const frame = mat('#3a2a22', 0.5);
			for (const x of [-0.045, 0.045]) {
				const rim = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 4, 8), frame);
				rim.position.set(x, 0.13, 0.115);
				h.add(rim);
			}
			box(h, 0.03, 0.006, 0.006, frame, 0, 0.135, 0.115);
			for (const x of [-0.092, 0.092]) box(h, 0.006, 0.006, 0.11, frame, x, 0.135, 0.06);
		}
	}

	/** Рука на шарнирах: рукав халата до локтя и ниже (три четверти), дальше — кожа и кисть. */
	private _buildArm(coat: THREE.Material, x: number, y: number): Arm {
		const shoulder = new THREE.Group();
		shoulder.position.set(x, y, 0);
		this.body.add(shoulder);
		box(shoulder, 0.1, 0.31, 0.11, coat, 0, -0.14, 0);
		const elbow = new THREE.Group();
		elbow.position.y = -0.29;
		shoulder.add(elbow);
		box(elbow, 0.095, 0.13, 0.105, coat, 0, -0.05, 0);
		box(elbow, 0.075, 0.14, 0.075, mat(this.skin, 0.7), 0, -0.18, 0);
		const hand = new THREE.Group();
		hand.position.y = -0.26;
		elbow.add(hand);
		box(hand, 0.07, 0.09, 0.04, mat(this.skin, 0.7), 0, -0.04, 0);
		return { shoulder, elbow, hand };
	}
}

function smooth(t: number): number {
	const c = THREE.MathUtils.clamp(t, 0, 1);
	return c * c * (3 - 2 * c);
}

/** Длины звеньев руки (см. Figure._buildArm): плечо → локоть, локоть → кисть, кисть → середина ладони. */
const UPPER_ARM = 0.29;
const FOREARM = 0.26;
const PALM = 0.04;

/**
 * Навести руку на точку (в координатах корпуса фигуры): простая двухзвенная IK.
 * lower — длина от локтя до точки, которая должна попасть в цель (кисть или то, что в ней).
 * Плечо поворачивает руку в сторону цели и отводит на угол, который съест сгиб локтя; локоть сгибается вперёд.
 */
function reach(arm: Arm, target: THREE.Vector3, lower: number): void {
	const v = target.clone().sub(arm.shoulder.position);
	const a = UPPER_ARM;
	const b = lower;
	const length = THREE.MathUtils.clamp(v.length(), Math.abs(a - b) + 0.01, a + b - 0.001);
	v.normalize();
	// Висящая рука (0,−1,0) после Rz(ψ), затем Rx(θ) смотрит в (sinψ, −cosψ·cosθ, −cosψ·sinθ).
	const psi = Math.asin(THREE.MathUtils.clamp(v.x, -1, 1));
	const theta = Math.atan2(-v.z, -v.y);
	const shoulderOffset = Math.acos(THREE.MathUtils.clamp((a * a + length * length - b * b) / (2 * a * length), -1, 1));
	const elbowBend = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - length * length) / (2 * a * b), -1, 1));
	arm.shoulder.rotation.set(theta + shoulderOffset, 0, psi);
	arm.elbow.rotation.set(-elbowBend, 0, 0);
}

/** Сглаженная интерполяция между ключами [время 0..1, значение] по фазе цикла. */
function keyframes<T>(keys: [number, T][], phase: number, lerp: (from: T, to: T, t: number) => T): T {
	for (let i = 0; i < keys.length - 1; i++) {
		const [t0, v0] = keys[i];
		const [t1, v1] = keys[i + 1];
		if (phase <= t1) return lerp(v0, v1, smooth((phase - t0) / (t1 - t0)));
	}
	return keys[keys.length - 1][1];
}

/** Длина половника от кисти до середины черпака. */
const LADLE_LENGTH = 0.3;
/** Сколько секунд раздатчица наливает тарелку. */
const POUR_TIME = 4;
/** С какого расстояния (м) она замечает игрока и смотрит на него. */
const VIEWER_ATTENTION = 4;

/**
 * Раздатчица у кастрюль. Пока не попросили — помешивает половником в кастрюле и смотрит на подошедшего.
 * После pour() один раз наливает: зачерпнуть → перенести к тарелке → наклонить черпак → вернуться;
 * тарелка к концу наливания полная (bowlFill = 1) и такой остаётся. Левой рукой придерживается за прилавок.
 */
export class DinnerLady {
	private readonly figure = new Figure({ coat: '#f1f0ea', hair: '#5a3a26', hairStyle: 'cap', apron: true });
	readonly group = this.figure.group;
	private time = 0;
	private readonly ladle = new THREE.Group();
	/** Черпак — отдельно: при наливании наклоняется только он. */
	private readonly cup = new THREE.Group();
	private readonly soup: THREE.Mesh;
	/** Ключевые точки черпака (в координатах фигуры): над кастрюлей, в супе, над тарелкой. */
	private abovePot = new THREE.Vector3(-0.3, 1.43, 0.36);
	private inPot = new THREE.Vector3(-0.3, 1.15, 0.36);
	private overBowl = new THREE.Vector3(0, 1.04, 0.66);
	private readonly target = new THREE.Vector3();
	private readonly lookAt = new THREE.Vector3();
	/** Насколько налита тарелка: 0 — пустая, 1 — полная (к концу наливания). */
	bowlFill = 0;
	private state: 'idle' | 'pouring' | 'served' = 'idle';
	private pourTime = 0;

	constructor() {
		const steel = new THREE.MeshStandardMaterial({ color: '#c3c7c9', roughness: 0.35, metalness: 0.6 });
		// Черенок — продолжение предплечья (вдоль −Y кисти), черпак — на конце.
		this.figure.armR.hand.add(this.ladle);
		box(this.ladle, 0.014, LADLE_LENGTH, 0.014, steel, 0, -LADLE_LENGTH / 2 - 0.03, 0);
		this.cup.position.y = -LADLE_LENGTH - 0.03;
		this.ladle.add(this.cup);
		const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.045, 8, 1, true), steel);
		bowl.material = steel.clone();
		(bowl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
		this.cup.add(bowl);
		this.soup = new THREE.Mesh(new THREE.CircleGeometry(0.046, 8), mat(SOUP_COLOR.solyanka, 0.3));
		this.soup.rotation.x = -Math.PI / 2;
		this.soup.position.y = 0.015;
		this.cup.add(this.soup);
	}

	/** Где кастрюля и тарелка (точки на столешнице под их центрами, в координатах фигуры). */
	setTargets(pot: THREE.Vector3, bowl: THREE.Vector3): void {
		this.abovePot.set(pot.x, pot.y + 0.55, pot.z);
		this.inPot.set(pot.x, pot.y + 0.26, pot.z);
		this.overBowl.set(bowl.x, bowl.y + 0.17, bowl.z);
		// Левая рука лежит на краю прилавка, чуть левее тарелки.
		reach(this.figure.armL, new THREE.Vector3(0.28, pot.y + 0.02, 0.24), FOREARM + PALM);
	}

	/** Налить тарелку (один раз — дальше раздатчица снова помешивает). */
	pour(): void {
		if (this.state !== 'idle') return;
		this.state = 'pouring';
		this.pourTime = 0;
	}

	/** Тарелка налита. */
	get served(): boolean {
		return this.state === 'served';
	}

	/** viewer — где глаза игрока (в мире): пока она не занята, смотрит на него, если он рядом. */
	update(dt: number, viewer: THREE.Vector3): void {
		this.time += dt;
		const { armR, head, body } = this.figure;

		// Помешивание — черпак ходит по кругу в супе.
		const stir = this.target
			.copy(this.inPot)
			.add(new THREE.Vector3(Math.sin(this.time * 1.6) * 0.07, 0.04, Math.cos(this.time * 1.6) * 0.06))
			.clone();
		let point = stir;
		let pour = 0;
		let lookAtLadle = false;
		if (this.state === 'pouring') {
			this.pourTime += dt;
			const phase = Math.min(1, this.pourTime / POUR_TIME);
			const lerpVec = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
			// Из помешивания: зачерпнуть (покачать в супе) → поднять → к тарелке → налить → назад в кастрюлю.
			point = keyframes<THREE.Vector3>(
				[
					[0, stir],
					[0.08, this.inPot],
					[0.22, this.inPot],
					[0.34, this.abovePot],
					[0.5, this.overBowl],
					[0.74, this.overBowl],
					[0.88, this.abovePot],
					[1, stir],
				],
				phase,
				lerpVec
			);
			if (phase > 0.08 && phase < 0.22) point.x += Math.sin(((phase - 0.08) / 0.14) * Math.PI * 2) * 0.03;
			pour = keyframes<number>(
				[
					[0, 0],
					[0.53, 0],
					[0.62, 1],
					[0.72, 1],
					[0.8, 0],
					[1, 0],
				],
				phase,
				THREE.MathUtils.lerp
			);
			this.soup.visible = phase > 0.2 && phase < 0.68;
			this.bowlFill = smooth((phase - 0.56) / 0.14);
			lookAtLadle = true;
			if (phase >= 1) {
				this.state = 'served';
				this.soup.visible = false;
			}
		}
		reach(armR, point, FOREARM + 0.03 + LADLE_LENGTH);

		// Черпак держим ровно, пока несём; наливая — наклоняем от себя.
		const armTilt = armR.shoulder.rotation.x + armR.elbow.rotation.x;
		this.cup.rotation.set(-armTilt + pour * 1.3, 0, -armR.shoulder.rotation.z);

		// Куда смотрит: на половник, когда наливает; иначе — на игрока, если он у раздачи; иначе — в кастрюлю.
		const local = this.group.worldToLocal(this.lookAt.copy(viewer));
		const nearViewer = !lookAtLadle && local.z > 0 && local.length() < VIEWER_ATTENTION;
		if (!nearViewer) this.lookAt.copy(point);
		this.lookAt.sub(head.position);
		const yaw = Math.atan2(this.lookAt.x, this.lookAt.z) * 0.8;
		const pitch = THREE.MathUtils.clamp(Math.atan2(-this.lookAt.y, Math.hypot(this.lookAt.x, this.lookAt.z)), -0.3, 0.6);
		// Голова поворачивается плавно, а не рывком.
		const k = 1 - Math.exp(-dt * 6);
		head.rotation.y += (yaw - head.rotation.y) * k;
		head.rotation.x += (pitch - head.rotation.x) * k;
		body.rotation.y = Math.sin(this.time * 0.4) * 0.03;
	}
}

/**
 * Кассир на табурете за кассой: пробивает чеки (пальцы по клавишам), крутит ручку аппарата,
 * между покупателями поглядывает на очередь (линия раздачи — справа от неё, со стороны −X).
 */
export class Cashier {
	private readonly figure = new Figure({ coat: '#eae7de', hair: '#8a3a1e', hairStyle: 'perm', seated: true, glasses: true });
	readonly group = this.figure.group;
	private time = 1.5;

	update(dt: number): void {
		this.time += dt;
		const { armL, armR, head, body } = this.figure;
		const cycle = 7;
		const t = this.time % cycle;
		// 0–3 с: печатает; 3–4: крутит ручку; 4–7: смотрит на очередь, руки на кассе.
		const typing = t < 3;
		const cranking = t >= 3 && t < 4;
		const lookAtLine = smooth((t - 4) / 0.5) - smooth((t - 6.5) / 0.5);

		armL.shoulder.rotation.set(-1.05, 0, 0.12);
		armL.elbow.rotation.x = -0.55 + (typing ? Math.max(0, Math.sin(this.time * 13)) * 0.12 : 0);
		if (cranking) {
			const turn = (t - 3) * Math.PI * 2;
			armR.shoulder.rotation.set(-0.8 + Math.sin(turn) * 0.12, 0, -0.35);
			armR.elbow.rotation.x = -0.7 + Math.cos(turn) * 0.15;
		} else {
			armR.shoulder.rotation.set(-1.05, 0, -0.12);
			armR.elbow.rotation.x = -0.55 + (typing ? Math.max(0, Math.sin(this.time * 13 + 1.7)) * 0.12 : 0);
		}

		head.rotation.x = THREE.MathUtils.lerp(0.35, 0.05, lookAtLine) + (typing ? Math.sin(this.time * 2.1) * 0.03 : 0);
		head.rotation.y = THREE.MathUtils.lerp(cranking ? -0.15 : 0, -0.75, lookAtLine);
		body.rotation.y = lookAtLine * -0.12;
	}
}

/** Сколько попаданий (выстрелов) нужно, чтобы зомби разорвало. */
const ZOMBIE_HEALTH = 1;
const ZOMBIE_FLINCH_TIME = 0.3;
const BLOOD_LIFE = 1.2;
const GRAVITY = 9.8;
/** Брызг крови от попадания и от разрыва тела. */
const HIT_BLOOD = 14;
const BURST_BLOOD = 90;
/** Больше пятен крови на полу от одного зомби не заводим. */
const MAX_SPLATS = 160;
/** Лужа под останками растёт до такого радиуса за столько секунд. */
const POOL_RADIUS = 0.95;
const POOL_TIME = 4;
/** Стоны: пауза между ними, с (случайно в пределах). */
const GROAN_MIN = 3;
const GROAN_MAX = 7;
/** Ходьба зомби: длина шага (м), как быстро поворачивается к цели (рад/с), радиус для столкновений. */
const ZOMBIE_STEP = 0.55;
const ZOMBIE_TURN_SPEED = 2.5;
const ZOMBIE_RADIUS = 0.3;
/**
 * Удар: подойдя к цели (не дальше stopDistance + ATTACK_REACH), замахивается обеими руками (ATTACK_WINDUP), бьёт
 * сверху вниз (к ATTACK_HIT — onAttack, Game решает, попал ли), возвращается (ATTACK_TIME) и ждёт ATTACK_COOLDOWN.
 */
const ATTACK_REACH = 0.3;
const ATTACK_WINDUP = 0.4;
const ATTACK_HIT = 0.5;
const ATTACK_TIME = 0.85;
const ATTACK_COOLDOWN = 0.8;

interface BloodDrop {
	mesh: THREE.Mesh;
	velocity: THREE.Vector3;
	life: number;
}

/** Кусок разорванного тела: летит, кувыркается, отскакивает от пола и в итоге лежит. */
interface Gib {
	object: THREE.Object3D;
	velocity: THREE.Vector3;
	spin: THREE.Vector3;
	/** Уже шлёпнулся об пол (оставил пятно). */
	landed: boolean;
	resting: boolean;
}

/** Прямоугольник, внутри которого куски отскакивают от стен (по X/Z), — чтобы не улетали сквозь стены. */
export interface GibBounds {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

/**
 * Враг: та же раздатчица, но мёртвая и потрёпанная — серо-зелёная кожа, грязный халат в пятнах крови и дырах,
 * колпак набок, мутные светящиеся глаза в тёмных глазницах, открытый окровавленный рот. Стоит, вытянув руки вперёд,
 * покачивается, голова свёрнута набок. Попадание (hit) — фонтан крови; набрав урон, тело разрывает на части:
 * голова, руки по суставам, торс, подол, ноги и ошмётки разлетаются от выстрела, падают и остаются лежать в лужах крови.
 */
export class Zombie {
	private readonly figure = new Figure({
		coat: '#b8b29c',
		hair: '#3b3530',
		hairStyle: 'cap',
		apron: true,
		skin: '#97a386',
		dead: true,
		capTilt: 0.35,
	});
	readonly group = this.figure.group;
	/** Где куски отскакивают от стен; null — не ограничиваем. */
	bounds: GibBounds | null = null;
	/** Куда идёт (обычно — к игроку); null — стоит на месте. Останавливается в stopDistance от цели. */
	target: THREE.Vector3 | null = null;
	speed = 0.7;
	stopDistance = 1.0;
	/** Препятствия, которые обходит (упирается и скользит вдоль); null — идёт насквозь (в катсцене). */
	colliders: CircleColliders | null = null;
	private walkPhase = 0;
	/** 0 — стоит, 1 — идёт: плавно, чтобы шаг не обрывался. */
	private walkWeight = 0;
	private time = Math.random() * 10;
	private health = ZOMBIE_HEALTH;
	private exploded = false;
	/** 1 — только что попали, к 0 — отошёл. */
	private flinch = 0;
	private readonly blood: BloodDrop[] = [];
	private readonly gibs: Gib[] = [];
	private splats = 0;
	private pool: THREE.Mesh | null = null;
	private poolT = 0;
	private readonly bloodMaterial = mat('#5a0c0c', 0.4);
	private readonly bloodGeometry = new THREE.BoxGeometry(0.025, 0.025, 0.025);
	/** Пятна на полу: плоские круги, чуть над полом и со смещением глубины — не мерцают. */
	private readonly splatMaterial = new THREE.MeshStandardMaterial({
		color: '#4a0707',
		roughness: 0.25,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2,
	});
	private readonly splatGeometry = new THREE.CircleGeometry(1, 9);
	private readonly box3 = new THREE.Box3();
	/** Сколько ещё до следующего стона, с. */
	private groanTimer = 1 + Math.random() * 2;
	/** Пора стонать — Game играет звук с громкостью и панорамой по расстоянию до игрока. */
	onGroan: (() => void) | null = null;
	/** 1 — только что застонал: голова запрокидывается, к 0 — вернулась. */
	private groan = 0;
	/** Удар по цели: Game проверяет, рядом ли игрок, и наносит урон. */
	onAttack: (() => void) | null = null;
	/** Охотится на игрока — только тогда бьёт, подойдя к цели (в катсцене просто идёт). */
	hunting = false;
	/** Время с начала удара, с; null — не бьёт. */
	private attackT: number | null = null;
	private attackCooldown = 0;
	/** Пятна крови на полу (с лужей) — чтобы убрать при dispose. */
	private readonly splatMeshes: THREE.Mesh[] = [];

	constructor() {
		this._buildFace();
		this._buildDamage();
	}

	get alive(): boolean {
		return !this.exploded;
	}

	/** Объект — часть этого зомби или его разлетевшихся останков (для попаданий лучом). */
	owns(object: THREE.Object3D): boolean {
		for (let o: THREE.Object3D | null = object; o; o = o.parent) {
			if (o === this.group || this.gibs.some((gib) => gib.object === o)) return true;
		}
		return false;
	}

	/** Попал выстрел: point — куда (в мире), direction — куда летел. Брызги крови; урон, на нуле — разрывает. */
	hit(point: THREE.Vector3, direction: THREE.Vector3): void {
		if (!this.alive) return;
		this._splash(point, direction, HIT_BLOOD, 1);
		this.flinch = 1;
		this.health--;
		if (this.health <= 0) this._explode(point, direction);
	}

	update(dt: number): void {
		this.time += dt;
		this._updateBlood(dt);
		this._updateGibs(dt);
		if (this.pool && this.poolT < POOL_TIME) {
			this.poolT += dt;
			const k = Math.min(1, this.poolT / POOL_TIME);
			this.pool.scale.setScalar(0.15 + (POOL_RADIUS - 0.15) * (1 - (1 - k) ** 2));
		}
		if (this.exploded) return;

		const { armL, armR, head, body } = this.figure;
		this.flinch = Math.max(0, this.flinch - dt / ZOMBIE_FLINCH_TIME);
		this.groan = Math.max(0, this.groan - dt / 1.5);
		this.groanTimer -= dt;
		// Спрятанный (ещё не вышел на сцену) — молчит.
		if (this.groanTimer <= 0 && this.group.visible) {
			this.groanTimer = GROAN_MIN + Math.random() * (GROAN_MAX - GROAN_MIN);
			this.groan = 1;
			this.onGroan?.();
		}
		const moved = this.attackT === null ? this._walk(dt) : 0;
		const swing = this._updateAttack(dt);
		this.walkPhase += (moved / ZOMBIE_STEP) * Math.PI;
		this.walkWeight += ((moved > 0.0001 ? 1 : 0) - this.walkWeight) * (1 - Math.exp(-dt * 6));
		const step = Math.sin(this.walkPhase) * this.walkWeight;
		// Шаркающая походка: ноги ходят вперёд-назад, тело переваливается с боку на бок и оседает на каждом шаге.
		const [legR, legL] = this.figure.legs;
		legR.rotation.x = step * 0.45;
		legL.rotation.x = -step * 0.45;
		body.position.y = -Math.abs(step) * 0.03;

		// Руки вытянуты вперёд, как у зомби, кисти свисают; каждая чуть покачивается сама по себе.
		const sway = Math.sin(this.time * 0.9) + step * 1.6;
		// Удар: руки взмывают вверх (swing < 0) и рушатся вниз (swing > 0).
		armR.shoulder.rotation.set(-1.45 + Math.sin(this.time * 1.3) * 0.06 - swing * 0.9, 0, 0.08);
		armL.shoulder.rotation.set(-1.35 + Math.sin(this.time * 1.1 + 1) * 0.06 - swing * 0.9, 0, -0.1);
		armR.elbow.rotation.x = -0.15;
		armL.elbow.rotation.x = -0.25;
		armR.hand.rotation.x = 0.5;
		armL.hand.rotation.x = 0.65;
		// Тело подалось вперёд и качается; от попадания — отшатывается назад.
		body.rotation.set(0.12 - this.flinch * 0.3 + swing * 0.2, 0, sway * 0.05);
		// Голова свёрнута набок и свешена; изредка дёргается.
		const twitch = Math.sin(this.time * 7) > 0.97 ? Math.sin(this.time * 40) * 0.08 : 0;
		// Стонет — голова запрокидывается назад.
		const groanLift = Math.sin(this.groan * Math.PI) * 0.35;
		head.rotation.set(0.2 - this.flinch * 0.4 - groanLift, 0.1, 0.4 + twitch);
	}

	/**
	 * Удар: вблизи цели — замах, удар, возврат, пауза. Возвращает положение рук: −1 — занесены над головой,
	 * +1 — в самом низу удара, 0 — обычно.
	 */
	private _updateAttack(dt: number): number {
		this.attackCooldown = Math.max(0, this.attackCooldown - dt);
		if (this.attackT === null) {
			if (!this.hunting || !this.target || this.attackCooldown > 0) return 0;
			const distance = Math.hypot(this.target.x - this.group.position.x, this.target.z - this.group.position.z);
			if (distance > this.stopDistance + ATTACK_REACH) return 0;
			this.attackT = 0;
			// Замахиваясь — рычит.
			this.groan = 1;
			this.groanTimer = GROAN_MIN + Math.random() * (GROAN_MAX - GROAN_MIN);
			this.onGroan?.();
		}
		const prev = this.attackT;
		this.attackT += dt;
		const t = this.attackT;
		if (prev < ATTACK_HIT && t >= ATTACK_HIT) this.onAttack?.();
		if (t >= ATTACK_TIME) {
			this.attackT = null;
			this.attackCooldown = ATTACK_COOLDOWN;
			return 0;
		}
		const smooth = (k: number) => k * k * (3 - 2 * k);
		if (t < ATTACK_WINDUP) return -smooth(t / ATTACK_WINDUP);
		if (t < ATTACK_HIT) return -1 + 2 * ((t - ATTACK_WINDUP) / (ATTACK_HIT - ATTACK_WINDUP));
		return 1 - smooth((t - ATTACK_HIT) / (ATTACK_TIME - ATTACK_HIT));
	}

	/** Убрать зомби со сцены целиком: тело, разлетевшиеся куски, капли и пятна крови (при перезапуске боя). */
	dispose(): void {
		for (const gib of this.gibs) gib.object.removeFromParent();
		for (const drop of this.blood) drop.mesh.removeFromParent();
		for (const splat of this.splatMeshes) splat.removeFromParent();
		this.gibs.length = 0;
		this.blood.length = 0;
		this.splatMeshes.length = 0;
		this.group.removeFromParent();
	}

	/** Шаг к цели: сначала поворачивается к ней (плавно), идёт вперёд, пока не подойдёт на stopDistance.
	 * Возвращает, сколько прошёл за кадр, м. */
	private _walk(dt: number): number {
		if (!this.target) return 0;
		const pos = this.group.position;
		const dx = this.target.x - pos.x;
		const dz = this.target.z - pos.z;
		const distance = Math.hypot(dx, dz);
		if (distance < 0.01) return 0;
		const want = Math.atan2(dx, dz);
		const turn = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y));
		this.group.rotation.y += THREE.MathUtils.clamp(turn, -ZOMBIE_TURN_SPEED * dt, ZOMBIE_TURN_SPEED * dt);
		if (distance <= this.stopDistance) return 0;
		// Сильно отвернувшись от цели, почти не идёт — сперва разворачивается.
		const facing = Math.max(0, Math.cos(turn));
		const step = Math.min(this.speed * facing * dt, distance - this.stopDistance);
		const yaw = this.group.rotation.y;
		const startX = pos.x;
		const startZ = pos.z;
		pos.x += Math.sin(yaw) * step;
		pos.z += Math.cos(yaw) * step;
		this.colliders?.resolve(pos, ZOMBIE_RADIUS);
		return Math.hypot(pos.x - startX, pos.z - startZ);
	}

	/**
	 * Разрыв: тело разбирается на куски — они переносятся в сцену с тем же положением в мире и летят от выстрела
	 * вверх и в стороны. Плюс ошмётки, фонтан крови из торса и лужа, растущая под останками.
	 */
	private _explode(point: THREE.Vector3, direction: THREE.Vector3): void {
		this.exploded = true;
		const scene = this.group.parent;
		if (!scene) return;
		this.group.updateWorldMatrix(true, true);
		const { head, armL, armR, body } = this.figure;

		// Низ халата (подол, фартук ниже пояса, лоскуты) — отдельным куском от торса.
		const lower = new THREE.Group();
		body.add(lower);
		for (const child of [...body.children]) {
			if (child instanceof THREE.Mesh && child.position.y < STANDING_TORSO_Y) lower.attach(child);
		}
		// Сначала дальние звенья (кисть с предплечьем от плеча, голова, плечи от торса), потом сам торс и ноги.
		const pieces: THREE.Object3D[] = [armR.elbow, armL.elbow, armR.shoulder, armL.shoulder, head, lower, body, ...this.figure.legs];
		const center = new THREE.Vector3();
		this.group.localToWorld(center.set(0, STANDING_TORSO_Y + 0.2, 0));
		const push = direction.clone().setY(0).normalize();
		for (const piece of pieces) {
			scene.attach(piece);
			const from = piece.getWorldPosition(new THREE.Vector3());
			// Разлетаются от центра и по ходу выстрела; голову и руки — сильнее и выше.
			const light = piece === head || piece === armR.elbow || piece === armL.elbow;
			const velocity = from
				.clone()
				.sub(center)
				.setY(0)
				.multiplyScalar(4)
				.addScaledVector(push, 2 + Math.random() * 2.5)
				.add(new THREE.Vector3((Math.random() - 0.5) * 2.5, (light ? 3 : 1.5) + Math.random() * 2, (Math.random() - 0.5) * 2.5));
			const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(light ? 16 : 7);
			this.gibs.push({ object: piece, velocity, spin, landed: false, resting: false });
		}
		// Ошмётки — куски мяса, кожи и ткани.
		const colors = ['#6b1010', '#8a2a22', '#4a0a0a', '#97a386', '#b8b29c', '#7a1a16'];
		for (let i = 0; i < 12; i++) {
			const size = 0.035 + Math.random() * 0.06;
			const chunk = new THREE.Mesh(
				new THREE.BoxGeometry(size, size * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8)),
				mat(colors[i % colors.length], 0.5)
			);
			chunk.castShadow = true;
			chunk.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3));
			scene.add(chunk);
			const velocity = push
				.clone()
				.multiplyScalar(2 + Math.random() * 3)
				.add(new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5));
			const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(20);
			this.gibs.push({ object: chunk, velocity, spin, landed: false, resting: false });
		}

		this._splash(point, direction, BURST_BLOOD / 3, 1.5);
		this._splash(center, push, BURST_BLOOD, 2.2);
		// Лужа под останками: растёт, пока кровь стекает.
		this.pool = this._splat(this.group.position.x, this.group.position.z, 1);
		this.pool.scale.setScalar(0.15);
	}

	/** Полёт кусков: гравитация, кувырок, отскок от пола (по нижней точке куска) и от стен, трение — и замирают. */
	private _updateGibs(dt: number): void {
		for (const gib of this.gibs) {
			if (gib.resting) continue;
			const { object, velocity, spin } = gib;
			velocity.y -= GRAVITY * dt;
			object.position.addScaledVector(velocity, dt);
			object.rotation.x += spin.x * dt;
			object.rotation.y += spin.y * dt;
			object.rotation.z += spin.z * dt;
			if (this.bounds) {
				const { minX, maxX, minZ, maxZ } = this.bounds;
				if (object.position.x < minX || object.position.x > maxX) {
					object.position.x = THREE.MathUtils.clamp(object.position.x, minX, maxX);
					velocity.x *= -0.3;
				}
				if (object.position.z < minZ || object.position.z > maxZ) {
					object.position.z = THREE.MathUtils.clamp(object.position.z, minZ, maxZ);
					velocity.z *= -0.3;
				}
			}
			const bottom = this.box3.setFromObject(object).min.y;
			if (bottom < 0) {
				object.position.y -= bottom;
				if (!gib.landed && velocity.y < -1.5) {
					// Шлёпнулся — пятно крови под ним.
					gib.landed = true;
					this._splat(object.position.x, object.position.z, 0.12 + Math.random() * 0.15);
				}
				if (velocity.y < 0) velocity.y *= -0.25;
				velocity.x *= 0.6;
				velocity.z *= 0.6;
				spin.multiplyScalar(0.55);
				if (velocity.lengthSq() < 0.04) gib.resting = true;
			}
		}
	}

	/** Мёртвое лицо поверх головы Figure: глазницы, мутные глаза, открытый рот с зубами, кровь на подбородке, рана. */
	private _buildFace(): void {
		const h = this.figure.head;
		const socket = mat('#2e2b24', 0.9);
		// Глаза чуть светятся (без освещения) — видно и в темноте.
		const eye = new THREE.MeshBasicMaterial({ color: '#d8d09a' });
		for (const x of [-0.045, 0.045]) {
			box(h, 0.048, 0.036, 0.008, socket, x, 0.13, 0.106);
			box(h, 0.02, 0.012, 0.008, eye, x, 0.13, 0.11);
		}
		box(h, 0.065, 0.04, 0.008, mat('#1c0808', 0.9), 0, 0.045, 0.107);
		box(h, 0.055, 0.008, 0.008, mat('#b8ae8e', 0.6), 0, 0.061, 0.109);
		box(h, 0.03, 0.05, 0.006, this.bloodMaterial, 0.008, 0.012, 0.108);
		box(h, 0.035, 0.03, 0.006, mat('#4a0c0c', 0.7), 0.065, 0.095, 0.106);
		// Серые пряди выбились из-под колпака.
		box(h, 0.02, 0.09, 0.02, mat('#6d675d', 0.95), -0.09, 0.17, 0.07).rotation.z = 0.3;
		box(h, 0.02, 0.07, 0.02, mat('#6d675d', 0.95), 0.08, 0.18, 0.08).rotation.z = -0.4;
	}

	/** Кровь и грязь на халате и фартуке, дыры, рваные лоскуты подола, порванные чулки. */
	private _buildDamage(): void {
		const b = this.figure.body;
		const blood = this.bloodMaterial;
		const dried = mat('#3d1410', 0.9);
		const dirt = mat('#6e6553', 0.95);
		const hole = mat('#231f1b', 0.95);
		const base = STANDING_TORSO_Y;
		// [w, h, x, y, z, материал] — пятна прямо на фартуке/халате (тонкие плашки чуть перед поверхностью).
		const patches: [number, number, number, number, number, THREE.Material][] = [
			[0.12, 0.16, 0.02, base + 0.22, 0.2, blood],
			[0.07, 0.09, -0.08, base + 0.12, 0.2, dried],
			[0.05, 0.12, 0.05, base + 0.08, 0.2, blood],
			[0.15, 0.1, -0.05, base - 0.1, 0.24, dried],
			[0.06, 0.14, 0.1, base - 0.25, 0.245, blood],
			[0.1, 0.06, -0.1, base - 0.33, 0.25, dirt],
			[0.04, 0.04, 0.12, base + 0.33, 0.14, hole],
			[0.09, 0.05, -0.12, base + 0.36, 0.14, blood],
			[0.05, 0.05, -0.13, base - 0.05, 0.24, hole],
		];
		for (const [w, hh, x, y, z, m] of patches) box(b, w, hh, 0.004, m, x, y, z);
		// Воротник и плечи забрызганы.
		box(b, 0.12, 0.02, 0.1, blood, 0.03, base + TORSO_HEIGHT + 0.005, 0.07);

		// Рваный подол: свисающие лоскуты разной длины.
		const rag = mat('#a39d86', 0.9);
		for (const [angle, length] of [
			[-0.9, 0.12],
			[-0.3, 0.08],
			[0.4, 0.14],
			[1.1, 0.07],
			[2.4, 0.1],
			[-2.2, 0.09],
		] as const) {
			const strip = box(b, 0.06, length, 0.01, rag, Math.sin(angle) * 0.23, base - 0.46 - length / 2 + 0.02, Math.cos(angle) * 0.17);
			strip.rotation.set(0.1, angle, (angle % 1) * 0.3);
		}

		// Рукава — в дырах и крови.
		box(this.figure.armR.shoulder, 0.04, 0.06, 0.004, hole, 0, -0.16, 0.057);
		box(this.figure.armL.elbow, 0.05, 0.05, 0.004, blood, 0, -0.05, 0.055);
		box(this.figure.armL.hand, 0.074, 0.03, 0.044, blood, 0, -0.07, 0);

		// Чулки порваны — сквозь дыры кожа.
		const skin = mat('#97a386', 0.7);
		const [legR, legL] = this.figure.legs;
		box(legR, 0.05, 0.08, 0.01, skin, 0, 0.35 - LEG_TOP, 0.056);
		box(legL, 0.04, 0.05, 0.01, skin, 0.01, 0.22 - LEG_TOP, 0.054);
	}

	/** Брызги крови из точки: count капель назад по выстрелу, вверх и в стороны, с силой power; падая на пол — пятна. */
	private _splash(point: THREE.Vector3, direction: THREE.Vector3, count: number, power: number): void {
		const parent = this.group.parent;
		if (!parent) return;
		for (let i = 0; i < count; i++) {
			const mesh = new THREE.Mesh(this.bloodGeometry, this.bloodMaterial);
			mesh.position.copy(point);
			mesh.scale.setScalar(0.6 + Math.random() * 1.4);
			parent.add(mesh);
			const velocity = direction
				.clone()
				.multiplyScalar((Math.random() - 0.35) * 2 * power)
				.add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.2, Math.random() - 0.5).multiplyScalar(1.8 * power));
			this.blood.push({ mesh, velocity, life: BLOOD_LIFE * (0.6 + Math.random() * 0.6) });
		}
	}

	private _updateBlood(dt: number): void {
		for (let i = this.blood.length - 1; i >= 0; i--) {
			const drop = this.blood[i];
			drop.life -= dt;
			drop.velocity.y -= GRAVITY * dt;
			drop.mesh.position.addScaledVector(drop.velocity, dt);
			const landed = drop.mesh.position.y < 0.01;
			if (landed || drop.life <= 0) {
				if (landed && Math.random() < 0.6) this._splat(drop.mesh.position.x, drop.mesh.position.z, 0.02 + Math.random() * 0.07);
				drop.mesh.removeFromParent();
				this.blood.splice(i, 1);
			}
		}
	}

	/** Пятно крови на полу радиуса radius; сверх MAX_SPLATS — не заводим (лужу — всегда). */
	private _splat(x: number, z: number, radius: number): THREE.Mesh {
		const splat = new THREE.Mesh(this.splatGeometry, this.splatMaterial);
		splat.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
		splat.position.set(x, 0.004 + Math.random() * 0.002, z);
		splat.scale.set(radius, radius * (0.6 + Math.random() * 0.4), 1);
		splat.receiveShadow = true;
		if (this.splats < MAX_SPLATS || radius >= 1) {
			this.splats++;
			this.group.parent?.add(splat);
			this.splatMeshes.push(splat);
		}
		return splat;
	}
}
