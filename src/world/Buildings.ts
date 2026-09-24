import * as THREE from 'three';

/** Низкополи-здания района вокруг двора: панельные пятиэтажки и столовая «Спутник». */

/** Шаг панели по фасаду и высота этажа — как у типовой хрущёвки. */
const PANEL_STEP = 3.2;
const PANEL_FLOOR = 2.8;
const PANEL_DEPTH = 12;
const PANEL_FLOORS = 5;

type Rand = () => number;

function makeRand(seed: number): Rand {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Фасад панельки: сетка панелей со швами, в каждой — окно; занавески и рамы немного разные, чтобы не было «обоев». */
function createPanelFacadeTexture(cols: number, floors: number, wall: string, rand: Rand, withWindows = true): THREE.CanvasTexture {
	const cw = 16;
	const ch = 14;
	const canvas = document.createElement('canvas');
	canvas.width = cols * cw;
	canvas.height = floors * ch;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = wall;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const glass = ['#3a434a', '#343c42', '#40494f', '#2f363b'];
	const curtains = ['#8a6a4a', '#7a7f86', '#9a8a6a', '#6f5a55', '#a39a86'];
	for (let f = 0; f < floors; f++) {
		for (let c = 0; c < cols; c++) {
			const x = c * cw;
			const y = f * ch;
			// Швы между панелями.
			ctx.fillStyle = 'rgba(0,0,0,0.18)';
			ctx.fillRect(x, y, 1, ch);
			ctx.fillRect(x, y, cw, 1);
			if (!withWindows) continue;
			ctx.fillStyle = '#d9d6ce';
			ctx.fillRect(x + 3, y + 3, 10, 8);
			ctx.fillStyle = glass[Math.floor(rand() * glass.length)];
			ctx.fillRect(x + 4, y + 4, 8, 6);
			if (rand() < 0.45) {
				ctx.fillStyle = curtains[Math.floor(rand() * curtains.length)];
				ctx.fillRect(x + 4, y + 4, rand() < 0.5 ? 3 : 8, 6);
			}
			// Переплёт.
			ctx.fillStyle = '#d9d6ce';
			ctx.fillRect(x + 8, y + 4, 1, 6);
		}
	}
	return pixelTexture(canvas);
}

/**
 * Панельная пятиэтажка. Длина — вдоль X, подъезды — на фасаде +Z. Начало координат — центр основания.
 * sections — число подъездов (двери с козырьками равномерно по фасаду).
 */
export function createPanelBuilding(length: number, sections: number, wall: string, seed: number): THREE.Group {
	const group = new THREE.Group();
	const rand = makeRand(seed);
	const height = PANEL_FLOORS * PANEL_FLOOR;
	const cols = Math.max(1, Math.round(length / PANEL_STEP));
	const endCols = Math.round(PANEL_DEPTH / PANEL_STEP);

	const longMat = () => new THREE.MeshStandardMaterial({ map: createPanelFacadeTexture(cols, PANEL_FLOORS, wall, rand) });
	const endMat = new THREE.MeshStandardMaterial({ map: createPanelFacadeTexture(endCols, PANEL_FLOORS, wall, rand, false) });
	const roofMat = new THREE.MeshStandardMaterial({ color: '#5a5856' });
	// Порядок граней BoxGeometry: +X, −X, +Y, −Y, +Z, −Z.
	const body = new THREE.Mesh(new THREE.BoxGeometry(length, height, PANEL_DEPTH), [
		endMat,
		endMat,
		roofMat,
		roofMat,
		longMat(),
		longMat(),
	]);
	body.position.y = height / 2;
	body.castShadow = body.receiveShadow = true;
	group.add(body);

	// Парапет по краю плоской крыши.
	const parapet = new THREE.Mesh(new THREE.BoxGeometry(length + 0.2, 0.4, PANEL_DEPTH + 0.2), roofMat);
	parapet.position.y = height + 0.1;
	group.add(parapet);

	// Балконы на фасаде с подъездами: не на первом этаже и не над подъездами, часть застеклена.
	const balconyMat = new THREE.MeshStandardMaterial({ color: '#a9a497' });
	const glazedMat = new THREE.MeshStandardMaterial({ color: '#8d9296' });
	const entranceCols = new Set<number>();
	for (let i = 0; i < sections; i++) entranceCols.add(Math.floor(((i + 0.5) / sections) * cols));
	for (let c = 0; c < cols; c++) {
		if (entranceCols.has(c) || c % 2 === 1) continue;
		const glazed = rand() < 0.4;
		for (let f = 1; f < PANEL_FLOORS; f++) {
			const balcony = new THREE.Mesh(
				new THREE.BoxGeometry(PANEL_STEP * 0.8, glazed ? 1.2 : 0.9, 0.9),
				glazed ? glazedMat : balconyMat
			);
			balcony.position.set(-length / 2 + (c + 0.5) * PANEL_STEP, f * PANEL_FLOOR + (glazed ? 0.6 : 0.45), PANEL_DEPTH / 2 + 0.45);
			balcony.castShadow = true;
			group.add(balcony);
		}
	}

	// Подъезды: тёмная дверь, бетонный козырёк, ступенька.
	const doorMat = new THREE.MeshStandardMaterial({ color: '#3d3a36' });
	const concrete = new THREE.MeshStandardMaterial({ color: '#8f8c85' });
	for (const c of entranceCols) {
		const x = -length / 2 + (c + 0.5) * PANEL_STEP;
		const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.08), doorMat);
		door.position.set(x, 1.05, PANEL_DEPTH / 2 + 0.04);
		group.add(door);
		const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 1.3), concrete);
		canopy.position.set(x, 2.5, PANEL_DEPTH / 2 + 0.65);
		canopy.castShadow = true;
		group.add(canopy);
		const step = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 1.0), concrete);
		step.position.set(x, 0.075, PANEL_DEPTH / 2 + 0.5);
		group.add(step);
	}
	return group;
}

