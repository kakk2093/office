import * as THREE from 'three';

/** Минимальные низкополигональные блоки офиса: стол, монитор, стул. */

export function createDesk(length: number, width = 0.7): THREE.Group {
	const group = new THREE.Group();
	const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, length), new THREE.MeshStandardMaterial({ color: '#d9d4c8' }));
	top.position.y = 0.74;
	top.castShadow = top.receiveShadow = true;
	group.add(top);

	const legMat = new THREE.MeshStandardMaterial({ color: '#181818' });
	const legX = width / 2 - 0.05;
	for (const lx of [-legX, legX]) {
		for (const lz of [-length / 2 + 0.15, length / 2 - 0.15]) {
			const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.73, 0.04), legMat);
			leg.position.set(lx, 0.365, lz);
			group.add(leg);
		}
	}
	return group;
}

export function createChair(): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: '#26262a' });
	const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.4), mat);
	seat.position.y = 0.46;
	seat.castShadow = seat.receiveShadow = true;
	group.add(seat);
	const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.06), mat);
	back.position.set(0, 0.7, -0.18);
	group.add(back);
	const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.16, 0.43, 6), new THREE.MeshStandardMaterial({ color: '#111' }));
	leg.position.y = 0.22;
	group.add(leg);
	return group;
}

/**
 * Вид из окна первого этажа: горизонт на уровне глаз, внизу газон, забор, дорога с припаркованной машиной;
 * соседние панельки стоят на земле и уходят за верх рамы, неба немного. Рядом дерево, на стекле капли.
 */
function createWindowViewTexture(seed: number): THREE.CanvasTexture {
	const w = 72;
	const h = 56;
	const horizon = 30;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	let s = seed * 131 + 7;
	const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;

	const sky = ctx.createLinearGradient(0, 0, 0, horizon);
	sky.addColorStop(0, '#9a9ea1');
	sky.addColorStop(1, '#aaa9a3');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, horizon);

	// Дома: дальний ряд бледнее (дымка), ближний — темнее и выше, уходит за верх рамы.
	for (const [minH, maxH, color, win] of [
		[14, 20, '#7c7d7a', '#686a6b'],
		[24, 40, '#5c5d5b', '#3c4246'],
	] as const) {
		let x = -Math.floor(rand() * 12);
		while (x < w) {
			const bw = 16 + Math.floor(rand() * 18);
			const top = horizon - (minH + Math.floor(rand() * (maxH - minH)));
			ctx.fillStyle = color;
			ctx.fillRect(x, top, bw, horizon - top);
			for (let wy = top + 2; wy < horizon - 2; wy += 4) {
				for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
					ctx.fillStyle = rand() < 0.12 ? '#8a7a5a' : win;
					ctx.fillRect(wx, wy, 2, 2);
				}
			}
			x += bw + 3 + Math.floor(rand() * 8);
		}
	}

	// Земля: дальний газон, дорога с бордюрами, ближний газон двора.
	ctx.fillStyle = '#5f6038';
	ctx.fillRect(0, horizon, w, 3);
	ctx.fillStyle = '#8a8880';
	ctx.fillRect(0, horizon + 3, w, 1);
	ctx.fillStyle = '#48494c';
	ctx.fillRect(0, horizon + 4, w, 7);
	ctx.fillStyle = '#8a8880';
	ctx.fillRect(0, horizon + 11, w, 1);
	for (let y = horizon + 12; y < h; y++) {
		for (let x = 0; x < w; x += 2) {
			ctx.fillStyle = rand() < 0.5 ? '#5d5e36' : '#66653b';
			ctx.fillRect(x, y, 2, 1);
		}
	}
	// Лужа на дороге.
	ctx.fillStyle = '#5e6266';
	ctx.fillRect(40, horizon + 8, 9, 2);

	// Машина у обочины.
	const carX = 6 + Math.floor(rand() * 20);
	ctx.fillStyle = rand() < 0.5 ? '#6a2a25' : '#3d5566';
	ctx.fillRect(carX, horizon + 3, 14, 4);
	ctx.fillRect(carX + 3, horizon + 1, 7, 2);
	ctx.fillStyle = '#2a2f33';
	ctx.fillRect(carX + 4, horizon + 1, 5, 1);
	ctx.fillStyle = '#161616';
	ctx.fillRect(carX + 2, horizon + 7, 2, 1);
	ctx.fillRect(carX + 10, horizon + 7, 2, 1);

	// Забор двора — тёмные прутья поверх дороги.
	ctx.fillStyle = '#26272a';
	ctx.fillRect(0, horizon + 5, w, 1);
	ctx.fillRect(0, horizon + 13, w, 1);
	for (let x = 1; x < w; x += 3) ctx.fillRect(x, horizon + 4, 1, 11);

	// Дерево рядом с окном: ствол от земли, крона закрывает часть домов.
	const tx = w - 14 - Math.floor(rand() * 10);
	ctx.fillStyle = '#3b2f22';
	ctx.fillRect(tx, 12, 3, h - 12 - 4);
	ctx.fillRect(tx - 3, 18, 3, 1);
	ctx.fillRect(tx + 3, 15, 3, 1);
	for (let i = 0; i < 40; i++) {
		ctx.fillStyle = ['#5e4a2c', '#6f5a34', '#54462a'][i % 3];
		ctx.fillRect(tx - 10 + Math.floor(rand() * 22), 2 + Math.floor(rand() * 16), 3, 3);
	}

	// Капли и дорожки дождя на стекле.
	ctx.fillStyle = 'rgba(230,234,236,0.35)';
	for (let i = 0; i < 22; i++) {
		ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1 + Math.floor(rand() * 4));
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Потолок «Армстронг»: квадратные плиты 60 × 60 см с мелкой перфорацией в металлической решётке. Один тайл — одна плита. */
export function createCeilingTileTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
	const size = 24;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#efeee9';
	ctx.fillRect(0, 0, size, size);
	let s = 5;
	const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
	ctx.fillStyle = '#d9d7d0';
	for (let i = 0; i < 40; i++) ctx.fillRect(1 + Math.floor(rand() * (size - 2)), 1 + Math.floor(rand() * (size - 2)), 1, 1);
	// Профиль решётки по краю плиты.
	ctx.fillStyle = '#c2c0b8';
	ctx.fillRect(0, 0, size, 1);
	ctx.fillRect(0, 0, 1, size);
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export interface WindowOptions {
	/** Жалюзи, опущенные на долю высоты (0 — поднятые, не видны). */
	blinds?: number;
	/** Цветок в горшке на подоконнике. */
	plant?: boolean;
	seed?: number;
}

