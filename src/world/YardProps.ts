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

/** Опавшие листья под деревом — пятно на земле. */
export function createLeafLitter(radius: number, color = '#94693a'): THREE.Mesh {
	const litter = new THREE.Mesh(new THREE.CircleGeometry(radius, 9), new THREE.MeshStandardMaterial({ color }));
	litter.rotation.x = -Math.PI / 2;
	litter.position.y = 0.005;
	litter.receiveShadow = true;
	return litter;
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

/** Калитка: сплошная крашеная панель (не прутья, как у забора) — чтобы явно выделялась на его фоне.
 * Начало координат группы — на петле (край), не в центре, чтобы вращать группу на месте (как дверь офиса). */
export function createGate(width: number, height: number, color = '#8b3a2a'): THREE.Group {
	const group = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
	const leaf = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
	leaf.position.set(width / 2, height / 2, 0);
	leaf.castShadow = true;
	group.add(leaf);

	// Тонкая рама потемнее — читается как крашеный металлический лист, а не просто плоскость цвета.
	const frameMat = new THREE.MeshStandardMaterial({ color: '#3a1f16' });
	for (const [fx, fy, fw, fh] of [
		[width / 2, 0.03, width, 0.06],
		[width / 2, height - 0.03, width, 0.06],
	] as const) {
		const rail = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.03), frameMat);
		rail.position.set(fx, fy, 0.02);
		group.add(rail);
	}
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
