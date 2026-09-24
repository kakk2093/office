import * as THREE from 'three';

/**
 * Обрез двустволки (горизонталка, курковая) — низкополи, как и вся сцена. Ствол смотрит на −Z, верх — +Y.
 * Начало координат — на оси шарнира (под казённой частью стволов): вокруг неё стволы «переламываются» вниз.
 * Размеры — в метрах, под вид от первого лица: ствол около 30 см, всего около 47 см от дульного среза до рукояти.
 */

/** Ось стволов относительно шарнира: чуть выше и по бокам от центра. */
const BARREL_Y = 0.045;
const BARREL_X = 0.031;
/** Стволы толстостенные — канал (патронник, дульный срез) того же калибра, что патрон, а снаружи заметно толще. */
const BARREL_RADIUS = 0.03;
const BARREL_LENGTH = 0.3;
/** Колодка (ствольная коробка) — от шарнира назад. */
const RECEIVER_LENGTH = 0.1;
/** На сколько переламываются стволы, рад (дулом вниз). */
const OPEN_ANGLE = 0.75;

/** Перезарядка, с: наклонить → переломить → выкинуть гильзы → вставить патроны по одному → защёлкнуть → вернуть. */
const OPEN_START = 0.1;
const OPEN_END = 0.35;
const EJECT_END = 0.75;
const INSERT_START = 0.8;
const INSERT_STAGGER = 0.17;
const INSERT_TIME = 0.25;
const CLOSE_START = 1.35;
const CLOSE_END = 1.47;
const TILT_END = 0.3;
const RELOAD_TIME = 1.75;
/** Выстрел, с: отдача (резкий толчок и возврат), вспышка на дульном срезе; после отдачи сразу перезарядка. */
const KICK_UP = 0.03;
const FIRE_TIME = 0.4;
const FLASH_TIME = 0.06;
/** Яркость вспышки подсвечивает всё вокруг (свет всегда в сцене, гасим яркостью — без перекомпиляции шейдеров). */
const FLASH_LIGHT = 6;

/** Звуки обреза — по ним Game играет процедурные эффекты. */
export type ShotgunSound = 'shot' | 'open' | 'eject' | 'insert' | 'close';

/** 0 до a, 1 после b, между — плавно. */
function ease(t: number, a: number, b: number): number {
	const k = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
	return k * k * (3 - 2 * k);
}

/** Патрон 12 калибра: латунная головка с закраиной и красная пластиковая гильза. Начало — на срезе патронника:
 * закраина чуть выступает назад (+Z), гильза уходит в −Z. */
function createShell(brass: THREE.Material, hull: THREE.Material): THREE.Group {
	const shell = new THREE.Group();
	const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.004, 10), brass);
	rim.rotation.x = Math.PI / 2;
	rim.position.z = 0.001;
	const head = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 10), brass);
	head.rotation.x = Math.PI / 2;
	head.position.z = -0.008;
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.05, 10), hull);
	body.rotation.x = Math.PI / 2;
	body.position.z = -0.04;
	// Капсюль — кружок в центре донца: видно, что это патрон, когда стволы переломлены.
	const primer = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), new THREE.MeshStandardMaterial({ color: '#8a7a55' }));
	primer.position.z = 0.0035;
	shell.add(rim, head, body, primer);
	return shell;
}

/** Обрез: модель, выстрел дуплетом (оба ствола разом) и перезарядка переломом стволов сразу после него.
 * Позу в руках задаёт снаружи group. */
export class SawedOff {
	/** Внешняя группа — её ставят в руки (позиция/поворот в координатах камеры или сцены). */
	readonly group = new THREE.Group();
	/** Внутренняя — наклон всего обреза на время перезарядки (казёнником к себе). */
	private readonly body = new THREE.Group();
	/** Стволы с цевьём и патронами — поворачиваются вокруг шарнира. */
	private readonly barrels = new THREE.Group();
	/** Рычаг запирания сверху колодки — отводится вбок, когда стволы открыты. */
	private readonly lever = new THREE.Group();
	private readonly shells: THREE.Group[] = [];
	/** Время с начала перезарядки, с; null — не идёт. */
	private reloadT: number | null = null;
	/** Время с выстрела, с; null — отдачи нет. */
	private fireT: number | null = null;
	/** Вспышки на дульных срезах и свет от них. */
	private readonly flashes: THREE.Group[] = [];
	private readonly flashLight = new THREE.PointLight('#ffb35c', 0, 7, 2);
	/** Звук в нужный момент анимации (выстрел, щелчок рычага, выброс гильз, досыл патрона, защёлкивание). */
	onSound: ((sound: ShotgunSound) => void) | null = null;

