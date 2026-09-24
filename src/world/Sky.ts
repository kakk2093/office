import * as THREE from 'three';

/** Цвета неба: ровная пасмурная серость почти без перепада (перепад и тёплое солнце читаются как вечер). */
export const SKY_ZENITH = '#8c8f92';
export const SKY_HORIZON = '#9b9a96';
const SKY_SUN = '#a9a8a4';
/** Направление на солнце — низко над горизонтом, на юго-западе (за спиной у выходящего из подъезда — сбоку). */
export const SUN_DIRECTION = new THREE.Vector3(-0.6, 0.22, 0.75).normalize();

const DOME_RADIUS = 90;
/** Облака — сеткой GRID × GRID на квадрате 2·CLOUD_AREA со случайным сдвигом: крупные и не кучкуются. */
const CLOUD_GRID = 4;
const CLOUD_AREA = 64;
const CLOUD_JITTER = 7;
/** Выше 17-этажки (51 м): облака не залезают в дом. */
const CLOUD_HEIGHT = 58;
const CLOUD_OPACITY = 0.85;
/** По горизонтали от камеры: дальше FADE_START облако тает, к FADE_END исчезает — там оно и переносится на другой край. */
const CLOUD_FADE_START = 44;
const CLOUD_FADE_END = 62;
/** Ветер, м/с — облака плывут через небо. */
const WIND = new THREE.Vector2(1.6, 0.5);

interface Cloud {
	mesh: THREE.Group;
	/** Мировая позиция в момент t = 0. */
	baseX: number;
	baseZ: number;
	materials: THREE.MeshBasicMaterial[];
}

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
	vDir = normalize(position);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
	vec3 dir = normalize(vDir);
	float h = max(dir.y, 0.0);
	vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.55, pow(h, 0.8)));
	float sun = max(dot(dir, sunDir), 0.0);
	// Солнца за тучами не видно — только чуть светлее та сторона неба.
	color = mix(color, sunColor, pow(sun, 4.0) * 0.25);
	gl_FragColor = vec4(color, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Небесный купол с градиентом и слой низкополи-облаков. Купол следует за камерой (см. update), туман на него не действует. */
export class Sky {
	readonly group = new THREE.Group();
	private readonly clouds: Cloud[] = [];
	private time = 0;

	constructor() {
		const dome = new THREE.Mesh(
			new THREE.SphereGeometry(DOME_RADIUS, 24, 12),
			new THREE.ShaderMaterial({
				vertexShader: VERTEX,
				fragmentShader: FRAGMENT,
				uniforms: {
					zenith: { value: new THREE.Color(SKY_ZENITH) },
					horizon: { value: new THREE.Color(SKY_HORIZON) },
					sunColor: { value: new THREE.Color(SKY_SUN) },
					sunDir: { value: SUN_DIRECTION },
				},
				side: THREE.BackSide,
				depthWrite: false,
				fog: false,
			})
		);
		dome.renderOrder = -1;
		this.group.add(dome);

		this._buildClouds();
	}

	/** Купол — вокруг камеры; облака плывут по ветру в мире и заворачиваются по квадрату вокруг камеры, плавно тая у краёв. */
	update(dt: number, cameraPosition: THREE.Vector3): void {
		this.time += dt;
		this.group.position.set(cameraPosition.x, 0, cameraPosition.z);
		const size = CLOUD_AREA * 2;
		const wrap = (v: number) => ((((v + CLOUD_AREA) % size) + size) % size) - CLOUD_AREA;
		for (const cloud of this.clouds) {
			const x = wrap(cloud.baseX + WIND.x * this.time - cameraPosition.x);
			const z = wrap(cloud.baseZ + WIND.y * this.time - cameraPosition.z);
			cloud.mesh.position.x = x;
			cloud.mesh.position.z = z;
			const fade = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), CLOUD_FADE_START, CLOUD_FADE_END);
			for (const m of cloud.materials) m.opacity = CLOUD_OPACITY * fade;
			cloud.mesh.visible = fade > 0.01;
		}
	}

	/** Облака — вытянутые плоские гряды многогранников без освещения, полупрозрачные и без записи глубины
	 * (иначе пост-эффект обводит их контуром, как камни). Материалы у каждого облака свои — для затухания. */
	private _buildClouds(): void {
		// Детерминированный разброс — чтобы небо было одинаковым при каждом запуске.
		let seed = 7;
		const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		const cell = (CLOUD_AREA * 2) / CLOUD_GRID;

		for (let gx = 0; gx < CLOUD_GRID; gx++) {
			for (let gz = 0; gz < CLOUD_GRID; gz++) {
				const light = new THREE.MeshBasicMaterial({ color: '#6c6e71', fog: false, transparent: true, depthWrite: false });
				const belly = new THREE.MeshBasicMaterial({ color: '#4e5054', fog: false, transparent: true, depthWrite: false });
				const mesh = new THREE.Group();
				mesh.position.y = CLOUD_HEIGHT + rand() * 6;
				mesh.rotation.y = rand() * Math.PI;

				const puffs = 5 + Math.floor(rand() * 3);
				for (let j = 0; j < puffs; j++) {
					// Посередине гряды — крупнее, к краям мельче.
					const t = j / (puffs - 1) - 0.5;
					const r = (6 + rand() * 3) * (1 - Math.abs(t) * 0.8);
					const x = t * puffs * 4.5 + (rand() - 0.5) * 2;
					const z = (rand() - 0.5) * 6;
					const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), light);
					puff.position.set(x, rand() * 1.5, z);
					puff.scale.y = 0.4;
					mesh.add(puff);
					const under = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.9, 0), belly);
					under.position.set(x, -r * 0.18, z);
					under.scale.y = 0.22;
					mesh.add(under);
				}
				this.group.add(mesh);
				this.clouds.push({
					mesh,
					baseX: -CLOUD_AREA + (gx + 0.5) * cell + (rand() - 0.5) * 2 * CLOUD_JITTER,
					baseZ: -CLOUD_AREA + (gz + 0.5) * cell + (rand() - 0.5) * 2 * CLOUD_JITTER,
					materials: [light, belly],
				});
			}
		}
	}
}