export const PANEL_BUILDING_DEPTH = PANEL_DEPTH;

/** Вывеска на прозрачном фоне в две строки — «СТОЛОВАЯ» / «СПУТНИК»: крупно, чтобы читалась в пиксельном рендере. */
const SIGN_W = 160;
const SIGN_H = 44;
function createCanteenSignTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = SIGN_W;
	canvas.height = SIGN_H;
	const ctx = canvas.getContext('2d')!;
	ctx.clearRect(0, 0, SIGN_W, SIGN_H);
	ctx.fillStyle = '#c42d22';
	ctx.font = 'bold 19px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('СТОЛОВАЯ', SIGN_W / 2, 11);
	ctx.fillText('«СПУТНИК»', SIGN_W / 2, 33);
	return pixelTexture(canvas);
}

/** Столовая «Спутник»: белая двухэтажная модернистская коробка, ленточные окна, козырёк над входом,
 * буквы вывески на крыше и спутник-эмблема. Фасад — +Z, ширина вдоль X. Начало координат — центр основания. */
export function createCanteen(): THREE.Group {
	const group = new THREE.Group();
	const width = 22;
	const depth = 12;
	const height = 7.5;
	const front = depth / 2;
	const white = new THREE.MeshStandardMaterial({ color: '#eceae4' });
	const glass = new THREE.MeshStandardMaterial({ color: '#4c5a64', roughness: 0.15, metalness: 0.4 });

	const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), white);
	body.position.y = height / 2;
	body.castShadow = body.receiveShadow = true;
	group.add(body);

	// Карниз-плита по верху — чуть шире коробки.
	const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.35, depth + 0.6), white);
	cornice.position.y = height;
	cornice.castShadow = true;
	group.add(cornice);

	// Ленточное остекление: высокий зал на первом этаже, пониже — на втором; белые вертикальные рёбра поверх.
	for (const [y, h] of [
		[1.9, 2.8],
		[5.2, 1.6],
	] as const) {
		const band = new THREE.Mesh(new THREE.BoxGeometry(width - 1.6, h, 0.06), glass);
		band.position.set(0, y, front + 0.03);
		group.add(band);
	}
	for (let x = -width / 2 + 0.8; x <= width / 2 - 0.8 + 0.01; x += 1.9) {
		const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, height - 1.0, 0.25), white);
		fin.position.set(x, height / 2, front + 0.12);
		fin.castShadow = true;
		group.add(fin);
	}

	// Вход: двери по центру, широкий козырёк на двух тонких столбах, ступени.
	const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.08), new THREE.MeshStandardMaterial({ color: '#2f3336' }));
	door.position.set(0, 1.2, front + 0.3);
	group.add(door);
	const canopy = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 3), white);
	canopy.position.set(0, 3.6, front + 1.5);
	canopy.castShadow = true;
	group.add(canopy);
	for (const x of [-3.1, 3.1]) {
		const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8), white);
		column.position.set(x, 1.8, front + 2.8);
		group.add(column);
	}
	const concrete = new THREE.MeshStandardMaterial({ color: '#b4b1a9' });
	for (const [w, d, y] of [
		[6, 3.4, 0.08],
		[4.5, 2.4, 0.24],
	] as const) {
		const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), concrete);
		step.position.set(0, y, front + d / 2);
		step.receiveShadow = true;
		group.add(step);
	}

	// Буквы вывески на крыше — на тонкой раме.
	const signW = 15;
	const signH = signW * (SIGN_H / SIGN_W);
	const sign = new THREE.Mesh(
		new THREE.PlaneGeometry(signW, signH),
		new THREE.MeshStandardMaterial({
			map: createCanteenSignTexture(),
			transparent: true,
			alphaTest: 0.5,
			side: THREE.DoubleSide,
			emissive: '#7a1a12',
			emissiveIntensity: 0.7,
		})
	);
	sign.position.set(0, height + 0.3 + signH / 2, front - 0.6);
	group.add(sign);
	const frameMat = new THREE.MeshStandardMaterial({ color: '#3b3e3f' });
	for (const x of [-6.5, -2.2, 2.2, 6.5]) {
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), frameMat);
		post.position.set(x, height + 0.35, front - 0.62);
		group.add(post);
	}

	// Спутник-эмблема: шар с четырьмя усами-антеннами на мачте у края крыши.
	const metal = new THREE.MeshStandardMaterial({ color: '#c9ccce', roughness: 0.25, metalness: 0.7 });
	const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), frameMat);
	mast.position.set(width / 2 - 1.5, height + 1.1, front - 1.5);
	group.add(mast);
	const sputnik = new THREE.Group();
	sputnik.position.set(width / 2 - 1.5, height + 2.6, front - 1.5);
	const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), metal);
	sputnik.add(ball);
	for (let i = 0; i < 4; i++) {
		const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), metal);
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		// Усы отведены назад и в стороны, как у ПС-1.
		antenna.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35 - 0.2, -1.0);
		antenna.rotation.set(Math.PI / 2 - Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35);
		sputnik.add(antenna);
	}
	sputnik.rotation.set(-0.3, 0.6, 0);
	group.add(sputnik);
	return group;
}

