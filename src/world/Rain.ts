import * as THREE from 'three';

/** Слабый дождь: редкие короткие штрихи вокруг камеры. */
const COUNT = 350;
/** Разброс капель вокруг игрока по X/Z, м. */
const AREA = 50;
/** Ближе этого к камере капли не ставим — иначе даже короткий штрих перспективой раздувает в «палку». */
const MIN_DIST = 3;
/** Высота, с которой падают капли (относительно игрока), м. */
const HEIGHT = 24;
/** Заметно быстрее снега — по скорости падения дождь и снег визуально различаются сильнее всего. */
const FALL_SPEED = 20;
const STREAK_LENGTH = 0.22;

/** Дождь: капли-штрихи вокруг камеры, падают и зацикливаются — без спрайтов/текстур. */
export class Rain {
	readonly points: THREE.LineSegments;
	private readonly positions: Float32Array;

	constructor() {
		const geometry = new THREE.BufferGeometry();
		this.positions = new Float32Array(COUNT * 2 * 3);
		for (let i = 0; i < COUNT; i++) {
			const [x, z] = this._randomOffset();
			const y = Math.random() * HEIGHT;
			this._writeDrop(i, x, y, z);
		}
		geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

		const material = new THREE.LineBasicMaterial({ color: '#c9ccd1', transparent: true, opacity: 0.22 });
		this.points = new THREE.LineSegments(geometry, material);
		// Капли летят по всей округе камеры — не даём рендереру их случайно срезать по boundingSphere.
		this.points.frustumCulled = false;
	}

	/** Точка в квадрате AREA вокруг центра, но не ближе MIN_DIST — не даёт каплям возникать вплотную к камере. */
	private _randomOffset(): [number, number] {
		let x = 0;
		let z = 0;
		do {
			x = (Math.random() - 0.5) * AREA;
			z = (Math.random() - 0.5) * AREA;
		} while (x * x + z * z < MIN_DIST * MIN_DIST);
		return [x, z];
	}

	private _writeDrop(i: number, x: number, y: number, z: number): void {
		const o = i * 6;
		this.positions[o] = x;
		this.positions[o + 1] = y;
		this.positions[o + 2] = z;
		this.positions[o + 3] = x;
		this.positions[o + 4] = y - STREAK_LENGTH;
		this.positions[o + 5] = z;
	}

	/** Капли падают вокруг center (камеры); долетевшие до низа — переносятся наверх в новую точку рядом. */
	update(dt: number, center: THREE.Vector3): void {
		const fall = FALL_SPEED * dt;
		for (let i = 0; i < COUNT; i++) {
			const o = i * 6;
			let y = this.positions[o + 1] - fall;
			if (y < center.y - 2) {
				const [dx, dz] = this._randomOffset();
				const x = center.x + dx;
				const z = center.z + dz;
				// Оба конца отрезка должны иметь один X/Z (капля падает строго вниз) — второй конец забыть нельзя.
				this.positions[o] = x;
				this.positions[o + 2] = z;
				this.positions[o + 3] = x;
				this.positions[o + 5] = z;
				y = center.y + HEIGHT * (0.7 + Math.random() * 0.3);
			}
			this.positions[o + 1] = y;
			this.positions[o + 4] = y - STREAK_LENGTH;
		}
		(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
	}
}
