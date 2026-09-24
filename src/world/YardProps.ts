import * as THREE from 'three';

/** Низкополигональные пропсы двора многоквартирного дома + текстура железного забора. */

export function createBench(): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: '#6b4a32' });
	const metal = new THREE.MeshStandardMaterial({ color: '#2b2c2e' });

	const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.4), mat);
	seat.position.y = 0.45;
	seat.castShadow = seat.receiveShadow = true;
	group.add(seat);

	const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.06), mat);
	back.position.set(0, 0.7, -0.17);
	back.rotation.x = -0.15;
	back.castShadow = true;
	group.add(back);

	for (const x of [-0.65, 0.65]) {
		const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.35), metal);
		leg.position.set(x, 0.225, 0);
		group.add(leg);
	}
	return group;
}

export function createTrashBin(): THREE.Group {
	const group = new THREE.Group();
	const bin = new THREE.Mesh(
		new THREE.CylinderGeometry(0.22, 0.18, 0.55, 8),
		new THREE.MeshStandardMaterial({ color: '#3a4a3f' })
	);
	bin.position.y = 0.275;
	bin.castShadow = bin.receiveShadow = true;
	group.add(bin);
	return group;
}

/** Осеннее дерево в масштабе двора 17-этажки: ствол ~4 м, крона до ~7 м. scale — разброс размера, color — цвет листвы. */
export function createTree(scale = 1, color = '#8a6a3d'): THREE.Group {
	const group = new THREE.Group();
	const trunkHeight = 4.2;
	const trunkMat = new THREE.MeshStandardMaterial({ color: '#4f3d2b' });
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, trunkHeight, 6), trunkMat);
	trunk.position.y = trunkHeight / 2;
	trunk.castShadow = true;
	group.add(trunk);

	// Пара толстых веток — чтобы крона не висела на палке.
	for (const [rz, rx, y] of [
		[0.6, 0.2, 3.2],
		[-0.7, -0.3, 3.5],
	] as const) {
		const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 5), trunkMat);
		branch.position.set(Math.sin(-rz) * 0.6, y, Math.sin(rx) * 0.6);
		branch.rotation.set(rx, 0, rz);
		group.add(branch);
	}

	const foliageMat = new THREE.MeshStandardMaterial({ color, flatShading: true });
	const spread = [
		[0, 5.6, 0, 2.2],
		[1.3, 4.8, 0.5, 1.6],
		[-1.2, 5.0, -0.6, 1.7],
		[0.3, 4.6, -1.3, 1.4],
		[-0.4, 6.6, 0.4, 1.4],
	] as const;
	for (const [x, y, z, r] of spread) {
		const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat);
		leaf.position.set(x, y, z);
		leaf.rotation.set(x, z, y);
		leaf.castShadow = true;
		group.add(leaf);
	}
	group.scale.setScalar(scale);
	return group;
}

/** Куст: пара приплюснутых многогранников. */
export function createBush(scale = 1): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: '#5d6538', flatShading: true });
	for (const [x, y, z, r] of [
		[0, 0.45, 0, 0.6],
		[0.5, 0.35, 0.2, 0.45],
		[-0.45, 0.35, -0.1, 0.5],
	] as const) {
		const part = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
		part.position.set(x, y, z);
		part.scale.y = 0.8;
		part.castShadow = true;
		group.add(part);
	}
	group.scale.setScalar(scale);
	return group;
}

/** Уличный фонарь: столб с кронштейном и плафоном (кронштейн — в сторону +X). */
export function createLampPost(): THREE.Group {
	const group = new THREE.Group();
	const metal = new THREE.MeshStandardMaterial({ color: '#3b3e3f' });
	const height = 4.5;
	const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, height, 6), metal);
	pole.position.y = height / 2;
	pole.castShadow = true;
	group.add(pole);

	const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), metal);
	arm.position.set(0.42, height - 0.05, 0);
	group.add(arm);

	const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.25), metal);
	head.position.set(0.85, height - 0.15, 0);
	group.add(head);

	const glass = new THREE.Mesh(
		new THREE.BoxGeometry(0.34, 0.04, 0.2),
		new THREE.MeshStandardMaterial({ color: '#e8dfb8', emissive: '#bfae78', emissiveIntensity: 0.6 })
	);
	glass.position.set(0.85, height - 0.24, 0);
	group.add(glass);
	return group;
}