/**
 * Пластиковое окно на внутренней стороне стены: вид наружу в стекле, белая рама на две створки (одна с ручкой),
 * подоконник, под ним батарея; по желанию — жалюзи и цветок. Лицом к +Z, начало координат — центр стекла на стене.
 */
export function createWindow(width: number, height: number, options: WindowOptions = {}): THREE.Group {
	const group = new THREE.Group();
	const { blinds = 0, plant = false, seed = 1 } = options;
	const white = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.4 });
	const part = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = white) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		group.add(mesh);
		return mesh;
	};

	const view = createWindowViewTexture(seed);
	const glass = new THREE.Mesh(
		new THREE.PlaneGeometry(width, height),
		new THREE.MeshStandardMaterial({ map: view, emissive: '#ffffff', emissiveMap: view, emissiveIntensity: 0.85, roughness: 0.1 })
	);
	glass.position.z = 0.005;
	group.add(glass);

	// Откосы — светлая рамка-ниша вокруг проёма, затем рама и импост между створками.
	const f = 0.07;
	part(width + 0.2, 0.1, 0.12, 0, height / 2 + 0.05, 0.06);
	part(0.1, height + 0.2, 0.12, -width / 2 - 0.05, 0, 0.06);
	part(0.1, height + 0.2, 0.12, width / 2 + 0.05, 0, 0.06);
	part(width, f, 0.07, 0, height / 2 - f / 2, 0.035);
	part(width, f, 0.07, 0, -height / 2 + f / 2, 0.035);
	part(f, height, 0.07, -width / 2 + f / 2, 0, 0.035);
	part(f, height, 0.07, width / 2 - f / 2, 0, 0.035);
	part(f, height, 0.08, 0, 0, 0.04);
	// Рамка открывающейся створки (правой) и ручка на ней.
	const sashW = width / 2 - f;
	const sashX = width / 4;
	part(sashW, 0.035, 0.03, sashX, height / 2 - f - 0.018, 0.075);
	part(sashW, 0.035, 0.03, sashX, -height / 2 + f + 0.018, 0.075);
	part(0.035, height - f * 2, 0.03, sashX - sashW / 2 + 0.018, 0, 0.075);
	part(0.035, height - f * 2, 0.03, sashX + sashW / 2 - 0.018, 0, 0.075);
	part(0.025, 0.12, 0.04, sashX - sashW / 2 + 0.05, 0, 0.1);

	// Подоконник.
	const sillY = -height / 2 - 0.12;
	part(width + 0.3, 0.04, 0.28, 0, sillY + 0.1, 0.14);

	// Батарея: ряд чугунных секций, трубы к стене.
	const radiatorMat = new THREE.MeshStandardMaterial({ color: '#e4e2dc', roughness: 0.6 });
	const sections = 12;
	const secW = 0.085;
	const radH = 0.5;
	const radY = sillY - 0.12 - radH / 2;
	for (let i = 0; i < sections; i++) {
		part(secW - 0.012, radH, 0.08, (i - (sections - 1) / 2) * secW, radY, 0.09, radiatorMat);
	}
	for (const y of [radY + radH / 2 - 0.05, radY - radH / 2 + 0.05]) {
		const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, sections * secW + 0.2, 6), radiatorMat);
		pipe.rotation.z = Math.PI / 2;
		pipe.position.set(0, y, 0.09);
		group.add(pipe);
	}

	// Жалюзи: ламели сверху вниз на заданную долю высоты, нижняя планка и шнур.
	if (blinds > 0) {
		const slatMat = new THREE.MeshStandardMaterial({ color: '#dcdad3', side: THREE.DoubleSide });
		const top = height / 2 - f;
		const bottom = top - (height - f * 2) * blinds;
		part(width + 0.06, 0.05, 0.05, 0, height / 2 + 0.02, 0.13, white);
		for (let y = top - 0.03; y > bottom; y -= 0.035) {
			const slat = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.004, 0.04), slatMat);
			slat.position.set(0, y, 0.13);
			slat.rotation.x = 0.5;
			group.add(slat);
		}
		part(width - 0.02, 0.02, 0.045, 0, bottom, 0.13, white);
		part(0.006, height * 0.7, 0.006, width / 2 - 0.08, height / 2 - height * 0.35, 0.16, new THREE.MeshStandardMaterial({ color: '#cfccc4' }));
	}

	// Цветок: горшок и пышный куст из многогранников.
	if (plant) {
		const px = -width / 4;
		const potY = sillY + 0.12;
		const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#b5653a' }));
		pot.position.set(px, potY + 0.08, 0.15);
		pot.castShadow = true;
		group.add(pot);
		const leaves = new THREE.MeshStandardMaterial({ color: '#4f7a3a', flatShading: true });
		for (const [lx, ly, lz, r] of [
			[0, 0.26, 0, 0.13],
			[0.08, 0.22, 0.03, 0.09],
			[-0.08, 0.24, -0.02, 0.1],
			[0.02, 0.36, 0, 0.08],
		] as const) {
			const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaves);
			leaf.position.set(px + lx, potY + ly, 0.15 + lz);
			leaf.castShadow = true;
			group.add(leaf);
		}
	}
	return group;
}

