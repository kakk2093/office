import * as THREE from 'three';
import type { CircleColliders } from '../physics/CircleColliders.js';
import { Zombie } from './People.js';

/**
 * Арена — ад, как в Doom: круглая площадка из потрескавшейся тёмно-красной породы с раскалёнными трещинами.
 * Сбоков и сзади (от места появления) её обступают острые скалы; спереди скал нет — край обрывается к лавовому
 * морю, за ним в дымке — горы. Небо красное, но светлое: весь свет тёплый и яркий, туман — цвета горизонта.
 * Вокруг поднимаются искры. Отдельная сцена, как офис, улица и столовая.
 */

/** Радиус площадки, м; игрок держится внутри (см. Game, клэмп по кругу). */
export const ARENA_RADIUS = 20;
/** Спереди (от места появления, по −Z) скал нет — открытый сектор, ±рад от направления −Z. */
const OPEN_HALF_ANGLE = 0.85;
/** Площадка — плита толщиной CLIFF: снаружи видно её обрыв к лаве. */
const CLIFF = 9;
const LAVA_Y = -CLIFF + 1.5;
const SKY_HORIZON = new THREE.Color('#ff9868');
const SKY_MID = new THREE.Color('#e4583c');
const SKY_ZENITH = new THREE.Color('#a8203a');
const FOG = new THREE.Color('#ee7550');
const EMBERS = 350;
/** Искры поднимаются в цилиндре вокруг арены такого радиуса и высоты. */
const EMBER_RADIUS = 28;
const EMBER_HEIGHT = 18;
/** Зомби на арене: сколько, не ближе какого расстояния к месту появления игрока, скорость — случайно в пределах. */
const ZOMBIE_COUNT = 15;
const ZOMBIE_MIN_DISTANCE = 12;
const ZOMBIE_SPEED: [number, number] = [1.0, 1.7];

/** Детерминированный генератор случайных чисел — арена одинаковая при каждом запуске. */
function random(seed: number): () => number {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function pixelTexture(canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeat, repeat);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * Адская порода: пятнистый тёмно-красно-бурый камень с раскалёнными трещинами (случайные ломаные).
 * Возвращает цвет и карту свечения — светятся только трещины.
 */
function createHellRockTextures(repeat: number, seed: number, cracks = true): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
	const size = 64;
	const rand = random(seed);
	const color = document.createElement('canvas');
	const glow = document.createElement('canvas');
	color.width = color.height = glow.width = glow.height = size;
	const c = color.getContext('2d')!;
	const g = glow.getContext('2d')!;
	const palette = ['#4a1a14', '#55201a', '#3e1510', '#5e2a1e', '#44180f', '#6a2c20', '#382018'];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			c.fillStyle = palette[Math.floor(rand() * palette.length)];
			c.fillRect(x, y, 1, 1);
		}
	}
	// Крупные тёмные пятна — «плиты» породы.
	for (let i = 0; i < 14; i++) {
		c.fillStyle = rand() < 0.5 ? 'rgba(20, 6, 4, 0.35)' : 'rgba(120, 50, 30, 0.2)';
		const w = 4 + rand() * 10;
		c.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), w, w * (0.5 + rand()));
	}
	g.fillStyle = '#000';
	g.fillRect(0, 0, size, size);
	if (cracks) {
		// Трещины: ломаные из пикселей, с заворотом через край (текстура тайлится без шва).
		for (let i = 0; i < 7; i++) {
			let x = rand() * size;
			let y = rand() * size;
			let angle = rand() * Math.PI * 2;
			const length = 12 + rand() * 26;
			for (let j = 0; j < length; j++) {
				angle += (rand() - 0.5) * 0.9;
				x = (x + Math.cos(angle) + size) % size;
				y = (y + Math.sin(angle) + size) % size;
				const px = Math.floor(x);
				const py = Math.floor(y);
				c.fillStyle = rand() < 0.3 ? '#ffd060' : '#ff7a1a';
				c.fillRect(px, py, 1, 1);
				g.fillStyle = '#ffffff';
				g.fillRect(px, py, 1, 1);
				// Тёмная кромка вокруг трещины.
				c.fillStyle = '#1c0806';
				c.fillRect((px + 1) % size, py, 1, 1);
			}
		}
	}
	return { map: pixelTexture(color, repeat), glow: pixelTexture(glow, repeat) };
}

