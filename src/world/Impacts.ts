import * as THREE from 'three';

/**
 * Эффекты дроби — только картинка, на попадания не влияют: светящиеся росчерки дробин от дульного среза до цели,
 * следы на поверхностях (тёмные щербинки) и облачка пыли там, куда дробина долетела.
 * Следы остаются в сцене, где появились; самые старые убираются, когда их больше MAX_DECALS.
 */

/** Скорость росчерка, м/с — медленнее настоящей дроби, чтобы его было видно. */
const STREAK_SPEED = 90;
const STREAK_LENGTH = 0.35;
const MAX_DECALS = 400;
const DUST_LIFE = 0.45;
const DUST_GRAVITY = 2.5;

/** Куда долетает дробина: точка и нормаль поверхности (null — ни во что не попала, след не нужен). */
export interface PelletEnd {
	point: THREE.Vector3;
	normal: THREE.Vector3 | null;
}

interface Streak {
	mesh: THREE.Mesh;
	from: THREE.Vector3;
	dir: THREE.Vector3;
	distance: number;
	traveled: number;
	end: PelletEnd;
}

interface Dust {
	mesh: THREE.Mesh;
	velocity: THREE.Vector3;
	life: number;
}

export class Impacts {
	private readonly streaks: Streak[] = [];
	private readonly dust: Dust[] = [];
	private readonly decals: THREE.Mesh[] = [];
	private readonly streakGeometry = new THREE.BoxGeometry(0.006, 0.006, STREAK_LENGTH);
	private readonly streakMaterial = new THREE.MeshBasicMaterial({
		color: '#ffe0a0',
		transparent: true,
		opacity: 0.85,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		fog: false,
	});
	private readonly decalGeometry = new THREE.CircleGeometry(0.013, 6);
	/** Смещение глубины — чтобы след не мерцал, лёжа прямо на стене. */
	private readonly decalMaterial = new THREE.MeshStandardMaterial({
		color: '#1b1815',
		roughness: 1,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2,
	});
	private readonly dustGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
	private readonly dustMaterial = new THREE.MeshStandardMaterial({ color: '#8f887c', roughness: 1 });
	private scene: THREE.Scene | null = null;

	/** Выстрел: росчерки из muzzle к каждой точке ends; долетев, дробина оставляет след и пыль. */
	shot(scene: THREE.Scene, muzzle: THREE.Vector3, ends: PelletEnd[]): void {
		this.scene = scene;
		for (const end of ends) {
			const dir = end.point.clone().sub(muzzle);
			const distance = dir.length();
			if (distance < 0.01) continue;
			dir.divideScalar(distance);
			const mesh = new THREE.Mesh(this.streakGeometry, this.streakMaterial);
			mesh.position.copy(muzzle);
			mesh.lookAt(end.point);
			mesh.visible = false;
			scene.add(mesh);
			// Дробины вылетают не строго разом — росчерки не сливаются в одну вспышку.
			this.streaks.push({ mesh, from: muzzle.clone(), dir, distance, traveled: -Math.random() * 0.6, end });
		}
	}

	update(dt: number): void {
		for (let i = this.streaks.length - 1; i >= 0; i--) {
			const s = this.streaks[i];
			s.traveled += STREAK_SPEED * dt;
			// Хвост росчерка не вылезает назад за дульный срез.
			const head = Math.min(s.traveled, s.distance);
			s.mesh.visible = head > 0;
			s.mesh.position.copy(s.from).addScaledVector(s.dir, Math.max(0, head - STREAK_LENGTH / 2));
			if (s.traveled >= s.distance) {
				s.mesh.removeFromParent();
				this.streaks.splice(i, 1);
				if (s.end.normal) this._impact(s.end.point, s.end.normal);
			}
		}
		for (let i = this.dust.length - 1; i >= 0; i--) {
			const d = this.dust[i];
			d.life -= dt;
			d.velocity.y -= DUST_GRAVITY * dt;
			d.velocity.multiplyScalar(1 - dt * 3);
			d.mesh.position.addScaledVector(d.velocity, dt);
			d.mesh.scale.setScalar(Math.max(0.01, d.life / DUST_LIFE));
			if (d.life <= 0) {
				d.mesh.removeFromParent();
				this.dust.splice(i, 1);
			}
		}
	}

	/** След-щербинка на поверхности (повёрнут по нормали, случайного размера) и облачко пыли от неё. */
	private _impact(point: THREE.Vector3, normal: THREE.Vector3): void {
		if (!this.scene) return;
		const decal = new THREE.Mesh(this.decalGeometry, this.decalMaterial);
		decal.position.copy(point).addScaledVector(normal, 0.002);
		decal.lookAt(point.clone().add(normal));
		decal.rotateZ(Math.random() * Math.PI);
		decal.scale.setScalar(0.6 + Math.random() * 0.8);
		decal.receiveShadow = true;
		this.scene.add(decal);
		this.decals.push(decal);
		if (this.decals.length > MAX_DECALS) this.decals.shift()!.removeFromParent();

		if (Math.random() < 0.5) return;
		for (let i = 0; i < 2; i++) {
			const mesh = new THREE.Mesh(this.dustGeometry, this.dustMaterial);
			mesh.position.copy(point);
			this.scene.add(mesh);
			const velocity = normal
				.clone()
				.multiplyScalar(0.4 + Math.random() * 0.5)
				.add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(0.5));
			this.dust.push({ mesh, velocity, life: DUST_LIFE * (0.6 + Math.random() * 0.5) });
		}
	}
}