/** Дверь: полотно + ручка. Начало координат группы — на петле (край полотна), не в центре —
 * так группу можно крутить на месте для анимации открытия. */
export function createDoor(width = 1.0, height = 2.1): THREE.Group {
	const group = new THREE.Group();
	const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.06), new THREE.MeshStandardMaterial({ color: '#5a4632' }));
	slab.position.set(width / 2, height / 2, 0);
	slab.castShadow = true;
	group.add(slab);

	const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#d8d2c4' }));
	handle.position.set(width - 0.1, height / 2, 0.06);
	group.add(handle);
	return group;
}

export function createAcUnit(): THREE.Mesh {
	const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: '#f4f4f2' }));
	ac.castShadow = true;
	return ac;
}

/** Диагональные полосы на стене-акценте + табличка со студийным логотипом (пиксельная текстура, NearestFilter). */
export function createMuralTexture(): THREE.CanvasTexture {
	const w = 256;
	const h = 96;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#f2efe6';
	ctx.fillRect(0, 0, w, h);

	ctx.save();
	ctx.translate(w / 2, h / 2);
	ctx.rotate(-Math.PI / 6);
	ctx.translate(-w, -h);
	const colors = ['#7dc242', '#f4d94a', '#f2a33c'];
	const stripe = 16;
	const gap = 22;
	const period = stripe + gap;
	const span = (w + h) * 3;
	let i = 0;
	for (let x = -span / 2; x < span; x += period, i++) {
		ctx.fillStyle = colors[i % colors.length];
		ctx.fillRect(x, -span / 2, stripe, span * 2);
	}
	ctx.restore();

	// Табличка со студийным логотипом поверх полос.
	const boxW = 150;
	const boxH = 60;
	const boxX = w - boxW - 14;
	const boxY = h / 2 - boxH / 2;
	ctx.fillStyle = '#f2efe6';
	ctx.fillRect(boxX, boxY, boxW, boxH);
	ctx.lineWidth = 5;
	ctx.strokeStyle = '#141414';
	ctx.strokeRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4);

	ctx.fillStyle = '#141414';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = 'bold 30px "Courier New", monospace';
	ctx.fillText('BLACK', boxX + boxW / 2, boxY + 22);
	ctx.font = 'bold 16px "Courier New", monospace';
	ctx.fillText('GAMES', boxX + boxW / 2, boxY + 46);

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Навесная аптечка: белый шкафчик с красным крестом на дверце и ручкой. Перёд — +Z, начало координат — центр задней стенки. */
export function createFirstAidCabinet(): THREE.Group {
	const group = new THREE.Group();
	const w = 0.5;
	const h = 0.6;
	const d = 0.2;
	const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: '#f1f1ee' }));
	body.position.z = d / 2;
	body.castShadow = true;
	group.add(body);
	// Дверца — тонкая панель с зазором по контуру.
	const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.015), new THREE.MeshStandardMaterial({ color: '#fafaf8' }));
	door.position.z = d + 0.008;
	group.add(door);
	const red = new THREE.MeshStandardMaterial({ color: '#d0302a' });
	for (const [cw, ch] of [
		[0.22, 0.07],
		[0.07, 0.22],
	] as const) {
		const bar = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.005), red);
		bar.position.set(0, 0.04, d + 0.018);
		group.add(bar);
	}
	const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.03), new THREE.MeshStandardMaterial({ color: '#9a9c9e' }));
	handle.position.set(w / 2 - 0.05, -0.12, d + 0.025);
	group.add(handle);
	return group;
}

