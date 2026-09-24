import * as THREE from 'three';
import { createDogHead } from './DogModel.js';

/** Во сколько раз голова больше модели цвергпинчера: череп ≈ 13 м, с ушами — около 30 м. */
const SCALE = 120;
/** Шея вниз, в единицах модели: уходит под лаву, когда голова поднята. */
const NECK_LENGTH = 0.6;
/** Сколько выстрелов держит. */
const BOSS_HEALTH = 10;
/** Подъём из-под обрыва, с; откуда (глубоко под лавой) и куда поднимается центр черепа, м. */
const RISE_TIME = 2.2;
const HIDDEN_Y = -50;
const RAISED_Y = 24;
/** Голова следит за игроком: как быстро доворачивается (1/с) и насколько может опустить или задрать морду, рад. */
const TRACK_TURN = 2.5;
const TRACK_MAX_PITCH = 0.5;
/** Рёв: сколько голова задрана и трясётся, с. */
const ROAR_TIME = 2.6;
/** Вспышка красным от попадания гаснет за столько секунд. */
const FLASH_TIME = 0.25;
/** Смерть: сначала AGONY_TIME бьётся в агонии (трясётся, пасть нараспашку), потом за SINK_TIME уходит под обрыв. */
export const AGONY_TIME = 2.5;
export const SINK_TIME = 5;
/** Отдача от попадания: голову отбрасывает назад (м) и задирает морду (рад); гаснет за RECOIL_TIME, с. */
const RECOIL_BACK = 4;
const RECOIL_PITCH = 0.3;
const RECOIL_TIME = 0.45;
/** Брызги от попадания: сколько частиц всего (пул) и за выстрел, скорость разлёта (м/с), тяжесть, время жизни (с). */
const SPLASH_POOL = 120;
const SPLASH_PER_HIT = 40;
const SPLASH_SPEED = 12;
const SPLASH_GRAVITY = 25;
const SPLASH_LIFE = 1.2;
/** Атака: огненный шар из пасти раз в ATTACK_PERIOD с; пасть открывается за SPIT_WINDUP до вылета. */
const ATTACK_PERIOD = 3;
const SPIT_WINDUP = 0.5;
/** Шар: скорость (м/с), радиус (м); взрыв задевает игрока ближе EXPLODE_RADIUS (м); улетел дальше — гаснет. */
const FIREBALL_SPEED = 24;
const FIREBALL_RADIUS = 1.05;
const EXPLODE_RADIUS = 2.4;
const FIREBALL_RANGE = 140;
const EXPLOSION_TIME = 0.45;
const EYE_COLOR = '#ff1a0a';
const HALO_COLOR = '#ff2a0c';

/** Мягкое пятно: белое в центре, прозрачное к краю — ореол и свечение глаз (цвет — в материале). */
export function createGlowTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
	gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.6)');
	gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.18)');
	gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/** hidden — ещё под лавой; rising — выныривает; roaring — ревёт; idle — ждёт (бой); sinking — убит, уходит вниз; gone — всё. */
interface Fireball {
	group: THREE.Group;
	glow: THREE.Sprite;
	velocity: THREE.Vector3;
	travelled: number;
}

interface Explosion {
	sprite: THREE.Sprite;
	time: number;
}

type BossState = 'hidden' | 'rising' | 'roaring' | 'idle' | 'sinking' | 'gone';

/**
 * Босс арены — огромная голова адского пса (цвергпинчер из DogModel): выныривает из-под обрыва в открытом секторе,
 * глаза горят красным, вокруг — красный ореол и красный свет. Пока только ревёт и держит BOSS_HEALTH выстрелов;
 * поведение и атаки — потом.
 */
