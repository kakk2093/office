import * as THREE from 'three';

const BLACK = 0x161616;
const TAN = 0xb8662b;
const NOSE = 0x0a0a0a;
const EYE = 0x3a1f10;
const MOUTH = 0x3a0808;
const TONGUE = 0x9a2a30;
const TOOTH = 0xe8e0c8;

export interface DogLeg {
	/** Шарнир в бедре: вращение по X качает лапу. */
	pivot: THREE.Group;
	/** Диагональные пары ходят в противофазе: ±1. */
	phaseSign: number;
}

export interface DogModel {
	/** Корень: позиция и поворот (yaw) собаки. */
	root: THREE.Group;
	/** Всё тело; наклоняется отдельно от корня (присед). */
	rig: THREE.Group;
	legs: DogLeg[];
	/** Шарнир хвоста в основании: вращение по Y — виляние. */
	tail: THREE.Group;
	/** Шарнир головы у основания шеи: вращение по X (+) опускает морду. */
	head: THREE.Group;
}

function part(
	parent: THREE.Object3D,
	geometry: THREE.BufferGeometry,
	color: number,
	x: number,
	y: number,
	z: number
): THREE.Mesh {
	const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }));
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	parent.add(mesh);
	return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

const HIP_Y = 0.22;
/** Шарнир головы — у основания шеи (в координатах rig). */
const HEAD_PIVOT = { y: 0.34, z: 0.14 };
/** Глаза собаки (середина между ними) в координатах шарнира головы — для вида от первого лица. */
export const DOG_EYES = new THREE.Vector3(0, 0.515 - HEAD_PIVOT.y, 0.3 - HEAD_PIVOT.z);

/**
 * Low-poly цвергпинчер (чёрный с рыжим). Начало координат — под лапами, морда смотрит в +Z.
 * Высота в холке ≈ 0,3 м (реальный размер собаки).
 */
export function createDogModel(): DogModel {
	const root = new THREE.Group();
	root.name = 'dog';
	const rig = new THREE.Group();
	root.add(rig);

	// Корпус и рыжее пятно на груди.
	part(rig, box(0.15, 0.16, 0.34), BLACK, 0, 0.3, 0);
	part(rig, box(0.155, 0.1, 0.06), TAN, 0, 0.27, 0.15);

	// Шея и голова: всё, что выше шеи, — на шарнире head у её основания (координаты деталей — от шарнира).
	const head = new THREE.Group();
	head.position.set(0, HEAD_PIVOT.y, HEAD_PIVOT.z);
	rig.add(head);
	const inHead = (y: number, z: number) => [y - HEAD_PIVOT.y, z - HEAD_PIVOT.z] as const;
	const neck = part(head, box(0.09, 0.15, 0.09), BLACK, 0, ...inHead(0.4, 0.17));
	neck.rotation.x = 0.55;
	part(head, box(0.11, 0.1, 0.11), BLACK, 0, ...inHead(0.5, 0.23));
	part(head, box(0.065, 0.055, 0.1), TAN, 0, ...inHead(0.475, 0.31));
	part(head, box(0.035, 0.03, 0.03), NOSE, 0, ...inHead(0.49, 0.365));

	const legs: DogLeg[] = [];
	for (const side of [-1, 1]) {
		// Глаза и рыжие «брови».
		part(head, box(0.02, 0.025, 0.02), EYE, side * 0.045, ...inHead(0.515, 0.29));
		part(head, box(0.025, 0.015, 0.025), TAN, side * 0.045, ...inHead(0.545, 0.285));

		// Стоячие треугольные уши.
		const ear = part(head, new THREE.ConeGeometry(0.04, 0.11, 3), BLACK, side * 0.045, ...inHead(0.6, 0.2));
		ear.rotation.z = -side * 0.25;
		ear.rotation.x = -0.1;

		// Лапы: шарнир в бедре, внутри чёрное «бедро» и рыжая голень со ступнёй.
		for (const z of [0.12, -0.12]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * 0.055, HIP_Y, z);
			part(pivot, box(0.045, 0.1, 0.05), BLACK, 0, -0.05, 0);
			part(pivot, box(0.035, 0.12, 0.04), TAN, 0, -0.16, 0);
			rig.add(pivot);
			legs.push({ pivot, phaseSign: Math.sign(side * z) });
		}
	}

	// Хвост: шарнир в основании, конус задран вверх и назад.
	const tail = new THREE.Group();
	tail.position.set(0, 0.37, -0.17);
	const tailGeo = new THREE.ConeGeometry(0.02, 0.16, 4);
	tailGeo.translate(0, 0.08, 0);
	const tailMesh = part(tail, tailGeo, BLACK, 0, 0, 0);
	tailMesh.rotation.x = -0.9;
	rig.add(tail);

	return { root, rig, legs, tail, head };
}