/** Рама из двух столбов и перекладин — основа турника и выбивалки. rails — высоты перекладин. */
function createBarFrame(width: number, height: number, rails: number[], color: string): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color });
	for (const x of [-width / 2, width / 2]) {
		const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 6), mat);
		post.position.set(x, height / 2, 0);
		post.castShadow = true;
		group.add(post);
	}
	for (const y of rails) {
		const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, width, 6), mat);
		rail.rotation.z = Math.PI / 2;
		rail.position.y = y;
		rail.castShadow = true;
		group.add(rail);
	}
	return group;
}

/** Турник. */
export function createPullUpBar(): THREE.Group {
	return createBarFrame(1.4, 2.5, [2.45], '#2f4f6b');
}

/** Выбивалка для ковров — классика советского двора. */
export function createCarpetRack(): THREE.Group {
	return createBarFrame(2.6, 1.9, [1.85, 1.3, 0.75], '#6b6f5a');
}

/** Качели: рама с опорами буквой А по бокам и сиденье на двух подвесах. */
export function createSwing(): THREE.Group {
	const group = new THREE.Group();
	const frameMat = new THREE.MeshStandardMaterial({ color: '#b34a2e' });
	const width = 2.4;
	const height = 2.4;
	for (const x of [-width / 2, width / 2]) {
		for (const tilt of [-0.28, 0.28]) {
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height / Math.cos(tilt), 6), frameMat);
			leg.position.set(x, height / 2, (Math.tan(tilt) * height) / 2);
			leg.rotation.x = -tilt;
			leg.castShadow = true;
			group.add(leg);
		}
	}
	const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, width, 6), frameMat);
	top.rotation.z = Math.PI / 2;
	top.position.y = height;
	group.add(top);

	const chainMat = new THREE.MeshStandardMaterial({ color: '#707070' });
	for (const x of [-0.3, 0.3]) {
		const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, height - 0.5, 0.02), chainMat);
		chain.position.set(x, 0.5 + (height - 0.5) / 2, 0);
		group.add(chain);
	}
	const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: '#6b4a32' }));
	seat.position.y = 0.5;
	seat.castShadow = true;
	group.add(seat);
	return group;
}

/** Детская горка: площадка на ножках, лесенка сзади (−Z), скат вперёд (+Z). */
export function createSlide(): THREE.Group {
	const group = new THREE.Group();
	const frameMat = new THREE.MeshStandardMaterial({ color: '#3f6b45' });
	const h = 1.5;

	const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), frameMat);
	platform.position.y = h;
	platform.castShadow = true;
	group.add(platform);
	for (const [x, z] of [
		[-0.42, -0.42],
		[0.42, -0.42],
		[-0.42, 0.42],
		[0.42, 0.42],
	] as const) {
		const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h + 0.7, 6), frameMat);
		leg.position.set(x, (h + 0.7) / 2, z);
		group.add(leg);
	}
	for (let i = 1; i < 5; i++) {
		const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.12), frameMat);
		step.position.set(0, (h / 5) * i, -0.45 - (0.9 / 5) * (5 - i));
		group.add(step);
	}
	const run = 2.2;
	const ramp = new THREE.Mesh(
		new THREE.BoxGeometry(0.6, 0.04, Math.hypot(h, run)),
		new THREE.MeshStandardMaterial({ color: '#c9a23a' })
	);
	ramp.position.set(0, h / 2, 0.45 + run / 2);
	ramp.rotation.x = Math.atan2(h, run);
	ramp.castShadow = true;
	group.add(ramp);
	return group;
}

/** Боковой профиль [z, y] → призма шириной width вдоль X, по центру. */
function extrudeProfile(points: [number, number][], width: number, mat: THREE.Material): THREE.Mesh {
	const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
	geometry.translate(0, 0, -width / 2);
	// Ось профиля X → Z машины, выдавливание Z → X.
	geometry.rotateY(-Math.PI / 2);
	const mesh = new THREE.Mesh(geometry, mat);
	mesh.castShadow = mesh.receiveShadow = true;
	return mesh;
}

/** Стекло на наклонной грани кабины от (z1, y1) до (z2, y2); нормаль смотрит наружу. */
function slopedGlass(z1: number, y1: number, z2: number, y2: number, width: number, outward: 1 | -1, mat: THREE.Material): THREE.Mesh {
	const len = Math.hypot(z2 - z1, y2 - y1);
	const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, len * 0.86), mat);
	// Нормаль грани в плоскости (z, y), развёрнутая наружу от кабины.
	let nz = y2 - y1;
	let ny = -(z2 - z1);
	if (Math.sign(nz) !== outward) {
		nz = -nz;
		ny = -ny;
	}
	const nl = Math.hypot(nz, ny);
	nz /= nl;
	ny /= nl;
	glass.position.set(0, (y1 + y2) / 2 + ny * 0.006, (z1 + z2) / 2 + nz * 0.006);
	// Плоскость смотрит в +Z; поворот по X даёт нормаль (0, −sinθ, cosθ).
	glass.rotation.x = Math.atan2(-ny, nz);
	return glass;
}