export class DogBoss {
	readonly group = new THREE.Group();
	/** Шары, взрывы и брызги — в мировых координатах, отдельно от головы (живут и после её гибели). Arena кладёт в сцену. */
	readonly effects = new THREE.Group();
	/** Можно атаковать (идёт бой) — ставит Arena. */
	attacking = false;
	/** Пасть открылась для плевка; шар вылетел; шар взорвался — hitPlayer: задел ли игрока. */
	onSpit: (() => void) | null = null;
	onFireballLaunch: (() => void) | null = null;
	onExplode: ((hitPlayer: boolean) => void) | null = null;
	private recoil = 0;
	private attackTimer = ATTACK_PERIOD;
	/** Время с начала плевка, с; null — не плюёт. */
	private spitTime: number | null = null;
	private readonly fireballs: Fireball[] = [];
	private readonly explosions: Explosion[] = [];
	private readonly glowTexture = createGlowTexture();
	private readonly fireballGeometry = new THREE.IcosahedronGeometry(FIREBALL_RADIUS, 1);
	private readonly fireballMaterial = new THREE.MeshBasicMaterial({ color: '#ff3a14', fog: false });
	private readonly fireballCoreMaterial = new THREE.MeshBasicMaterial({ color: '#ffd070', fog: false });
	private readonly splash: THREE.Points;
	private readonly splashVelocity = new Float32Array(SPLASH_POOL * 3);
	private readonly splashLife = new Float32Array(SPLASH_POOL);
	private splashNext = 0;
	private readonly head: THREE.Group;
	private readonly jaw: THREE.Group;
	private readonly halo: THREE.Sprite;
	private readonly light = new THREE.PointLight('#ff3a18', 0, 90, 0);
	/** Все материалы головы — для вспышки при попадании. */
	private readonly materials: THREE.MeshStandardMaterial[] = [];
	private state: BossState = 'hidden';
	private stateTime = 0;
	private time = 0;
	private health = BOSS_HEALTH;
	private flash = 0;
	/** Куда сейчас повёрнута голова вслед за игроком (плавно): поворот и наклон морды вниз, рад. */
	private lookYaw = 0;
	private lookPitch = 0;