/** Лава: оранжево-жёлтые разводы с тёмной коркой; сдвигается по времени (update). */
function createLavaTexture(repeat: number): THREE.CanvasTexture {
	const size = 64;
	const rand = random(7);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const wave = Math.sin(x * 0.3 + Math.sin(y * 0.2) * 2) + Math.sin(y * 0.25 + x * 0.1);
			const v = wave + rand() * 0.8;
			ctx.fillStyle = v > 1.2 ? '#ffe070' : v > 0.4 ? '#ff9a20' : v > -0.6 ? '#e8501a' : '#6a1a0c';
			ctx.fillRect(x, y, 1, 1);
		}
	}
	return pixelTexture(canvas, repeat);
}

/** Острая скала: икосаэдр с раздёрганными вершинами, вытянутый вверх; грани — плоские (низкополи). */
function createRock(rand: () => number, material: THREE.Material, width: number, height: number): THREE.Mesh {
	const geometry = new THREE.IcosahedronGeometry(1, 1);
	const pos = geometry.attributes.position;
	// Одинаковые вершины (на стыках граней) сдвигаем одинаково — иначе в скале дыры.
	const offsets = new Map<string, THREE.Vector3>();
	const v = new THREE.Vector3();
	for (let i = 0; i < pos.count; i++) {
		v.fromBufferAttribute(pos, i);
		const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
		let offset = offsets.get(key);
		if (!offset) offsets.set(key, (offset = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5)));
		v.add(offset);
		// Кверху сужается — пик.
		const taper = 1 - Math.max(0, v.y) * 0.55;
		pos.setXYZ(i, v.x * taper, v.y, v.z * taper);
	}
	geometry.computeVertexNormals();
	const rock = new THREE.Mesh(geometry, material);
	rock.scale.set(width, height / 2, width * (0.7 + rand() * 0.6));
	rock.castShadow = rock.receiveShadow = true;
	return rock;
}

export class Arena {
	readonly scene = new THREE.Scene();
	/** Появление — у задней стены скал, лицом к открытому краю и лавовому морю (yaw 0 — взгляд на −Z). */
	readonly spawnPoint = { x: 0, z: ARENA_RADIUS - 4, yaw: 0 };
	private readonly lavaTexture = createLavaTexture(40);
	private readonly embers: THREE.Points;
	private readonly emberSpeed: Float32Array;
	private time = 0;
	/** Зомби арены — сразу охотятся на игрока; Game регистрирует их как врагов. */
	readonly zombies: Zombie[] = [];

	constructor(private readonly colliders: CircleColliders) {
		this.scene.background = SKY_HORIZON.clone();
		this.scene.fog = new THREE.Fog(FOG, 28, 170);
		// Свет — тёплый и яркий: ад светлый, а не тёмный.
		this.scene.add(new THREE.HemisphereLight('#ffc8a8', '#6a2416', 1.6));
		this.scene.add(new THREE.AmbientLight('#ff9a7a', 0.35));
		const sun = new THREE.DirectionalLight('#ffd2a8', 1.6);
		sun.position.set(-16, 28, -20);
		sun.castShadow = true;
		sun.shadow.camera.left = sun.shadow.camera.bottom = -ARENA_RADIUS - 6;
		sun.shadow.camera.right = sun.shadow.camera.top = ARENA_RADIUS + 6;
		sun.shadow.camera.far = 90;
		sun.shadow.mapSize.set(2048, 2048);
		this.scene.add(sun, sun.target);

		this._buildSky();
		this._buildGround();
		this._buildRocks();
		this._buildLava();
		this._buildMountains();

		const { points, speed } = this._buildEmbers();
		this.embers = points;
		this.emberSpeed = speed;
		this.scene.add(points);
		this.restartFight();
	}

	/** Задача: перебить всех. */
	get objective(): { text: string; at: THREE.Vector3 | null } | null {
		const killed = this.zombies.filter((zombie) => !zombie.alive).length;
		if (killed >= this.zombies.length) return null;
		return { text: `Убей всех (${killed}/${this.zombies.length})`, at: null };
	}