/** Припаркованная легковушка — низкополи седан (перёд — +Z): капот, кабина с наклонными стёклами, фары, бамперы, номера. */
export function createCar(color = '#7a2b25'): THREE.Group {
	const group = new THREE.Group();
	const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
	const glassMat = new THREE.MeshStandardMaterial({ color: '#27313a', roughness: 0.1, metalness: 0.5 });
	const trimMat = new THREE.MeshStandardMaterial({ color: '#9a9c98', roughness: 0.3, metalness: 0.6 });
	const darkMat = new THREE.MeshStandardMaterial({ color: '#1c1d1e' });

	// Нижняя часть кузова: низкий капот спереди, багажник сзади.
	group.add(
		extrudeProfile(
			[
				[-2.08, 0.3],
				[2.05, 0.3],
				[2.1, 0.5],
				[2.04, 0.76],
				[0.85, 0.9],
				[-1.15, 0.92],
				[-2.02, 0.88],
				[-2.1, 0.66],
			],
			1.66,
			bodyMat
		)
	);

	// Кабина-трапеция и рамка стёкол.
	const cabin: [number, number][] = [
		[-1.15, 0.9],
		[0.85, 0.9],
		[0.3, 1.45],
		[-0.85, 1.45],
	];
	group.add(extrudeProfile(cabin, 1.48, bodyMat));
	group.add(
		extrudeProfile(
			[
				[-1.0, 0.98],
				[0.68, 0.98],
				[0.26, 1.38],
				[-0.8, 1.38],
			],
			1.5,
			glassMat
		)
	);
	const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.51, 0.42, 0.07), bodyMat);
	pillar.position.set(0, 1.18, -0.3);
	group.add(pillar);
	group.add(slopedGlass(0.85, 0.9, 0.3, 1.45, 1.3, 1, glassMat));
	group.add(slopedGlass(-1.15, 0.9, -0.85, 1.45, 1.3, -1, glassMat));

	// Перёд: фары, решётка; зад: фонари. Бамперы и номера с обеих сторон.
	const headMat = new THREE.MeshStandardMaterial({ color: '#f1ecd2', emissive: '#8a8468', emissiveIntensity: 0.5 });
	const tailMat = new THREE.MeshStandardMaterial({ color: '#a3241c', emissive: '#4a0d09', emissiveIntensity: 0.6 });
	const plateMat = new THREE.MeshStandardMaterial({ color: '#e6e4dc' });
	for (const x of [-0.56, 0.56]) {
		const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.04), headMat);
		head.position.set(x, 0.64, 2.08);
		group.add(head);
		const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.04), tailMat);
		tail.position.set(x, 0.7, -2.09);
		group.add(tail);
	}
	const grille = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.13, 0.04), darkMat);
	grille.position.set(0, 0.64, 2.09);
	group.add(grille);

	for (const side of [1, -1]) {
		const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.14), trimMat);
		bumper.position.set(0, 0.4, side * 2.12);
		bumper.castShadow = true;
		group.add(bumper);
		const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.02), plateMat);
		plate.position.set(0, 0.52, side * 2.11);
		group.add(plate);
	}

	for (const x of [-0.84, 0.84]) {
		const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), bodyMat);
		mirror.position.set(x, 1.0, 0.7);
		group.add(mirror);
		const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.14), trimMat);
		handle.position.set(x * 0.995, 0.84, 0.05);
		group.add(handle);
	}

	// Колёса с колпаками — чуть выступают из кузова.
	const tireMat = new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.9 });
	for (const [x, z] of [
		[-0.78, 1.3],
		[0.78, 1.3],
		[-0.78, -1.3],
		[0.78, -1.3],
	] as const) {
		const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), tireMat);
		tire.rotation.z = Math.PI / 2;
		tire.position.set(x, 0.32, z);
		tire.castShadow = true;
		group.add(tire);
		const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.23, 8), trimMat);
		hub.rotation.z = Math.PI / 2;
		hub.position.set(x, 0.32, z);
		group.add(hub);
	}
	return group;
}