/** Рисунок маркером на доске: схематичный глобус на подставке, подпись и пара пометок. */
function createGlobeDrawingTexture(): THREE.CanvasTexture {
	const w = 160;
	const h = 80;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#f5f6f3';
	ctx.fillRect(0, 0, w, h);
	// Следы плохо стёртого маркера.
	ctx.fillStyle = 'rgba(120,130,150,0.08)';
	ctx.fillRect(100, 12, 40, 10);
	ctx.fillRect(18, 58, 30, 8);

	const cx = 58;
	const cy = 36;
	const r = 23;
	ctx.lineCap = 'round';

	// Подставка: дуга-меридиан сбоку, ножка и основание.
	ctx.strokeStyle = '#26282b';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, r + 5, -Math.PI * 0.62, Math.PI * 0.62, true);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx - 3, cy + r + 5);
	ctx.lineTo(cx - 3, cy + r + 11);
	ctx.moveTo(cx - 16, cy + r + 12);
	ctx.lineTo(cx + 10, cy + r + 12);
	ctx.stroke();

	// Сам глобус с наклоном оси.
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(-0.4);
	ctx.strokeStyle = '#2c5aa0';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.lineWidth = 1;
	// Меридианы и параллели.
	for (const k of [0.35, 0.75]) {
		ctx.beginPath();
		ctx.ellipse(0, 0, r * k, r, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	for (const y of [-12, 0, 12]) {
		const half = Math.sqrt(r * r - y * y);
		ctx.beginPath();
		ctx.ellipse(0, y, half, 2.5, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	// Материки — кривые контуры зелёным маркером.
	ctx.strokeStyle = '#2f7d4a';
	ctx.lineWidth = 2;
	const blobs: [number, number][][] = [
		[
			[-14, -12],
			[-5, -16],
			[-2, -6],
			[-9, 2],
			[-15, -3],
		],
		[
			[2, 2],
			[10, -2],
			[14, 8],
			[6, 16],
			[1, 10],
		],
		[
			[6, -16],
			[14, -12],
			[10, -8],
		],
	];
	for (const blob of blobs) {
		ctx.beginPath();
		blob.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.stroke();
	}
	// Ось.
	ctx.strokeStyle = '#26282b';
	ctx.beginPath();
	ctx.moveTo(0, -r - 6);
	ctx.lineTo(0, -r);
	ctx.moveTo(0, r);
	ctx.lineTo(0, r + 6);
	ctx.stroke();
	ctx.restore();

	// Подпись со стрелкой и пара строчек-пометок.
	ctx.fillStyle = '#c42d22';
	ctx.font = 'bold 12px sans-serif';
	ctx.textBaseline = 'middle';
	ctx.fillText('ГЛОБУС', 102, 22);
	ctx.strokeStyle = '#c42d22';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(102, 26);
	ctx.lineTo(84, 30);
	ctx.lineTo(89, 26);
	ctx.moveTo(84, 30);
	ctx.lineTo(89, 33);
	ctx.stroke();
	ctx.strokeStyle = '#26282b';
	ctx.lineWidth = 1;
	for (const [y, len] of [
		[44, 38],
		[52, 30],
		[60, 34],
	] as const) {
		ctx.beginPath();
		ctx.moveTo(104, y);
		ctx.lineTo(104 + len, y + (len % 3) - 1);
		ctx.stroke();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Большая маркерная доска: белое полотно с рисунком глобуса, алюминиевая рамка, полочка с маркерами и губкой.
 * Перёд — +Z, начало координат — центр задней стороны. */
export function createWhiteboard(width = 2.6, height = 1.3): THREE.Group {
	const group = new THREE.Group();
	const frameMat = new THREE.MeshStandardMaterial({ color: '#b9bdc0', metalness: 0.6, roughness: 0.35 });
	// Порядок граней BoxGeometry: +X, −X, +Y, −Y, +Z, −Z — рисунок только на лицевой.
	const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), [
		frameMat,
		frameMat,
		frameMat,
		frameMat,
		new THREE.MeshStandardMaterial({ map: createGlobeDrawingTexture(), roughness: 0.25 }),
		frameMat,
	]);
	board.position.z = 0.015;
	board.castShadow = true;
	group.add(board);
	for (const [x, y, fw, fh] of [
		[0, height / 2, width + 0.06, 0.04],
		[0, -height / 2, width + 0.06, 0.04],
		[-width / 2, 0, 0.04, height],
		[width / 2, 0, 0.04, height],
	] as const) {
		const edge = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), frameMat);
		edge.position.set(x, y, 0.025);
		group.add(edge);
	}
	// Полочка снизу, маркеры и губка.
	const tray = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.03, 0.08), frameMat);
	tray.position.set(0, -height / 2 - 0.03, 0.06);
	group.add(tray);
	for (const [x, color] of [
		[-0.5, '#2c5aa0'],
		[-0.38, '#26282b'],
		[-0.26, '#c42d22'],
		[-0.14, '#2f7d4a'],
	] as const) {
		const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6), new THREE.MeshStandardMaterial({ color }));
		marker.rotation.z = Math.PI / 2 + x * 0.2;
		marker.position.set(x, -height / 2 - 0.004, 0.06);
		group.add(marker);
	}
	const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: '#3a3d40' }));
	eraser.position.set(0.3, -height / 2 + 0.005, 0.06);
	group.add(eraser);
	return group;
}