	/**
	 * Бой заново (и в начале): старые зомби с останками и кровью убираются, новые — в случайных местах по арене,
	 * не ближе ZOMBIE_MIN_DISTANCE к месту появления, лицом к нему, и сразу идут на игрока. Game после этого
	 * заново регистрирует zombies.
	 */
	restartFight(): void {
		for (const zombie of this.zombies) zombie.dispose();
		this.zombies.length = 0;
		const { x: sx, z: sz } = this.spawnPoint;
		// Куски тела отскакивают в пределах арены (квадрат вокруг круга — грубо, но за скалы почти не улетают).
		const edge = ARENA_RADIUS - 1;
		for (let i = 0; i < ZOMBIE_COUNT; i++) {
			let x = 0;
			let z = 0;
			do {
				const a = Math.random() * Math.PI * 2;
				const r = Math.sqrt(Math.random()) * (ARENA_RADIUS - 3);
				x = Math.sin(a) * r;
				z = Math.cos(a) * r;
			} while (Math.hypot(x - sx, z - sz) < ZOMBIE_MIN_DISTANCE);
			// Адские — в тёмном, без колпаков.
			const zombie = new Zombie(true);
			zombie.bounds = { minX: -edge, maxX: edge, minZ: -edge, maxZ: edge };
			zombie.group.position.set(x, 0, z);
			zombie.group.rotation.y = Math.atan2(sx - x, sz - z);
			zombie.target = new THREE.Vector3(sx, 0, sz);
			zombie.stopDistance = 1.0;
			zombie.speed = ZOMBIE_SPEED[0] + Math.random() * (ZOMBIE_SPEED[1] - ZOMBIE_SPEED[0]);
			zombie.colliders = this.colliders;
			zombie.hunting = true;
			this.scene.add(zombie.group);
			this.zombies.push(zombie);
		}
	}

	/** Пол ровный: высота везде 0. */
	getHeightAt(_x: number, _z: number): number {
		return 0;
	}