	/** x, z — где стоит шея (центр черепа над ней); голова смотрит на +Z. */
	constructor(private readonly x: number, private readonly z: number) {
		const { root, eyes, jaw } = createDogHead(NECK_LENGTH);
		this.head = root;
		this.jaw = jaw;
		this.head.scale.setScalar(SCALE);
		// Сначала поворот за игроком, потом наклон морды — в его осях.
		this.head.rotation.order = 'YXZ';
		this.group.add(this.head);
		const glow = createGlowTexture();
		// Глаза горят сами (без освещения) и светятся пятнами поверх.
		for (const eye of eyes) {
			eye.material = new THREE.MeshBasicMaterial({ color: EYE_COLOR });
			const eyeGlow = new THREE.Sprite(
				new THREE.SpriteMaterial({ map: glow, color: EYE_COLOR, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
			);
			eyeGlow.position.copy(eye.position).add(new THREE.Vector3(0, 0, 0.012));
			eyeGlow.scale.setScalar(0.07);
			this.head.add(eyeGlow);
		}
		// Ореол — за черепом: голова закрывает его середину, вокруг — красное сияние.
		this.halo = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: glow,
				color: HALO_COLOR,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				transparent: true,
				fog: false,
			})
		);
		this.halo.position.set(0, 0.02, -0.09);
		this.head.add(this.halo);
		this.light.position.set(0, 0.05, 0.2);
		this.head.add(this.light);
		this.head.traverse((o) => {
			if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) this.materials.push(o.material);
		});
		// Брызги: пул точек; неживые — далеко внизу.
		const positions = new Float32Array(SPLASH_POOL * 3).fill(-1000);
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		this.splash = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#b01010', size: 0.5 }));
		this.splash.frustumCulled = false;
		this.effects.add(this.splash);
		this.reset();
	}

	get alive(): boolean {
		return this.health > 0;
	}

	/** Выныривает и ревёт (катсцена); по стрельбе — бой, когда roaring закончился. */
	get fighting(): boolean {
		return this.state === 'idle';
	}

	/** Центр черепа в мире — туда смотрит камера в катсцене. */
	get center(): THREE.Vector3 {
		return this.head.getWorldPosition(new THREE.Vector3());
	}

	/** Снова под лавой, здоровье полное (бой заново). */
	reset(): void {
		this.state = 'hidden';
		this.stateTime = 0;
		this.health = BOSS_HEALTH;
		this.flash = 0;
		this.recoil = 0;
		this.attackTimer = ATTACK_PERIOD;
		this.spitTime = null;
		for (const ball of this.fireballs) this.effects.remove(ball.group);
		this.fireballs.length = 0;
		for (const explosion of this.explosions) this.effects.remove(explosion.sprite);
		this.explosions.length = 0;
		this.splashLife.fill(0);
		(this.splash.geometry.attributes.position as THREE.BufferAttribute).array.fill(-1000);
		this.splash.geometry.attributes.position.needsUpdate = true;
		this.group.visible = false;
		this.head.position.set(this.x, HIDDEN_Y, this.z);
		this.head.rotation.set(0, 0, 0);
		this.lookYaw = this.lookPitch = 0;
	}

	/** Начать подъём из-под обрыва. */
	rise(): void {
		this.state = 'rising';
		this.stateTime = 0;
		this.group.visible = true;
	}

	/** Зареветь: голова задирается и трясётся ROAR_TIME, потом ждёт боя. */
	roar(): void {
		this.state = 'roaring';
		this.stateTime = 0;
	}

	/** Объект — часть головы (для попаданий лучом). */
	owns(object: THREE.Object3D): boolean {
		for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o === this.group) return true;
		return false;
	}

	/** Попадание: вспышка красным; на нуле — уходит вниз. Возвращает, убит ли этим выстрелом. */
	hit(point: THREE.Vector3, direction: THREE.Vector3): boolean {
		if (!this.alive || !this.fighting) return false;
		this.health--;
		this.flash = 1;
		this.recoil = 1;
		this._splash(point, direction);
		if (this.alive) return false;
		this.state = 'sinking';
		this.stateTime = 0;
		// Шары в полёте гаснут — в катсцене смерти игрока не заденет.
		for (const ball of this.fireballs) this.effects.remove(ball.group);
		this.fireballs.length = 0;
		this.spitTime = null;
		return true;
	}

	/** player — где глаза игрока: голова поворачивается за ним. */
	update(dt: number, player: THREE.Vector3): void {
		this._updateAttack(dt, player);
		this._updateFireballs(dt, player);
		this._updateSplash(dt);
		this._updateHead(dt, player);
	}

	private _updateHead(dt: number, player: THREE.Vector3): void {
		if (this.state === 'hidden' || this.state === 'gone') return;
		this.time += dt;
		this.stateTime += dt;
		const t = this.stateTime;
		const head = this.head;
		// Дыхание: чуть покачивается вверх-вниз и поводит мордой (поверх слежения за игроком).
		const breathe = Math.sin(this.time * 1.4) * 0.9;
		const sway = Math.sin(this.time * 0.7) * 0.04;
		let glow = 1;
		// Пасть: чуть приоткрыта и дышит; в рёве — распахнута.
		let jawOpen = 0.08 + Math.max(0, Math.sin(this.time * 1.4)) * 0.06;
		// Следит за игроком: морда (+Z) — на него, чуть вниз, к глазам. Убитый уже не следит.
		if (this.state !== 'sinking') {
			const dx = player.x - head.position.x;
			const dz = player.z - head.position.z;
			const yaw = Math.atan2(dx, dz);
			const pitch = THREE.MathUtils.clamp(Math.atan2(head.position.y - player.y, Math.hypot(dx, dz)), -TRACK_MAX_PITCH, TRACK_MAX_PITCH);
			const k = 1 - Math.exp(-dt * TRACK_TURN);
			this.lookYaw += (THREE.MathUtils.euclideanModulo(yaw - this.lookYaw + Math.PI, Math.PI * 2) - Math.PI) * k;
			this.lookPitch += (pitch - this.lookPitch) * k;
		}
		const yaw = this.lookYaw;
		const pitch = this.lookPitch;

		if (this.state === 'rising') {
			// Выныривает с перелётом вверх и оседает (ease-out-back).
			const k = Math.min(1, t / RISE_TIME);
			const c = 1.4;
			const ease = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
			head.position.y = HIDDEN_Y + (RAISED_Y - HIDDEN_Y) * ease;
			head.rotation.set(pitch + 0.25 * (1 - k), yaw, 0);
			glow = k;
			if (k >= 1) this.state = 'idle';
		} else if (this.state === 'roaring') {
			// Задирает морду к небу, трясётся; к концу — опускает.
			const k = Math.min(1, t / ROAR_TIME);
			const lift = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.75) / 0.25);
			const shake = lift * 0.03;
			head.position.y = RAISED_Y + lift * 1.5 + (Math.random() - 0.5) * shake * 20;
			head.rotation.set(pitch * (1 - lift) - 0.45 * lift + (Math.random() - 0.5) * shake, yaw + (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
			glow = 1 + lift * 0.8;
			jawOpen = 0.1 + lift * 0.75 + (Math.random() - 0.5) * shake * 2;
			if (k >= 1) this.state = 'idle';
		} else if (this.state === 'idle') {
			head.position.y = RAISED_Y + breathe;
			head.rotation.set(pitch + Math.sin(this.time * 0.9) * 0.03, yaw + sway, 0);
		} else if (this.state === 'sinking') {
			if (t < AGONY_TIME) {
				// Агония: морда задрана к небу, голову колотит, пасть нараспашку, свечение мигает.
				const a = t / AGONY_TIME;
				const up = Math.sin(Math.min(1, a * 3) * Math.PI * 0.5);
				const thrash = 0.08 * (1 - a * 0.5);
				head.position.y = RAISED_Y + up * 2 + (Math.random() - 0.5) * 1.2;
				head.rotation.set(
					pitch * (1 - up) - 0.55 * up + (Math.random() - 0.5) * thrash,
					yaw + Math.sin(t * 13) * 0.08 + (Math.random() - 0.5) * thrash,
					Math.sin(t * 9) * 0.1 + (Math.random() - 0.5) * thrash
				);
				jawOpen = 0.9 + (Math.random() - 0.5) * 0.3;
				glow = 1 + (Math.random() - 0.5) * 0.8;
				this.flash = Math.max(this.flash, Math.random() < 0.15 ? 0.6 : 0);
			} else {
				// Уходит под обрыв: сначала медленно, потом быстрее; никнет мордой, заваливается набок, свечение гаснет.
				const k = Math.min(1, (t - AGONY_TIME) / SINK_TIME);
				const shake = (1 - k) * 0.5;
				head.position.y = RAISED_Y + 2 * (1 - Math.min(1, k * 4)) - (RAISED_Y - HIDDEN_Y) * k * k + (Math.random() - 0.5) * shake;
				head.rotation.set(-0.55 * (1 - Math.min(1, k * 3)) + 0.6 * Math.min(1, k * 2), yaw + sway, 0.25 * k);
				glow = 1 - k;
				// Челюсть отвисает.
				jawOpen = 0.9 - 0.3 * Math.min(1, k * 2);
			}
			if (t >= AGONY_TIME + SINK_TIME) {
				this.state = 'gone';
				this.group.visible = false;
				return;
			}
		}

		// Плевок: пасть распахивается к вылету шара и потом закрывается.
		if (this.spitTime !== null) jawOpen += 0.7 * Math.min(1, this.spitTime / SPIT_WINDUP);
		// Отдача от попадания: отбрасывает назад (от игрока), морда вверх, пасть дёргается.
		this.recoil = Math.max(0, this.recoil - dt / RECOIL_TIME);
		const kick = this.recoil * this.recoil;
		head.position.x = this.x - Math.sin(yaw) * RECOIL_BACK * kick;
		head.position.z = this.z - Math.cos(yaw) * RECOIL_BACK * kick;
		head.rotation.x -= RECOIL_PITCH * kick;
		jawOpen += 0.4 * kick;
		this.jaw.rotation.x = jawOpen;

		// Ореол пульсирует и мерцает, как пламя.
		const pulse = 1 + Math.sin(this.time * 3.1) * 0.06 + Math.sin(this.time * 7.3) * 0.03;
		this.halo.scale.setScalar(0.5 * pulse * (0.6 + 0.4 * Math.min(glow, 1.4)));
		this.halo.material.opacity = Math.min(1, 0.85 * glow);
		this.light.intensity = 2.5 * glow * pulse * (1 + this.flash * 2);

		// Попадание: вся голова вспыхивает красным.
		this.flash = Math.max(0, this.flash - dt / FLASH_TIME);
		for (const material of this.materials) {
			material.emissive.setRGB(this.flash * 2.5, this.flash * 0.35, this.flash * 0.1);
		}
	}

	/** Раз в ATTACK_PERIOD — плевок: пасть открывается, через SPIT_WINDUP из неё летит шар туда, где сейчас игрок. */
	private _updateAttack(dt: number, player: THREE.Vector3): void {
		if (this.spitTime !== null) {
			const before = this.spitTime;
			this.spitTime += dt;
			if (before < SPIT_WINDUP && this.spitTime >= SPIT_WINDUP && this.alive) this._launch(player);
			if (this.spitTime >= SPIT_WINDUP + 0.6) this.spitTime = null;
			return;
		}
		if (!this.attacking || !this.alive || !this.fighting) return;
		this.attackTimer -= dt;
		if (this.attackTimer > 0) return;
		this.attackTimer = ATTACK_PERIOD;
		this.spitTime = 0;
		this.onSpit?.();
	}

	/** Шар вылетает из пасти прямо в глаза игроку (где он сейчас; успеешь отойти — промахнётся). */
	private _launch(player: THREE.Vector3): void {
		// Точка вылета — перед пастью, между верхней и открытой нижней челюстью (в осях головы).
		this.group.updateMatrixWorld(true);
		const mouth = this.head.localToWorld(new THREE.Vector3(0, -0.05, 0.15));
		const group = new THREE.Group();
		group.position.copy(mouth);
		const shell = new THREE.Mesh(this.fireballGeometry, this.fireballMaterial);
		const core = new THREE.Mesh(this.fireballGeometry, this.fireballCoreMaterial);
		core.scale.setScalar(0.55);
		// Сам шар дробь не останавливает — стрелять по голове он не мешает.
		shell.raycast = core.raycast = () => {};
		const glow = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ff3010', blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
		);
		glow.raycast = () => {};
		group.add(shell, core, glow);
		this.effects.add(group);
		const velocity = player.clone().sub(mouth).normalize().multiplyScalar(FIREBALL_SPEED);
		this.fireballs.push({ group, glow, velocity, travelled: 0 });
		this.onFireballLaunch?.();
	}

	/** Шары летят, крутятся и мерцают; задели игрока или пол — взрыв; улетели далеко — гаснут. Взрывы разрастаются и тают. */
	private _updateFireballs(dt: number, player: THREE.Vector3): void {
		for (let i = this.fireballs.length - 1; i >= 0; i--) {
			const ball = this.fireballs[i];
			const { group, velocity } = ball;
			group.position.addScaledVector(velocity, dt);
			ball.travelled += FIREBALL_SPEED * dt;
			group.rotation.x += dt * 5;
			group.rotation.y += dt * 7;
			ball.glow.scale.setScalar(FIREBALL_RADIUS * (6.5 + Math.random() * 1.5));
			const nearPlayer = group.position.distanceTo(player) < FIREBALL_RADIUS + 0.5;
			const onGround = group.position.y < FIREBALL_RADIUS * 0.5;
			const tooFar = ball.travelled > FIREBALL_RANGE;
			if (!nearPlayer && !onGround && !tooFar) continue;
			this.effects.remove(group);
			this.fireballs.splice(i, 1);
			if (!nearPlayer && !onGround) continue;
			this._explode(group.position);
			this.onExplode?.(nearPlayer || group.position.distanceTo(player) < EXPLODE_RADIUS);
		}
		for (let i = this.explosions.length - 1; i >= 0; i--) {
			const explosion = this.explosions[i];
			explosion.time += dt;
			const k = explosion.time / EXPLOSION_TIME;
			if (k >= 1) {
				this.effects.remove(explosion.sprite);
				this.explosions.splice(i, 1);
				continue;
			}
			explosion.sprite.scale.setScalar(2 + k * 9);
			explosion.sprite.material.opacity = 1 - k;
		}
	}

	/** Взрыв шара: оранжевая вспышка разрастается и тает. */
	private _explode(at: THREE.Vector3): void {
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.glowTexture,
				color: '#ff6a20',
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				transparent: true,
				fog: false,
			})
		);
		sprite.raycast = () => {};
		sprite.position.copy(at);
		this.effects.add(sprite);
		this.explosions.push({ sprite, time: 0 });
	}

	/** Брызги крови из точки попадания — назад, к стрелку, веером. */
	private _splash(point: THREE.Vector3, direction: THREE.Vector3): void {
		const pos = this.splash.geometry.attributes.position as THREE.BufferAttribute;
		for (let n = 0; n < SPLASH_PER_HIT; n++) {
			const i = this.splashNext;
			this.splashNext = (this.splashNext + 1) % SPLASH_POOL;
			pos.setXYZ(i, point.x, point.y, point.z);
			const speed = SPLASH_SPEED * (0.3 + Math.random() * 0.7);
			this.splashVelocity[i * 3] = (-direction.x + (Math.random() - 0.5) * 1.6) * speed;
			this.splashVelocity[i * 3 + 1] = (-direction.y + Math.random() * 1.2) * speed;
			this.splashVelocity[i * 3 + 2] = (-direction.z + (Math.random() - 0.5) * 1.6) * speed;
			this.splashLife[i] = SPLASH_LIFE * (0.6 + Math.random() * 0.4);
		}
		pos.needsUpdate = true;
	}

	/** Брызги летят и падают; отжившие — прячем вниз. */
	private _updateSplash(dt: number): void {
		const pos = this.splash.geometry.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < SPLASH_POOL; i++) {
			if (this.splashLife[i] <= 0) continue;
			this.splashLife[i] -= dt;
			if (this.splashLife[i] <= 0) {
				pos.setXYZ(i, 0, -1000, 0);
				continue;
			}
			this.splashVelocity[i * 3 + 1] -= SPLASH_GRAVITY * dt;
			pos.setXYZ(
				i,
				pos.getX(i) + this.splashVelocity[i * 3] * dt,
				pos.getY(i) + this.splashVelocity[i * 3 + 1] * dt,
				pos.getZ(i) + this.splashVelocity[i * 3 + 2] * dt
			);
		}
		pos.needsUpdate = true;
	}
}