/** Лужа от дождя: плоское тёмное пятно с бликом, w × d — размер эллипса. */
export function createPuddle(w: number, d: number): THREE.Mesh {
	const puddle = new THREE.Mesh(
		new THREE.CircleGeometry(0.5, 10),
		new THREE.MeshStandardMaterial({ color: '#5b5750', roughness: 0.1, metalness: 0.3 })
	);
	puddle.rotation.x = -Math.PI / 2;
	puddle.scale.set(w, d, 1);
	puddle.position.y = 0.01;
	puddle.receiveShadow = true;
	return puddle;
}

/** Песочница: низкий деревянный короб + песок внутри. */
export function createSandbox(): THREE.Group {
	const group = new THREE.Group();
	const frameMat = new THREE.MeshStandardMaterial({ color: '#8a5a3c' });
	const size = 1.8;
	const h = 0.22;
	const t = 0.08;
	const sides: [number, number, number, number][] = [
		[0, -size / 2, size, t],
		[0, size / 2, size, t],
		[-size / 2, 0, t, size],
		[size / 2, 0, t, size],
	];
	for (const [x, z, w, d] of sides) {
		const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
		wall.position.set(x, h / 2, z);
		wall.castShadow = wall.receiveShadow = true;
		group.add(wall);
	}
	const sand = new THREE.Mesh(
		new THREE.PlaneGeometry(size - t, size - t),
		new THREE.MeshStandardMaterial({ color: '#d8c48a' })
	);
	sand.rotation.x = -Math.PI / 2;
	sand.position.y = 0.05;
	sand.receiveShadow = true;
	group.add(sand);
	return group;
}

/** Цвет кованого металла — как у прутьев забора. */
const IRON = '#262827';

/**
 * Металлическая калитка в стиле забора: рама из профиля, прутья с пиками, средняя перекладина, диагональная
 * распорка, петли и щеколда с ручкой. Начало координат группы — на петле (край полотна), полотно тянется по +X,
 * — так группу можно крутить на месте для анимации (как дверь офиса).
 */
export function createGate(width: number, height: number): THREE.Group {
	const group = new THREE.Group();
	const iron = new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.55, metalness: 0.5 });
	const bottom = 0.06;
	const tube = 0.05;
	const bar = (w: number, h: number, d: number, x: number, y: number, z = 0) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iron);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		group.add(mesh);
		return mesh;
	};

	// Рама: стойки и три перекладины.
	const top = height - 0.12;
	bar(tube, top - bottom, tube, tube / 2, (bottom + top) / 2);
	bar(tube, top - bottom, tube, width - tube / 2, (bottom + top) / 2);
	for (const y of [bottom, top, bottom + (top - bottom) * 0.45]) bar(width, tube, tube, width / 2, y);

	// Прутья с пиками — выше верхней перекладины, как у забора.
	const step = 0.13;
	const count = Math.floor((width - tube * 2) / step);
	const offset = (width - (count - 1) * step) / 2;
	const tipGeometry = new THREE.ConeGeometry(0.03, 0.08, 4);
	for (let i = 0; i < count; i++) {
		const x = offset + i * step;
		bar(0.022, height - 0.08 - bottom, 0.022, x, (bottom + height - 0.08) / 2);
		const tip = new THREE.Mesh(tipGeometry, iron);
		tip.position.set(x, height - 0.04, 0);
		tip.rotation.y = Math.PI / 4;
		group.add(tip);
	}

	// Диагональная распорка — от нижнего угла у петель к средней перекладине у щеколды (не даёт полотну провиснуть).
	const midY = bottom + (top - bottom) * 0.45;
	const dx = width - tube * 2;
	const dy = midY - bottom;
	const brace = bar(Math.hypot(dx, dy), 0.035, 0.03, width / 2, (bottom + midY) / 2);
	brace.rotation.z = Math.atan2(dy, dx);

	// Петли — цилиндры на краю у столба.
	for (const y of [bottom + 0.25, top - 0.25]) {
		const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), iron);
		hinge.position.set(0, y, 0);
		group.add(hinge);
	}

	// Щеколда и ручка с обеих сторон полотна.
	const latchY = midY + 0.25;
	bar(0.16, 0.03, 0.02, width - 0.05, latchY, 0.035);
	const handleMat = new THREE.MeshStandardMaterial({ color: '#8a8d8f', roughness: 0.3, metalness: 0.8 });
	for (const side of [1, -1]) {
		const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), handleMat);
		handle.position.set(width - 0.12, latchY - 0.12, side * 0.05);
		group.add(handle);
	}
	return group;
}