	constructor() {
		const steel = new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.6, roughness: 0.45 });
		const receiverSteel = new THREE.MeshStandardMaterial({ color: '#5d5f63', metalness: 0.7, roughness: 0.35 });
		const wood = new THREE.MeshStandardMaterial({ color: '#6b3f22', roughness: 0.75 });
		const bore = new THREE.MeshBasicMaterial({ color: '#050505' });
		const brass = new THREE.MeshStandardMaterial({ color: '#c09a45', metalness: 0.7, roughness: 0.35 });
		const hull = new THREE.MeshStandardMaterial({ color: '#9c2a22', roughness: 0.6 });

		this.group.add(this.body);
		this.body.add(this.barrels);
		this._buildBarrels(steel, wood, bore);
		this._buildReceiver(steel, receiverSteel, wood);

		for (const side of [-1, 1]) {
			const shell = createShell(brass, hull);
			shell.position.set(side * BARREL_X, BARREL_Y, 0);
			this.barrels.add(shell);
			this.shells.push(shell);
		}

		this.group.traverse((o) => {
			if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
		});
		this._buildFlashes();
	}

	/** Идёт выстрел или перезарядка — стрелять/перезаряжать заново нельзя. */
	get busy(): boolean {
		return this.reloadT !== null || this.fireT !== null;
	}

	/** Дульный срез (между стволами) в мировых координатах — откуда вылетает дробь. */
	muzzle(target: THREE.Vector3): THREE.Vector3 {
		this.barrels.updateWorldMatrix(true, false);
		return this.barrels.localToWorld(target.set(0, BARREL_Y, -BARREL_LENGTH));
	}

	/** Дуплет: оба ствола разом, после отдачи — сразу перезарядка. false — сейчас нельзя. */
	fire(): boolean {
		if (this.busy) return false;
		this.fireT = 0;
		for (const flash of this.flashes) {
			flash.visible = true;
			flash.rotation.z = Math.random() * Math.PI;
			flash.scale.setScalar(0.8 + Math.random() * 0.5);
		}
		this.onSound?.('shot');
		return true;
	}

	/** Начать перезарядку; false — уже идёт. */
	reload(): boolean {
		if (this.reloadT !== null) return false;
		this.reloadT = 0;
		return true;
	}

	update(dt: number): void {
		if (this.fireT !== null) {
			this.fireT += dt;
			this._firePose(this.fireT);
			if (this.fireT >= FIRE_TIME) {
				this.fireT = null;
				this._firePose(FIRE_TIME);
				this.reload();
			}
			return;
		}
		if (this.reloadT === null) return;
		const prev = this.reloadT;
		this.reloadT += dt;
		this._reloadSounds(prev, this.reloadT);
		if (this.reloadT >= RELOAD_TIME) {
			this.reloadT = null;
			this._pose(RELOAD_TIME);
			return;
		}
		this._pose(this.reloadT);
	}

	/** Отдача: обрез резко уходит назад и дулом вверх, потом плавно возвращается; вспышка — первые мгновения. */
	private _firePose(t: number): void {
		const kick = t < KICK_UP ? t / KICK_UP : 1 - ease(t, KICK_UP, FIRE_TIME);
		this.body.rotation.set(0.3 * kick, 0, 0);
		this.body.position.set(0, 0.02 * kick, 0.09 * kick);
		const flashOn = t < FLASH_TIME;
		for (const flash of this.flashes) flash.visible = flashOn;
		this.flashLight.intensity = flashOn ? FLASH_LIGHT * (1 - t / FLASH_TIME) : 0;
	}

	/** Звуки перезарядки — в момент, когда t проходит через метку. */
	private _reloadSounds(prev: number, t: number): void {
		const at = (mark: number) => prev < mark && t >= mark;
		if (at(OPEN_START)) this.onSound?.('open');
		if (at(OPEN_END)) this.onSound?.('eject');
		for (let i = 0; i < this.shells.length; i++) {
			if (at(INSERT_START + i * INSERT_STAGGER + INSERT_TIME)) this.onSound?.('insert');
		}
		if (at(CLOSE_END)) this.onSound?.('close');
	}

	/** Вспышки на дульных срезах: конус пламени вперёд и шестиконечная «звезда» поперёк; не освещаются и без тумана. */
	private _buildFlashes(): void {
		const fire = new THREE.MeshBasicMaterial({
			color: '#ffc466',
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			fog: false,
		});
		const core = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, depthWrite: false, fog: false });
		for (const side of [-1, 1]) {
			const flash = new THREE.Group();
			const cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), fire);
			cone.rotation.x = -Math.PI / 2;
			cone.position.z = -0.08;
			const star = new THREE.Mesh(new THREE.CircleGeometry(0.075, 6), fire);
			const center = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), core);
			center.position.z = 0.001;
			flash.add(cone, star, center);
			flash.position.set(side * BARREL_X, BARREL_Y, -BARREL_LENGTH - 0.01);
			flash.visible = false;
			this.barrels.add(flash);
			this.flashes.push(flash);
		}
		this.flashLight.position.set(0, BARREL_Y, -BARREL_LENGTH - 0.1);
		this.barrels.add(this.flashLight);
	}

	/** Поза на момент t перезарядки — целиком из t, без накопления. */
	private _pose(t: number): void {
		const closing = t >= CLOSE_START;
		// Защёлкивается быстрее, чем открывается, — резким движением.
		const open = closing ? 1 - ease(t, CLOSE_START, CLOSE_END) : ease(t, OPEN_START, OPEN_END);
		const tilt = closing ? 1 - ease(t, CLOSE_START, RELOAD_TIME) : ease(t, 0, TILT_END);
		this.barrels.rotation.x = -OPEN_ANGLE * open;
		this.lever.rotation.y = 0.6 * Math.min(1, open * 3);
		// Казёнником к себе: приподнять дуло и завалить набок, сдвинуть к центру экрана.
		this.body.rotation.set(0.35 * tilt, 0, 0.45 * tilt);
		this.body.position.set(-0.05 * tilt, 0.03 * tilt, 0.04 * tilt);

		this.shells.forEach((shell, i) => {
			const home = { x: (i === 0 ? -1 : 1) * BARREL_X, y: BARREL_Y, z: 0 };
			shell.visible = true;
			shell.rotation.set(0, 0, 0);
			if (t >= OPEN_END && t < EJECT_END) {
				// Стреляные гильзы выбрасывает назад вдоль стволов, дальше они кувыркаются и падают.
				const k = (t - OPEN_END) / (EJECT_END - OPEN_END);
				shell.position.set(home.x + (i === 0 ? -0.05 : 0.05) * k, home.y + 0.25 * k - 0.6 * k * k, home.z + 0.35 * k);
				shell.rotation.set(k * 7, 0, (i === 0 ? -1 : 1) * k * 3);
				return;
			}
			const insertStart = INSERT_START + i * INSERT_STAGGER;
			if (t >= EJECT_END && t < insertStart) {
				shell.visible = false;
				return;
			}
			if (t >= insertStart && t < insertStart + INSERT_TIME) {
				// Новый патрон подносят сзади-сверху и досылают в патронник.
				const k = ease(t, insertStart, insertStart + INSERT_TIME);
				shell.position.set(home.x, home.y + 0.04 * (1 - k), home.z + 0.12 * (1 - k));
				shell.rotation.x = 0.4 * (1 - k);
				return;
			}
			shell.position.set(home.x, home.y, home.z);
		});
	}

	/** Два ствола с планкой и мушкой, подствольный крюк, цевьё; чернота каналов на дульном срезе и в патронниках. */
	private _buildBarrels(steel: THREE.Material, wood: THREE.Material, bore: THREE.Material): void {
		for (const side of [-1, 1]) {
			const barrel = new THREE.Mesh(new THREE.CylinderGeometry(BARREL_RADIUS, BARREL_RADIUS, BARREL_LENGTH, 8), steel);
			barrel.rotation.x = Math.PI / 2;
			barrel.position.set(side * BARREL_X, BARREL_Y, -BARREL_LENGTH / 2);
			this.barrels.add(barrel);
			// Каналы стволов: спереди — чёрный круг на срезе, сзади — в патроннике (видно, когда патронов нет).
			const muzzle = new THREE.Mesh(new THREE.CircleGeometry(0.0165, 8), bore);
			muzzle.rotation.y = Math.PI;
			muzzle.position.set(side * BARREL_X, BARREL_Y, -BARREL_LENGTH - 0.0005);
			const chamber = new THREE.Mesh(new THREE.CircleGeometry(0.0165, 8), bore);
			chamber.position.set(side * BARREL_X, BARREL_Y, 0.0005);
			this.barrels.add(muzzle, chamber);
		}
		// Прицельная планка между стволами и мушка на конце.
		const rib = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, BARREL_LENGTH), steel);
		rib.position.set(0, BARREL_Y + BARREL_RADIUS - 0.002, -BARREL_LENGTH / 2);
		const bead = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.004), new THREE.MeshStandardMaterial({ color: '#d8d2c0' }));
		bead.position.set(0, BARREL_Y + BARREL_RADIUS + 0.004, -BARREL_LENGTH + 0.006);
		// Подствольный крюк — им стволы держатся на оси шарнира.
		const lump = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.034, 0.07), steel);
		lump.position.set(0, 0.01, -0.035);
		// Цевьё под стволами, обрезанное вместе с ними — короткое.
		const forend = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.13), wood);
		forend.position.set(0, 0.006, -0.14);
		const forendTip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), wood);
		forendTip.position.set(0, 0.004, -0.215);
		this.barrels.add(rib, bead, lump, forend, forendTip);
	}

	/** Колодка с осью шарнира, рычаг, курки, спусковая скоба с двумя крючками и обрезанная пистолетная рукоять. */
	private _buildReceiver(steel: THREE.Material, receiverSteel: THREE.Material, wood: THREE.Material): void {
		const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, RECEIVER_LENGTH), receiverSteel);
		receiver.position.set(0, 0.03, RECEIVER_LENGTH / 2);
		const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.086, 8), steel);
		pin.rotation.z = Math.PI / 2;
		// Щиток за колодкой — переход к шейке ложи.
		const tang = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 0.03), receiverSteel);
		tang.position.set(0, 0.034, RECEIVER_LENGTH + 0.015);
		// Казённый щиток спереди колодки — во всю ширину стволов (колодка за ним уже), с уступом-переходом к ней:
		// закрывает торцы стволов, когда они сомкнуты.
		const breechHalf = BARREL_X + BARREL_RADIUS + 0.003;
		const breech = new THREE.Mesh(new THREE.BoxGeometry(breechHalf * 2, BARREL_RADIUS * 2 + 0.01, 0.025), receiverSteel);
		breech.position.set(0, BARREL_Y, 0.0125);
		const shoulder = new THREE.Mesh(new THREE.BoxGeometry(breechHalf * 2 - 0.022, BARREL_RADIUS * 2, 0.02), receiverSteel);
		shoulder.position.set(0, BARREL_Y - 0.002, 0.035);
		this.body.add(receiver, pin, tang, breech, shoulder);

		// Рычаг запирания: начало — на его оси, поворачивается вбок вокруг Y.
		const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.045), steel);
		leverArm.position.set(0.004, 0, 0.018);
		this.lever.add(leverArm);
		this.lever.position.set(0, 0.079, RECEIVER_LENGTH - 0.03);
		this.body.add(this.lever);

		// Курки по бокам сзади колодки, взведены — наклонены назад.
		for (const side of [-1, 1]) {
			const hammer = new THREE.Group();
			const neck = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.012), steel);
			neck.position.y = 0.02;
			const spur = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.02), steel);
			spur.position.set(0, 0.04, 0.008);
			hammer.add(neck, spur);
			hammer.position.set(side * 0.028, 0.055, RECEIVER_LENGTH - 0.005);
			hammer.rotation.x = 0.55;
			this.body.add(hammer);
		}

		// Спусковая скоба и два крючка — под колодкой.
		const guardY = -0.045;
		const guardBottom = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.07), steel);
		guardBottom.position.set(0, guardY, 0.065);
		const guardFront = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), steel);
		guardFront.position.set(0, guardY + 0.015, 0.03);
		const guardBack = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), steel);
		guardBack.position.set(0, guardY + 0.015, 0.1);
		this.body.add(guardBottom, guardFront, guardBack);
		for (const z of [0.055, 0.075]) {
			const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.025, 0.006), steel);
			trigger.position.set(0, -0.027, z);
			trigger.rotation.x = -0.25;
			this.body.add(trigger);
		}

		// Ложа отпилена: осталась шейка и пистолетная рукоять, наклонённая назад, с металлическим затыльником.
		const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.06), wood);
		wrist.position.set(0, 0.022, RECEIVER_LENGTH + 0.055);
		const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), wood);
		grip.position.set(0, -0.035, RECEIVER_LENGTH + 0.085);
		grip.rotation.x = -0.35;
		const cap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.008, 0.052), steel);
		cap.position.set(0, -0.092, RECEIVER_LENGTH + 0.106);
		cap.rotation.x = -0.35;
		this.body.add(wrist, grip, cap);
	}
}
