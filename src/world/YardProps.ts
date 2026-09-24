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

export function createTree(): THREE.Group {
	const group = new THREE.Group();
	const trunk = new THREE.Mesh(
		new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6),
		new THREE.MeshStandardMaterial({ color: '#5a4632' })
	);
	trunk.position.y = 0.8;
	trunk.castShadow = true;
	group.add(trunk);

	const foliageMat = new THREE.MeshStandardMaterial({ color: '#8a6a3d' });
	const spread = [
		[0, 2.3, 0, 1.1],
		[0.5, 2.0, 0.2, 0.75],
		[-0.4, 2.1, -0.3, 0.8],
	] as const;
	for (const [x, y, z, r] of spread) {
		const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat);
		leaf.position.set(x, y, z);
		leaf.castShadow = true;
		group.add(leaf);
	}
	return group;
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