/** Столб калитки: квадратная труба с навершием-шаром. Начало координат — центр основания. */
export function createGatePost(height: number): THREE.Group {
	const group = new THREE.Group();
	const iron = new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.55, metalness: 0.5 });
	const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.1), iron);
	post.position.y = height / 2;
	post.castShadow = true;
	group.add(post);
	const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), iron);
	cap.position.y = height + 0.015;
	group.add(cap);
	const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), iron);
	ball.position.y = height + 0.08;
	group.add(ball);
	return group;
}

/** Полоса-текстура «железного забора»: вертикальные прутья на прозрачном фоне, тайлится по длине стороны. */
export function createFenceTexture(repeat: number): THREE.CanvasTexture {
	const w = 64;
	const h = 64;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.clearRect(0, 0, w, h);

	ctx.fillStyle = '#20211f';
	// Верхняя и нижняя рейки.
	ctx.fillRect(0, 4, w, 6);
	ctx.fillRect(0, h - 10, w, 6);
	// Прутья.
	const barCount = 5;
	const barW = 6;
	for (let i = 0; i < barCount; i++) {
		const x = (i + 0.5) * (w / barCount) - barW / 2;
		ctx.fillRect(x, 0, barW, h);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.repeat.set(repeat, 1);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Пиксельная «шумовая» текстура из палитры: клетки случайного цвета, NearestFilter — в стиле остальной сцены.
 * repeat — сколько раз тайл ложится на поверхность по X / Y. */
export function createNoiseTexture(palette: string[], repeatX: number, repeatY: number, size = 32, seed = 1): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	let s = seed;
	const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
			ctx.fillRect(x, y, 1, 1);
		}
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** Металлический гараж-коробка: ворота на грани +Z, лёгкий козырёк крыши. 3 × 6 м. */
export function createGarage(color = '#6b5a48'): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 });
	const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.4, 6), mat);
	body.position.y = 1.2;
	body.castShadow = body.receiveShadow = true;
	group.add(body);
	const roof = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 6.3), new THREE.MeshStandardMaterial({ color: '#4a4744' }));
	roof.position.set(0, 2.44, 0.1);
	group.add(roof);
	// Ворота — две створки чуть другого оттенка и тёмная щель между ними.
	const doorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.6, metalness: 0.3 });
	for (const x of [-0.66, 0.66]) {
		const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.28, 2.1, 0.04), doorMat);
		leaf.position.set(x, 1.1, 3.02);
		group.add(leaf);
	}
	const lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }));
	lock.position.set(0.1, 1.1, 3.05);
	group.add(lock);
	return group;
}

type TrashRand = () => number;

function trashRand(seed: number): TrashRand {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const BAG_COLORS = ['#1f2022', '#2b2d30', '#3a4a6a', '#d8d6cf', '#4a5a3a', '#262626'];

/** Завязанный мусорный пакет: приплюснутый многогранник и «хвостик» узла. */
export function createTrashBag(color = '#1f2022', scale = 1): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, flatShading: true });
	const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat);
	body.scale.set(1, 0.8, 0.9);
	body.position.y = 0.25;
	body.castShadow = true;
	group.add(body);
	const knot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), mat);
	knot.position.y = 0.55;
	group.add(knot);
	group.scale.setScalar(scale);
	return group;
}

/** Картонная коробка, иногда чуть раскрытая (клапан торчит). */
export function createCardboardBox(w = 0.5, h = 0.35, d = 0.4, open = false): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: '#a07a4a', roughness: 0.9 });
	const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
	box.position.y = h / 2;
	box.castShadow = box.receiveShadow = true;
	group.add(box);
	const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, d + 0.002), new THREE.MeshStandardMaterial({ color: '#c9b48a' }));
	tape.position.y = h + 0.003;
	group.add(tape);
	if (open) {
		const flap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d / 2), mat);
		flap.position.set(0, h + 0.1, -d / 2 - 0.08);
		flap.rotation.x = 0.9;
		group.add(flap);
	}
	return group;
}

/** Пустая бутылка лёжа — зелёное или коричневое стекло. */
export function createBottle(color = '#3f6a3a'): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.2 });
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), mat);
	body.rotation.z = Math.PI / 2;
	body.position.y = 0.04;
	group.add(body);
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.08, 6), mat);
	neck.rotation.z = Math.PI / 2;
	neck.position.set(0.14, 0.04, 0);
	group.add(neck);
	return group;
}