/** Навесная полка на двух кронштейнах. Перёд — +Z, начало координат — центр задней кромки, y — верх полки. */
function createShelfBoard(width: number, depth: number): THREE.Group {
	const group = new THREE.Group();
	const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, depth), new THREE.MeshStandardMaterial({ color: '#b08a5e' }));
	board.position.set(0, -0.015, depth / 2);
	board.castShadow = board.receiveShadow = true;
	group.add(board);
	const metal = new THREE.MeshStandardMaterial({ color: '#2b2d30' });
	for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) {
		const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, depth * 0.85), metal);
		arm.position.set(x, -0.04, depth * 0.43);
		group.add(arm);
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), metal);
		post.position.set(x, -0.1, 0.01);
		group.add(post);
	}
	return group;
}

/** Две навесные полки с офисной мелочёвкой: книги, папки, коробочка, стакан с ручками, кактус, кубик,
 * фигурка, геймпад (студия же игровая). Перёд — +Z, начало координат — центр задней кромки нижней полки. */
export function createWallShelves(width = 1.4): THREE.Group {
	const group = new THREE.Group();
	const depth = 0.24;
	const gap = 0.45;
	const mat = (color: string) => new THREE.MeshStandardMaterial({ color });
	const add = (mesh: THREE.Object3D, x: number, y: number, z = depth / 2) => {
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		group.add(mesh);
	};

	for (const y of [0, gap]) {
		const shelf = createShelfBoard(width, depth);
		shelf.position.y = y;
		group.add(shelf);
	}

	// Нижняя полка: ряд книг и папок, одна завалилась, стопка плашмя, коробочка, стакан с ручками.
	let x = -width / 2 + 0.08;
	for (const [bw, bh, color] of [
		[0.04, 0.24, '#8a2f2a'],
		[0.05, 0.27, '#2f4f7a'],
		[0.035, 0.22, '#c9a23a'],
		[0.06, 0.3, '#3a3d40'],
		[0.06, 0.3, '#3f6b45'],
		[0.045, 0.25, '#7a4a6a'],
	] as const) {
		add(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.17), mat(color)), x + bw / 2, bh / 2);
		x += bw + 0.005;
	}
	const leaning = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.23, 0.16), mat('#b35a2a'));
	leaning.rotation.z = -0.35;
	add(leaning, x + 0.06, 0.11);
	['#d8d2c0', '#5a6b7a', '#9a3a2a'].forEach((color, i) => {
		add(new THREE.Mesh(new THREE.BoxGeometry(0.22 - i * 0.02, 0.035, 0.16), mat(color)), 0.12, 0.0175 + i * 0.035);
	});
	add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), mat('#e2dccd')), 0.38, 0.05);
	add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), mat('#3a3d40')), width / 2 - 0.12, 0.05);
	for (const [dx, color, tilt] of [
		[-0.012, '#2c5aa0', 0.15],
		[0.01, '#c42d22', -0.1],
		[0, '#26282b', 0.05],
	] as const) {
		const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), mat(color));
		pen.rotation.z = tilt;
		add(pen, width / 2 - 0.12 + dx, 0.13);
	}

	// Верхняя полка: кактус в горшке, кубик-рубик, фигурка, геймпад, коробка-органайзер.
	const top = gap;
	add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), mat('#b5653a')), -width / 2 + 0.12, top + 0.04);
	add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 6), mat('#4f7a3a')), -width / 2 + 0.12, top + 0.15);
	const cube = new THREE.Mesh(
		new THREE.BoxGeometry(0.06, 0.06, 0.06),
		['#d0302a', '#f4d94a', '#2c5aa0', '#3fa35a', '#f2a33c', '#f2f2ee'].map(mat)
	);
	cube.rotation.y = 0.5;
	add(cube, -0.3, top + 0.03);
	// Фигурка: тело и голова.
	add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.04), mat('#7dc242')), -0.08, top + 0.04);
	add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.05), mat('#f0d2a8')), -0.08, top + 0.105);
	// Геймпад — корпус и две «ручки».
	const pad = new THREE.Group();
	const padMat = mat('#2a2b2e');
	pad.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.07), padMat));
	for (const px of [-0.07, 0.07]) {
		const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.06), padMat);
		grip.position.set(px, 0, 0.035);
		pad.add(grip);
	}
	pad.rotation.y = -0.3;
	add(pad, 0.18, top + 0.013);
	add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.18), mat('#5a6b7a')), width / 2 - 0.16, top + 0.07);
	return group;
}
