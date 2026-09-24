import * as THREE from 'three';
import { SOUP_COLOR } from './CanteenProps.js';

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
}

/** Общая фигура: ноги, халат, торс, голова с лицом и причёской, две руки на шарнирах. */
class Figure {
	readonly group = new THREE.Group();
	readonly head = new THREE.Group();
	readonly armR: Arm;
	readonly armL: Arm;
	/** Плечи/торс — для лёгкого покачивания. */
	readonly body = new THREE.Group();

	constructor(look: Look) {
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

		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 6), mat(SKIN, 0.7));
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
		for (const x of [-0.1, 0.1]) {
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.5, 6), mat(STOCKINGS, 0.6));
			leg.position.set(x, 0.3, 0);
			leg.castShadow = true;
			this.group.add(leg);
			box(this.group, 0.1, 0.07, 0.22, mat(SHOES, 0.6), x, 0.035, 0.03);
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
		const skin = mat(SKIN, 0.7);
		box(h, 0.19, 0.23, 0.21, skin, 0, 0.115, 0);
		box(h, 0.03, 0.05, 0.03, skin, 0, 0.1, 0.115);
		for (const x of [-0.105, 0.105]) box(h, 0.02, 0.05, 0.04, skin, x, 0.11, 0);
		const eye = mat('#2a2020', 0.5);
		const brow = mat(look.hair, 0.9);
		for (const x of [-0.045, 0.045]) {
			box(h, 0.03, 0.02, 0.01, mat('#f4f0ea', 0.5), x, 0.13, 0.106);
			box(h, 0.014, 0.018, 0.01, eye, x, 0.13, 0.109);
			box(h, 0.045, 0.012, 0.01, brow, x, 0.163, 0.107);
			box(h, 0.035, 0.022, 0.006, mat('#e39486', 0.8), x * 1.45, 0.075, 0.105);
		}
		box(h, 0.065, 0.018, 0.012, mat('#b23a44', 0.5), 0, 0.045, 0.107);

		const hair = mat(look.hair, 0.95);
		if (look.hairStyle === 'cap') {
			// Гладко зачёсанные волосы с пучком на затылке, сверху — накрахмаленный колпак.
			box(h, 0.2, 0.17, 0.08, hair, 0, 0.14, -0.08);
			box(h, 0.2, 0.05, 0.2, hair, 0, 0.215, 0.005);
			const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), hair);
			bun.position.set(0, 0.13, -0.14);
			h.add(bun);
			const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.112, 0.13, 10), mat('#fbfbf8', 0.9));
			cap.position.set(0, 0.29, -0.005);
			cap.castShadow = true;
			h.add(cap);
			box(h, 0.23, 0.03, 0.23, mat('#fbfbf8', 0.9), 0, 0.235, -0.005);
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
		box(elbow, 0.075, 0.14, 0.075, mat(SKIN, 0.7), 0, -0.18, 0);
		const hand = new THREE.Group();
		hand.position.y = -0.26;
		elbow.add(hand);
		box(hand, 0.07, 0.09, 0.04, mat(SKIN, 0.7), 0, -0.04, 0);
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