/** Смятая бумажка/обёртка на земле — маленький кривой лоскут. */
export function createLitterPaper(color = '#d9d4c8', size = 0.25): THREE.Mesh {
	const paper = new THREE.Mesh(new THREE.CircleGeometry(size, 4), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
	paper.rotation.x = -Math.PI / 2 + 0.15;
	paper.scale.set(1, 0.7, 1);
	paper.position.y = 0.02;
	return paper;
}

/**
 * Открытая мульда-контейнер: полый ящик без крышки (крышка откинута назад к стенке), внутри горка мусора
 * — пакеты и коробки торчат над бортом. Перёд — +Z.
 */
export function createDumpster(color = '#3f5a44', seed = 1): THREE.Group {
	const group = new THREE.Group();
	const rand = trashRand(seed);
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
	const w = 1.6;
	const h = 1.1;
	const d = 1.0;
	const t = 0.04;
	const base = 0.12;
	// Дно и четыре стенки.
	for (const [px, py, pz, sx, sy, sz] of [
		[0, base + t / 2, 0, w, t, d],
		[0, base + h / 2, d / 2 - t / 2, w, h, t],
		[0, base + h / 2, -d / 2 + t / 2, w, h, t],
		[w / 2 - t / 2, base + h / 2, 0, t, h, d],
		[-w / 2 + t / 2, base + h / 2, 0, t, h, d],
	] as const) {
		const part = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
		part.position.set(px, py, pz);
		part.castShadow = part.receiveShadow = true;
		group.add(part);
	}
	// Ребро жёсткости по борту — темнее.
	const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), new THREE.MeshStandardMaterial({ color: '#2f3f33' }));
	rim.position.y = base + h;
	group.add(rim);
	// Внутренняя пустота сверху выглядит тёмной — «дно» кучи мусора.
	const inside = new THREE.Mesh(new THREE.PlaneGeometry(w - t * 2, d - t * 2), new THREE.MeshStandardMaterial({ color: '#2a2622' }));
	inside.rotation.x = -Math.PI / 2;
	inside.position.y = base + h * 0.7;
	group.add(inside);

	// Откинутая назад крышка — стоит почти вертикально за контейнером.
	const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06), new THREE.MeshStandardMaterial({ color: '#2f3f33' }));
	lid.geometry.translate(0, 0, -(d + 0.06) / 2);
	lid.position.set(0, base + h, -d / 2);
	lid.rotation.x = 1.35;
	group.add(lid);

	// Колёсики.
	const wheelMat = new THREE.MeshStandardMaterial({ color: '#1b1b1b' });
	for (const [x, z] of [
		[-0.65, 0.35],
		[0.65, 0.35],
		[-0.65, -0.35],
		[0.65, -0.35],
	] as const) {
		const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), wheelMat);
		wheel.rotation.z = Math.PI / 2;
		wheel.position.set(x, 0.06, z);
		group.add(wheel);
	}

	// Мусор внутри: пакеты разного цвета и пара коробок, верх кучи выше борта.
	const top = base + h;
	for (let i = 0; i < 6; i++) {
		const bag = createTrashBag(BAG_COLORS[Math.floor(rand() * BAG_COLORS.length)], 0.8 + rand() * 0.5);
		bag.position.set((rand() - 0.5) * (w - 0.5), top - 0.3 + rand() * 0.25, (rand() - 0.5) * (d - 0.4));
		bag.rotation.set((rand() - 0.5) * 0.8, rand() * Math.PI, (rand() - 0.5) * 0.8);
		group.add(bag);
	}
	for (let i = 0; i < 2; i++) {
		const box = createCardboardBox(0.45 + rand() * 0.2, 0.3, 0.35, rand() < 0.5);
		box.position.set((rand() - 0.5) * (w - 0.6), top - 0.15, (rand() - 0.5) * (d - 0.5));
		box.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.5);
		group.add(box);
	}
	return group;
}

/**
 * Навес контейнерной площадки: стойки, скатная крыша из профлиста, задняя и боковые стенки.
 * Открыт вперёд (+Z). width × depth — по внешнему контуру, начало координат — центр основания.
 */