export interface DogHead {
	/** Корень: центр черепа, морда смотрит в +Z. */
	root: THREE.Group;
	/** Глаза — чтобы перекрасить (у босса — горят красным). */
	eyes: THREE.Mesh[];
	/** Шарнир нижней челюсти в углу пасти: вращение по X (+) открывает пасть. */
	jaw: THREE.Group;
}

/**
 * Одна голова того же цвергпинчера (для босса): те же детали, что в createDogModel, но относительно центра черепа.
 * Вместо короткой наклонной шеи — прямая шея вниз длиной neckLength (голова «вырастает» из-под земли).
 */
export function createDogHead(neckLength: number): DogHead {
	const root = new THREE.Group();
	root.name = 'dogHead';

	part(root, box(0.11, 0.1, 0.11), BLACK, 0, 0, 0);
	// Верхняя часть морды (ниже — челюсть), снизу — тёмное нёбо, видно в открытой пасти.
	part(root, box(0.065, 0.035, 0.1), TAN, 0, -0.015, 0.08);
	part(root, box(0.055, 0.004, 0.09), MOUTH, 0, -0.0335, 0.08);
	part(root, box(0.035, 0.03, 0.03), NOSE, 0, -0.005, 0.135);
	// Глотка — тёмная стенка в глубине пасти.
	part(root, box(0.05, 0.03, 0.01), MOUTH, 0, -0.045, 0.035);

	// Нижняя челюсть: шарнир в углу пасти; сверху — язык.
	const jaw = new THREE.Group();
	jaw.position.set(0, -0.035, 0.035);
	part(jaw, box(0.058, 0.02, 0.095), TAN, 0, -0.01, 0.047);
	part(jaw, box(0.038, 0.006, 0.075), TONGUE, 0, 0.002, 0.04);
	root.add(jaw);
	// Клыки: верхние смотрят вниз, нижние — вверх (на челюсти, двигаются с ней).
	for (const side of [-1, 1]) {
		const upper = part(root, new THREE.ConeGeometry(0.006, 0.02, 4), TOOTH, side * 0.024, -0.043, 0.118);
		upper.rotation.x = Math.PI;
		part(jaw, new THREE.ConeGeometry(0.005, 0.016, 4), TOOTH, side * 0.02, 0.008, 0.078);
	}
	part(root, box(0.09, neckLength, 0.09), BLACK, 0, -0.03 - neckLength / 2, -0.03);

	const eyes: THREE.Mesh[] = [];
	for (const side of [-1, 1]) {
		eyes.push(part(root, box(0.02, 0.025, 0.02), EYE, side * 0.045, 0.015, 0.06));
		part(root, box(0.025, 0.015, 0.025), TAN, side * 0.045, 0.045, 0.055);
		const ear = part(root, new THREE.ConeGeometry(0.04, 0.11, 3), BLACK, side * 0.045, 0.1, -0.03);
		ear.rotation.z = -side * 0.25;
		ear.rotation.x = -0.1;
	}
	return { root, eyes, jaw };
}
