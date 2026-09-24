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

export function createMonitor(): THREE.Group {
	const group = new THREE.Group();
	const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), new THREE.MeshStandardMaterial({ color: '#202124' }));
	stand.position.y = 0.15;
	group.add(stand);
	const screen = new THREE.Mesh(
		new THREE.BoxGeometry(0.44, 0.26, 0.03),
		new THREE.MeshStandardMaterial({ color: '#0b0c0d', emissive: '#123a44', emissiveIntensity: 0.5 })
	);
	screen.position.y = 0.42;
	group.add(screen);
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

/** Окно: остеклённая ниша на внутренней поверхности стены. */
export function createWindow(width: number, height: number): THREE.Mesh {
	return new THREE.Mesh(
		new THREE.PlaneGeometry(width, height),
		new THREE.MeshStandardMaterial({ color: '#3c4b52', emissive: '#1c2a30', emissiveIntensity: 0.4 })
	);
}

export function createKeyboard(): THREE.Mesh {
	const kb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: '#2a2a2c' }));
	kb.castShadow = true;
	return kb;
}

export function createMouse(): THREE.Mesh {
	const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.1), new THREE.MeshStandardMaterial({ color: '#2a2a2c' }));
	mouse.castShadow = true;
	return mouse;
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

export function createMug(): THREE.Group {
	const group = new THREE.Group();
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8), new THREE.MeshStandardMaterial({ color: '#c94f3d' }));
	body.position.y = 0.04;
	body.castShadow = true;
	group.add(body);
	const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 8), new THREE.MeshStandardMaterial({ color: '#c94f3d' }));
	handle.position.set(0.045, 0.04, 0);
	handle.rotation.y = Math.PI / 2;
	group.add(handle);
	return group;
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