export function createDumpsterShelter(width = 6.4, depth = 2.2): THREE.Group {
	const group = new THREE.Group();
	const frontH = 2.7;
	const backH = 2.45;
	const metal = new THREE.MeshStandardMaterial({ color: '#4a4d4f', metalness: 0.4, roughness: 0.6 });

	// Профлист: вертикальные рёбра текстурой.
	const canvas = document.createElement('canvas');
	canvas.width = 16;
	canvas.height = 4;
	const ctx = canvas.getContext('2d')!;
	for (let x = 0; x < 16; x++) {
		ctx.fillStyle = x % 4 < 2 ? '#6d7a73' : '#5b6761';
		ctx.fillRect(x, 0, 1, 4);
	}
	const sheetTex = new THREE.CanvasTexture(canvas);
	sheetTex.magFilter = sheetTex.minFilter = THREE.NearestFilter;
	sheetTex.wrapS = sheetTex.wrapT = THREE.RepeatWrapping;
	sheetTex.colorSpace = THREE.SRGBColorSpace;
	const sheet = (repeatX: number) => {
		const tex = sheetTex.clone();
		tex.repeat.set(repeatX, 1);
		tex.needsUpdate = true;
		return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
	};

	for (const [x, z, hgt] of [
		[-width / 2, depth / 2, frontH],
		[width / 2, depth / 2, frontH],
		[-width / 2, -depth / 2, backH],
		[width / 2, -depth / 2, backH],
	] as const) {
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, hgt, 0.08), metal);
		post.position.set(x, hgt / 2, z);
		post.castShadow = true;
		group.add(post);
	}

	// Задняя стенка во всю ширину, боковые — до высоты задней.
	const back = new THREE.Mesh(new THREE.PlaneGeometry(width, backH - 0.1), sheet(width / 1.2));
	back.position.set(0, (backH - 0.1) / 2, -depth / 2);
	back.castShadow = back.receiveShadow = true;
	group.add(back);
	for (const x of [-width / 2, width / 2]) {
		const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, backH - 0.1), sheet(depth / 1.2));
		side.rotation.y = Math.PI / 2;
		side.position.set(x, (backH - 0.1) / 2, 0);
		side.castShadow = true;
		group.add(side);
	}

	// Крыша — скат назад, с небольшим свесом.
	const roofLen = Math.hypot(depth + 0.4, frontH - backH);
	const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.05, roofLen), sheet((width + 0.4) / 1.2));
	roof.position.set(0, (frontH + backH) / 2 + 0.03, 0);
	roof.rotation.x = -Math.atan2(frontH - backH, depth + 0.4);
	roof.castShadow = true;
	group.add(roof);

	const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.1), metal);
	beam.position.set(0, frontH - 0.05, depth / 2);
	group.add(beam);
	return group;
}

/** Надписи/значки автомата — маленький пиксельный канвас. */
function labelTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	draw(canvas.getContext('2d')!);
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = texture.minFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * Уличный автомат по продаже питьевой воды в свою тару: бело-синий шкаф с вывеской «ВОДА» и каплей,
 * табличкой цены, экраном, приёмником купюр/монет и нишей с краном под бутыль. Перёд — +Z.
 */
