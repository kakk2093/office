import * as THREE from 'three';
import { createDogModel, DOG_EYES, type DogModel } from './DogModel.js';
import { PLAYER_NAME, type CameraPose, type Dialogue } from '../core/Interaction.js';

/**
 * Финал: тёмная комната ночью, в ней на лежаке спит цвергпинчер — это ему всё приснилось. Отдельная сцена.
 * Катсцена целиком (управления нет): пёс спит, просыпается — поднимает голову, встаёт, камера перелетает ему в глаза
 * (вид от первого лица — на лунное окно), реплика «Приснится же такое», потом Game гасит экран и пишет «КОНЕЦ».
 */

/** Комната: ширина и глубина (м), высота потолка. Окно — в северной стене (−Z), пёс смотрит на него. */
const ROOM_SIZE = 4;
const ROOM_HEIGHT = 2.4;
const WINDOW = { y: 1.35, width: 0.9, height: 1.1 };
/** Лежак — в центре комнаты: радиус (по X; по Z — уже), высота подушки, толщина бортика. */
const BED_RADIUS = 0.42;
const BED_DEPTH = 0.8;
const CUSHION_HEIGHT = 0.07;
const RIM_TUBE = 0.07;
/** Лёжа тело опущено на столько (м) — ложится на подушку; лапы поджаты (рад), морда на лапах. */
const LYING_DROP = 0.14;
const LYING_LEG = 1.45;
const SLEEP_HEAD = 0.8;

/**
 * Хронометраж (с от прихода): спит до WAKE_AT; поднимает голову за HEAD_LIFT_TIME; с STAND_AT встаёт за STAND_TIME;
 * с FLY_AT камера за FLY_TIME перелетает ему в глаза; в LINE_AT — реплика; после неё — конец (onFinished).
 */
const WAKE_AT = 3.5;
const HEAD_LIFT_TIME = 1;
const STAND_AT = 4.8;
const STAND_TIME = 1.4;
const FLY_AT = 6.6;
const FLY_TIME = 2;
const LINE_AT = FLY_AT + FLY_TIME + 0.6;