	/** Лава течёт, искры поднимаются; зомби идут туда, где игрок (player — где глаза). */
	update(dt: number, player: THREE.Vector3): void {
		this.time += dt;
		for (const zombie of this.zombies) zombie.target?.set(player.x, 0, player.z);
		this.lavaTexture.offset.set(this.time * 0.01, this.time * 0.006);
		const pos = this.embers.geometry.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < pos.count; i++) {
			let y = pos.getY(i) + this.emberSpeed[i] * dt;
			// Долетела до верха — снова снизу, в новом месте.
			if (y > EMBER_HEIGHT) {
				y = -2;
				const a = Math.random() * Math.PI * 2;
				const r = Math.sqrt(Math.random()) * EMBER_RADIUS;
				pos.setX(i, Math.cos(a) * r);
				pos.setZ(i, Math.sin(a) * r);
			}
			pos.setY(i, y);
			pos.setX(i, pos.getX(i) + Math.sin(this.time * 1.3 + i) * dt * 0.3);
		}
		pos.needsUpdate = true;
	}

	/** Небо: сфера с градиентом по высоте — у горизонта светло-оранжевое, выше красное, в зените багровое. */
	private _buildSky(): void {
		const geometry = new THREE.SphereGeometry(400, 24, 16);
		const pos = geometry.attributes.position;
		const colors = new Float32Array(pos.count * 3);
		const c = new THREE.Color();
		for (let i = 0; i < pos.count; i++) {
			const h = THREE.MathUtils.clamp(pos.getY(i) / 400, -1, 1);
			if (h < 0.15) c.copy(SKY_HORIZON);
			else if (h < 0.5) c.lerpColors(SKY_HORIZON, SKY_MID, (h - 0.15) / 0.35);
			else c.lerpColors(SKY_MID, SKY_ZENITH, (h - 0.5) / 0.5);
			c.toArray(colors, i * 3);
		}
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
		this.scene.add(sky);
	}

	/** Площадка — плита из адской породы с раскалёнными трещинами; её боковина — обрыв к лаве. */
	private _buildGround(): void {
		const top = createHellRockTextures(14, 3);
		const floor = new THREE.Mesh(
			new THREE.CircleGeometry(ARENA_RADIUS + 5, 48),
			new THREE.MeshStandardMaterial({
				map: top.map,
				emissiveMap: top.glow,
				emissive: '#ffffff',
				emissiveIntensity: 1.4,
				roughness: 0.95,
				flatShading: true,
			})
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);

		const side = createHellRockTextures(6, 11, false);
		side.map.repeat.set(24, 2);
		const cliff = new THREE.Mesh(
			new THREE.CylinderGeometry(ARENA_RADIUS + 5, ARENA_RADIUS + 3, CLIFF, 48, 1, true),
			new THREE.MeshStandardMaterial({ map: side.map, roughness: 1, flatShading: true })
		);
		cliff.position.y = -CLIFF / 2;
		cliff.receiveShadow = true;
		this.scene.add(cliff);
	}

	/**
	 * Скалы по кругу — кроме открытого сектора спереди: два ряда (ближний пониже, дальний — высокие пики),
	 * случайной ширины и высоты. Игрока держит клэмп по кругу; скалы ещё и коллайдеры — на случай, если зайдут внутрь.
	 */
	private _buildRocks(): void {
		const rand = random(21);
		const rock = createHellRockTextures(2, 5, false);
		const material = new THREE.MeshStandardMaterial({ map: rock.map, roughness: 1, flatShading: true });
		for (const [radius, step, minH, maxH, minW, maxW] of [
			[ARENA_RADIUS + 1.3, 0.17, 3.5, 7, 1.5, 2.7],
			[ARENA_RADIUS + 4.5, 0.2, 8, 16, 2.7, 4.8],
		] as const) {
			for (let a = -Math.PI; a < Math.PI; a += step * (0.7 + rand() * 0.6)) {
				// a = 0 — направление −Z (вперёд от места появления): там открыто.
				if (Math.abs(a) < OPEN_HALF_ANGLE) continue;
				const r = radius + (rand() - 0.5) * 2;
				const x = Math.sin(a) * r;
				const z = -Math.cos(a) * r;
				const height = minH + rand() * (maxH - minH);
				const width = minW + rand() * (maxW - minW);
				const mesh = createRock(rand, material, width, height);
				mesh.position.set(x, height * 0.35, z);
				mesh.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
				this.scene.add(mesh);
				this.colliders.add(x, z, width * 0.8);
			}
		}
		// Скалы по краям открытого сектора — пониже, чтобы проём смотрелся рамой.
		for (const side of [-1, 1]) {
			const a = side * OPEN_HALF_ANGLE;
			const mesh = createRock(rand, material, 2.5, 7);
			mesh.position.set(Math.sin(a) * (ARENA_RADIUS + 1), 2.2, -Math.cos(a) * (ARENA_RADIUS + 1));
			this.scene.add(mesh);
		}
	}

	/** Лавовое море под обрывом — светится само (без освещения), течёт. */
	private _buildLava(): void {
		const lava = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshBasicMaterial({ map: this.lavaTexture }));
		lava.rotation.x = -Math.PI / 2;
		lava.position.y = LAVA_Y;
		this.scene.add(lava);
	}

	/** Горы на горизонте — тёмные низкополи-конусы, в дымке становятся рыжими силуэтами. */
	private _buildMountains(): void {
		const rand = random(33);
		const material = new THREE.MeshStandardMaterial({ color: '#4a1812', roughness: 1, flatShading: true });
		for (let i = 0; i < 22; i++) {
			const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
			const r = 105 + rand() * 50;
			const height = 28 + rand() * 40;
			const mountain = new THREE.Mesh(new THREE.ConeGeometry(19 + rand() * 20, height, 5 + Math.floor(rand() * 3)), material);
			mountain.position.set(Math.sin(a) * r, LAVA_Y + height / 2 - 2, -Math.cos(a) * r);
			mountain.rotation.y = rand() * Math.PI;
			this.scene.add(mountain);
		}
	}

	/** Искры: яркие точки, медленно поднимаются от лавы и земли, чуть виляют. */
	private _buildEmbers(): { points: THREE.Points; speed: Float32Array } {
		const positions = new Float32Array(EMBERS * 3);
		const speed = new Float32Array(EMBERS);
		for (let i = 0; i < EMBERS; i++) {
			const a = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * EMBER_RADIUS;
			positions.set([Math.cos(a) * r, Math.random() * EMBER_HEIGHT - 2, Math.sin(a) * r], i * 3);
			speed[i] = 0.6 + Math.random() * 1.4;
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const material = new THREE.PointsMaterial({
			color: '#ffb048',
			size: 0.09,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			fog: false,
		});
		const points = new THREE.Points(geometry, material);
		// Точки обновляются каждый кадр — рамка для отсечения не пересчитывается, не отсекаем.
		points.frustumCulled = false;
		return { points, speed };
	}
}