export function createWaterVendingMachine(): THREE.Group {
	const group = new THREE.Group();
	const w = 1.3;
	const h = 2.2;
	const d = 1.0;
	const front = d / 2;
	const white = new THREE.MeshStandardMaterial({ color: '#e6e8ea', roughness: 0.5 });
	const blue = new THREE.MeshStandardMaterial({ color: '#2f6fb3', roughness: 0.45 });
	const dark = new THREE.MeshStandardMaterial({ color: '#23272b' });
	const steel = new THREE.MeshStandardMaterial({ color: '#b9bec2', metalness: 0.7, roughness: 0.3 });

	// Корпус на цоколе, синие боковины.
	const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), new THREE.MeshStandardMaterial({ color: '#7b7d7f' }));
	plinth.position.y = 0.06;
	group.add(plinth);
	const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [blue, blue, white, white, white, white]);
	body.position.y = 0.12 + h / 2;
	body.castShadow = body.receiveShadow = true;
	group.add(body);
	// Козырёк от дождя над лицевой панелью.
	const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.08, d + 0.35), blue);
	roof.position.set(0, 0.12 + h + 0.04, 0.12);
	roof.castShadow = true;
	group.add(roof);

	// Вывеска «ВОДА» с каплей — светится.
	const sign = new THREE.Mesh(
		new THREE.PlaneGeometry(w - 0.1, 0.42),
		new THREE.MeshStandardMaterial({
			map: labelTexture(40, 14, (ctx) => {
				ctx.fillStyle = '#2f6fb3';
				ctx.fillRect(0, 0, 40, 14);
				// Капля.
				ctx.fillStyle = '#9fd3f5';
				ctx.beginPath();
				ctx.moveTo(6, 2);
				ctx.lineTo(10, 8);
				ctx.arc(6, 8.5, 4, 0, Math.PI);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 10px sans-serif';
				ctx.textBaseline = 'middle';
				ctx.fillText('ВОДА', 13, 7.5);
			}),
			emissive: '#1b4f8a',
			emissiveIntensity: 0.5,
		})
	);
	sign.position.set(0, 0.12 + h - 0.28, front + 0.005);
	group.add(sign);

	// Табличка с ценой и экран.
	const price = new THREE.Mesh(
		new THREE.PlaneGeometry(0.5, 0.25),
		new THREE.MeshStandardMaterial({
			map: labelTexture(20, 10, (ctx) => {
				ctx.fillStyle = '#f2f2ee';
				ctx.fillRect(0, 0, 20, 10);
				ctx.fillStyle = '#c42d22';
				ctx.font = 'bold 7px sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('5₽/л', 10, 5.5);
			}),
		})
	);
	price.position.set(-0.28, 1.72, front + 0.005);
	group.add(price);
	const screen = new THREE.Mesh(
		new THREE.PlaneGeometry(0.34, 0.22),
		new THREE.MeshStandardMaterial({ color: '#1f3a2c', emissive: '#3f8f5a', emissiveIntensity: 0.6 })
	);
	screen.position.set(0.3, 1.72, front + 0.005);
	group.add(screen);

	// Приёмник купюр, монетоприёмник и кнопки «налить».
	const billSlot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), dark);
	billSlot.position.set(0.3, 1.48, front + 0.02);
	group.add(billSlot);
	const coin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), steel);
	coin.position.set(0.3, 1.33, front + 0.015);
	group.add(coin);
	for (const [x, color] of [
		[-0.4, '#3fa35a'],
		[-0.18, '#c42d22'],
	] as const) {
		const button = new THREE.Mesh(
			new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8),
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
		);
		button.rotation.x = Math.PI / 2;
		button.position.set(x, 1.42, front + 0.02);
		group.add(button);
	}

	// Ниша налива: тёмный проём, кран сверху, решётка-поддон снизу.
	const nicheY = 0.95;
	const niche = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.03), new THREE.MeshStandardMaterial({ color: '#3a4a57' }));
	niche.position.set(0, nicheY, front + 0.005);
	group.add(niche);
	for (const [x, y, sw, sh] of [
		[0, nicheY + 0.37, 0.72, 0.05],
		[0, nicheY - 0.37, 0.72, 0.05],
		[-0.34, nicheY, 0.05, 0.78],
		[0.34, nicheY, 0.05, 0.78],
	] as const) {
		const edge = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.06), steel);
		edge.position.set(x, y, front + 0.02);
		group.add(edge);
	}
	const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 6), steel);
	tap.position.set(0, nicheY + 0.26, front + 0.07);
	group.add(tap);
	const tray = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.2), steel);
	tray.position.set(0, nicheY - 0.33, front + 0.1);
	group.add(tray);
	return group;
}

/** Пустая 19-литровая бутыль из-под воды — голубоватый пластик, стоит на земле. */
export function createWaterJug(): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: '#8fc3e0', transparent: true, opacity: 0.75, roughness: 0.15 });
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.38, 8), mat);
	body.position.y = 0.19;
	group.add(body);
	const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.14, 0.1, 8), mat);
	shoulder.position.y = 0.43;
	group.add(shoulder);
	const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), new THREE.MeshStandardMaterial({ color: '#2f6fb3' }));
	cap.position.y = 0.5;
	group.add(cap);
	return group;
}

/** Плита бетонного забора (ПО-2): серый бетон с рельефом ромбами, тёмный стык по краю. Один тайл — одна плита. */
export function createConcreteFenceTexture(repeat: number): THREE.CanvasTexture {
	const w = 32;
	const h = 20;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	let s = 21;
	const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
	const palette = ['#8e8c86', '#8a8882', '#93918b', '#86847e'];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
			ctx.fillRect(x, y, 1, 1);
		}
	}
	// Рельеф ромбами: светлая грань сверху-слева, тёмная снизу-справа.
	const cell = 4;
	for (let y = 2; y < h - 2; y++) {
		for (let x = 1; x < w - 1; x++) {
			const u = (x + y) % cell;
			const v = (x - y + 64) % cell;
			if (u === 0 || v === 0) {
				ctx.fillStyle = (x + y) % 8 < 4 ? '#a19f99' : '#76746f';
				ctx.fillRect(x, y, 1, 1);
			}
		}
	}
	// Гладкие поля сверху/снизу и стык между плитами.
	ctx.fillStyle = '#8f8d87';
	ctx.fillRect(0, 0, w, 2);
	ctx.fillRect(0, h - 2, w, 2);
	ctx.fillStyle = '#5f5d59';
	ctx.fillRect(0, 0, 1, h);
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.repeat.set(repeat, 1);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