/** Камера сбоку-спереди, чуть сверху — смотрит на спящего; пока спит, медленно подъезжает. */
const CAMERA_FROM = new THREE.Vector3(0.85, 0.8, -1.15);
const CAMERA_TO = new THREE.Vector3(0.6, 0.6, -0.85);
const CAMERA_LOOK = new THREE.Vector3(0, 0.15, 0);
/** От первого лица — взгляд вперёд, на окно, чуть вверх. */
const DOG_VIEW_PITCH = 0.25;

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** Дощатый пол: тёмные доски вдоль X с щелями и прожилками. */
function createFloorTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const palette = ['#3a2a20', '#35261c', '#3f2e22', '#302219'];
	for (let row = 0; row < 8; row++) {
		ctx.fillStyle = palette[row % palette.length];
		ctx.fillRect(0, row * 8, size, 8);
		for (let i = 0; i < 20; i++) {
			ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 220, 180, 0.05)';
			ctx.fillRect(Math.floor(Math.random() * size), row * 8 + 1 + Math.floor(Math.random() * 6), 3 + Math.floor(Math.random() * 8), 1);
		}
		ctx.fillStyle = '#1a120d';
		ctx.fillRect(0, row * 8 + 7, size, 1);
		ctx.fillRect(((row * 37) % size) + 0, row * 8, 1, 8);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(3, 3);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export class Bedroom {
	readonly scene = new THREE.Scene();
	/** Катсцена ставит камеру; реплика; всё кончилось (после реплики) — Game гасит экран. */
	onCameraPose: ((pose: CameraPose) => void) | null = null;
	onDialogue: ((dialogue: Dialogue) => void) | null = null;
	onFinished: (() => void) | null = null;
	private readonly dog: DogModel = createDogModel();
	private time = 0;
	private lineSaid = false;

	constructor() {
		this.scene.background = new THREE.Color('#05060a');
		// Ночь: почти темно, холодный лунный свет из окна.
		this.scene.add(new THREE.AmbientLight('#3a4460', 0.5));
		this.scene.add(new THREE.HemisphereLight('#4a5a80', '#1a1410', 0.35));
		const moon = new THREE.DirectionalLight('#9ab4ff', 1.4);
		moon.position.set(-0.6, 2.6, -ROOM_SIZE / 2 - 1.5);
		moon.target.position.set(0.2, 0, 0.3);
		moon.castShadow = true;
		moon.shadow.camera.left = moon.shadow.camera.bottom = -ROOM_SIZE;
		moon.shadow.camera.right = moon.shadow.camera.top = ROOM_SIZE;
		moon.shadow.mapSize.set(1024, 1024);
		this.scene.add(moon, moon.target);

		this._buildRoom();
		this._buildBed();
		this.dog.root.rotation.y = Math.PI;
		this.scene.add(this.dog.root);
		this.start();
	}

	/** С начала: пёс спит, камера — у лежака. */
	start(): void {
		this.time = 0;
		this.lineSaid = false;
		this._poseDog();
	}

	update(dt: number): void {
		this.time += dt;
		this._poseDog();
		this._poseCamera();
		if (!this.lineSaid && this.time >= LINE_AT) {
			this.lineSaid = true;
			this.onDialogue?.({
				lines: [{ speaker: PLAYER_NAME, text: 'Приснится же такое', voice: 'player', autoClose: 1.8 }],
				onEnd: () => this.onFinished?.(),
			});
		}
	}

	/** Поза пса по времени: спит (дышит), поднимает голову, встаёт (сначала передние лапы), виляет хвостом. */
	private _poseDog(): void {
		const t = this.time;
		const { rig, legs, tail, head } = this.dog;
		const lift = ease(clamp01((t - WAKE_AT) / HEAD_LIFT_TIME));
		const front = ease(clamp01((t - STAND_AT) / (STAND_TIME * 0.7)));
		const back = ease(clamp01((t - STAND_AT - STAND_TIME * 0.3) / (STAND_TIME * 0.7)));
		const stand = (front + back) / 2;
		// Во сне дышит глубоко и медленно, проснувшись — чаще.
		const breath = t < WAKE_AT ? Math.sin(t * 1.6) * 0.004 : Math.sin(t * 3) * 0.002;
		rig.position.y = -LYING_DROP * (1 - stand) + breath;
		// Встаёт «с передних лап»: грудь поднимается раньше таза.
		rig.rotation.x = -(front - back) * 0.35;
		for (const leg of legs) {
			const isFront = leg.pivot.position.z > 0;
			leg.pivot.rotation.x = isFront ? -LYING_LEG * (1 - front) : LYING_LEG * (1 - back);
		}
		head.rotation.x = SLEEP_HEAD * (1 - lift) + Math.sin(t * 1.6) * 0.02 * (1 - lift);
		// Хвост: во сне лежит вбок, встал — виляет.
		tail.rotation.y = 1.1 * (1 - stand) + (stand > 0.9 ? Math.sin(t * 14) * 0.45 : 0);
	}

	/** Камера: подъезжает к спящему; потом перелетает в глаза псу и смотрит его взглядом. */
	private _poseCamera(): void {
		const t = this.time;
		const approach = ease(clamp01(t / FLY_AT));
		const side = CAMERA_FROM.clone().lerp(CAMERA_TO, approach);
		const sideYaw = Math.atan2(-(CAMERA_LOOK.x - side.x), -(CAMERA_LOOK.z - side.z));
		const sidePitch = Math.atan2(CAMERA_LOOK.y - side.y, Math.hypot(CAMERA_LOOK.x - side.x, CAMERA_LOOK.z - side.z));

		this.dog.root.updateMatrixWorld(true);
		const eyes = this.dog.head.localToWorld(DOG_EYES.clone());
		// Пёс смотрит на −Z — это yaw 0; поворот к нему — по кратчайшей дуге.
		const eyesYaw = sideYaw + (THREE.MathUtils.euclideanModulo(0 - sideYaw + Math.PI, Math.PI * 2) - Math.PI);

		const fly = ease(clamp01((t - FLY_AT) / FLY_TIME));
		// Перелёт — по дуге: в середине камера чуть выше прямой, чтобы не пройти сквозь голову.
		const pos = side.clone().lerp(eyes, fly);
		pos.y += Math.sin(fly * Math.PI) * 0.25;
		this.onCameraPose?.({
			x: pos.x,
			y: pos.y,
			z: pos.z,
			yaw: sideYaw + (eyesYaw - sideYaw) * fly,
			pitch: sidePitch + (DOG_VIEW_PITCH - sidePitch) * fly,
		});
	}

	/** Пол, стены с окном (в северной), потолок; лунное пятно на полу; комод и миска. */
	private _buildRoom(): void {
		const half = ROOM_SIZE / 2;
		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
			new THREE.MeshStandardMaterial({ map: createFloorTexture(), roughness: 0.9 })
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);

		const wallMaterial = new THREE.MeshStandardMaterial({ color: '#2a2e3a', roughness: 1 });
		const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), wallMaterial);
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.y = ROOM_HEIGHT;
		this.scene.add(ceiling);
		// Южная, восточная, западная — сплошные; северная — из кусков вокруг проёма окна.
		for (const [x, z, rotation] of [
			[0, half, Math.PI],
			[half, 0, -Math.PI / 2],
			[-half, 0, Math.PI / 2],
		] as const) {
			const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), wallMaterial);
			wall.position.set(x, ROOM_HEIGHT / 2, z);
			wall.rotation.y = rotation;
			wall.receiveShadow = true;
			this.scene.add(wall);
		}
		const { y, width, height } = WINDOW;
		const bottom = y - height / 2;
		const top = y + height / 2;
		const sideWidth = (ROOM_SIZE - width) / 2;
		for (const [w, h, x, cy] of [
			[sideWidth, ROOM_HEIGHT, -(width + sideWidth) / 2, ROOM_HEIGHT / 2],
			[sideWidth, ROOM_HEIGHT, (width + sideWidth) / 2, ROOM_HEIGHT / 2],
			[width, bottom, 0, bottom / 2],
			[width, ROOM_HEIGHT - top, 0, (ROOM_HEIGHT + top) / 2],
		] as const) {
			const piece = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMaterial);
			piece.position.set(x, cy, -half);
			piece.receiveShadow = true;
			this.scene.add(piece);
		}
		// Окно: ночное небо с луной за стеклом, тёмная рама с крестовиной.
		const sky = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: '#1c2848' }));
		sky.position.set(0, y, -half - 0.05);
		this.scene.add(sky);
		const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: '#e8eeff' }));
		moonDisc.position.set(-0.22, y + 0.3, -half - 0.04);
		this.scene.add(moonDisc);
		const frameMaterial = new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 1 });
		for (const [w, h, x, fy] of [
			[width + 0.08, 0.06, 0, bottom],
			[width + 0.08, 0.06, 0, top],
			[0.06, height, -width / 2, y],
			[0.06, height, width / 2, y],
			[0.04, height, 0, y],
			[width, 0.04, 0, y],
		] as const) {
			const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMaterial);
			bar.position.set(x, fy, -half);
			bar.castShadow = true;
			this.scene.add(bar);
		}
		// Подоконник.
		const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.04, 0.2), frameMaterial);
		sill.position.set(0, bottom - 0.03, -half + 0.08);
		this.scene.add(sill);

		// Лунное пятно на полу — свет из окна, с тенью крестовины от луны.
		const patch = new THREE.Mesh(
			new THREE.PlaneGeometry(1.1, 1.5),
			new THREE.MeshBasicMaterial({ color: '#2a3558', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
		);
		patch.rotation.x = -Math.PI / 2;
		patch.position.set(0.15, 0.005, -0.7);
		this.scene.add(patch);

		// Комод у восточной стены и миска у лежака.
		const wood = new THREE.MeshStandardMaterial({ color: '#2c1f17', roughness: 0.8, flatShading: true });
		const dresser = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.9), wood);
		dresser.position.set(half - 0.25, 0.4, -0.6);
		dresser.castShadow = dresser.receiveShadow = true;
		this.scene.add(dresser);
		const bowl = new THREE.Mesh(
			new THREE.CylinderGeometry(0.09, 0.07, 0.05, 10),
			new THREE.MeshStandardMaterial({ color: '#6a7078', roughness: 0.4, metalness: 0.6 })
		);
		bowl.position.set(-0.55, 0.025, -0.45);
		bowl.castShadow = true;
		this.scene.add(bowl);
	}

	/** Лежак: овальная подушка с мягким бортиком. */
	private _buildBed(): void {
		const fabric = new THREE.MeshStandardMaterial({ color: '#4a2e3c', roughness: 1, flatShading: true });
		const cushion = new THREE.Mesh(new THREE.CylinderGeometry(BED_RADIUS, BED_RADIUS, CUSHION_HEIGHT, 16), fabric);
		cushion.scale.z = BED_DEPTH;
		cushion.position.y = CUSHION_HEIGHT / 2;
		cushion.receiveShadow = true;
		this.scene.add(cushion);
		const rim = new THREE.Mesh(new THREE.TorusGeometry(BED_RADIUS, RIM_TUBE, 6, 20), fabric);
		rim.rotation.x = -Math.PI / 2;
		rim.scale.y = BED_DEPTH;
		rim.position.y = RIM_TUBE;
		rim.castShadow = rim.receiveShadow = true;
		this.scene.add(rim);
	}
}