export const CANTEEN_SIZE = { width: 22, depth: 12 } as const;

/** Разбитый дворовый асфальт без разметки: шум, заплатки ямочного ремонта, трещины. repeat — тайлов по длине. */
export function createYardRoadTexture(repeat: number): THREE.CanvasTexture {
	const w = 64;
	const h = 32;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const rand = makeRand(11);
	const palette = ['#56575a', '#525356', '#5b5c5f', '#4f5053', '#58595b'];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
			ctx.fillRect(x, y, 1, 1);
		}
	}
	// Заплатки — прямоугольники темнее и светлее.
	for (let i = 0; i < 5; i++) {
		ctx.fillStyle = rand() < 0.6 ? '#444548' : '#646466';
		ctx.fillRect(Math.floor(rand() * (w - 12)), Math.floor(rand() * (h - 8)), 4 + Math.floor(rand() * 10), 3 + Math.floor(rand() * 6));
	}
	// Трещины — ломаные в пару пикселей.
	ctx.fillStyle = '#3a3b3d';
	for (let i = 0; i < 4; i++) {
		let x = Math.floor(rand() * w);
		let y = Math.floor(rand() * h);
		for (let k = 0; k < 10; k++) {
			ctx.fillRect(x, y, 1, 1);
			x = (x + (rand() < 0.5 ? 1 : 0) + w) % w;
			y = Math.min(h - 1, Math.max(0, y + Math.floor(rand() * 3) - 1));
		}
	}
	const texture = pixelTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.repeat.set(repeat, 1);
	return texture;
}
