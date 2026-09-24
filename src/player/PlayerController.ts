import * as THREE from 'three';
import type { Input } from '../core/Input.js';
import type { CircleColliders } from '../physics/CircleColliders.js';

const WALK_SPEED = 2.2;
const SPRINT_SPEED = 4.5;
const EYE_HEIGHT = 1.7;
const RADIUS = 0.35;
const GRAVITY = 20;
const JUMP_SPEED = 7;
/** Пройденный по земле путь между шагами, м: шагом — короче, бегом — шире. */
const STEP_LENGTH = 1.1;
const SPRINT_STEP_LENGTH = 1.6;
/** Максимальный спуск за кадр, при котором игрок «прилипает» к земле, а не падает. */
const STEP_DOWN = 0.5;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.01;

export interface Ground {
	getHeightAt(x: number, z: number): number;
}

/** Контроллер от первого лица: WASD/Shift — движение, Space — прыжок, мышь — обзор. */
export class PlayerController {
	yaw = 0;
	pitch = 0;
	velocityY = 0;
	grounded = true;
	/** Вызывается на каждом шаге по земле; loud > 1 — бег или приземление. */
	onStep: ((loud: number) => void) | null = null;
	/** Направление взгляда в плоскости XZ (нормированное). */
	readonly forward = new THREE.Vector3(0, 0, -1);
	private stepDistance = 0;
	/** Высота глаз сидя; null — стоим. Сидя камера неподвижна: взгляд — на стол, пока не встанешь. */
	private seatedEyeY: number | null = null;
	private readonly move = new THREE.Vector3();

	constructor(
		private readonly camera: THREE.PerspectiveCamera,
		private readonly input: Input,
		private readonly ground: Ground,
		/** Не readonly: при смене сцены (офис/улица) Game подставляет свой набор коллайдеров. */
		public colliders: CircleColliders
	) {
		this.camera.rotation.order = 'YXZ';
	}

	/** Поставить игрока в точку (x, z) на землю и повернуть на yaw. */
	spawn(x: number, z: number, yaw: number): void {
		this.camera.position.set(x, 0, z);
		this.camera.position.y = this._groundEyeY();
		this.yaw = yaw;
		this.pitch = 0;
		this.velocityY = 0;
		this.grounded = true;
		this._applyRotation();
	}

	/** Сесть: камера над табуреткой на высоте eyeY, взгляд — по yaw и чуть вниз, на стол. */
	sit(x: number, z: number, yaw: number, eyeY: number): void {
		this.camera.position.set(x, eyeY, z);
		this.seatedEyeY = eyeY;
		this.yaw = yaw;
		this.pitch = -0.45;
		this.velocityY = 0;
		this.grounded = true;
		this._applyRotation();
	}

	/** Катсцена: поставить глаза и взгляд напрямую (сидя — мышь и ходьба и так не работают). */
	setPose(x: number, y: number, z: number, yaw: number, pitch: number): void {
		this.camera.position.set(x, y, z);
		this.yaw = yaw;
		this.pitch = pitch;
		this._applyRotation();
	}

	/** Встать в точке (x, z), взгляд — прежний. */
	stand(x: number, z: number): void {
		this.seatedEyeY = null;
		const pitch = this.pitch;
		this.spawn(x, z, this.yaw);
		this.pitch = pitch;
		this._applyRotation();
	}

	update(dt: number): void {
		this._updateLook();
		if (this.seatedEyeY !== null) return;
		this._updateMovement(dt);
		this._updateVertical(dt);
	}

	private _groundEyeY(): number {
		const { x, z } = this.camera.position;
		return this.ground.getHeightAt(x, z) + EYE_HEIGHT;
	}

	private _applyRotation(): void {
		this.camera.rotation.set(this.pitch, this.yaw, 0);
		this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
	}

	private _updateVertical(dt: number): void {
		const pos = this.camera.position;

		if (this.grounded && this.input.isDown('Space')) {
			this.velocityY = JUMP_SPEED;
			this.grounded = false;
		}

		if (this.grounded) {
			// Идём по земле: липнем к ней при небольшом спуске, иначе начинаем падать.
			const targetY = this._groundEyeY();
			if (pos.y - targetY <= STEP_DOWN) {
				pos.y = targetY;
				return;
			}
			this.grounded = false;
			this.velocityY = 0;
		}

		this.velocityY -= GRAVITY * dt;
		pos.y += this.velocityY * dt;

		const groundY = this._groundEyeY();
		if (pos.y <= groundY && this.velocityY <= 0) {
			// Приземление — громкий шаг.
			if (this.velocityY < -3) this.onStep?.(1.6);
			pos.y = groundY;
			this.velocityY = 0;
			this.grounded = true;
		}
	}

	private _updateLook(): void {
		const mouse = this.input.consumeMouseDelta();
		// Сидя мышь не поворачивает камеру (движение сбрасываем, чтобы не было рывка, когда встанешь).
		if (this.seatedEyeY !== null) return;
		this.yaw -= mouse.x * MOUSE_SENSITIVITY;
		this.pitch -= mouse.y * MOUSE_SENSITIVITY;
		this.pitch = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
		this._applyRotation();
	}

	private _updateMovement(dt: number): void {
		const { input } = this;
		const pos = this.camera.position;
		const startX = pos.x;
		const startZ = pos.z;
		const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
		const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

		if (forward !== 0 || strafe !== 0) {
			const speed = input.isDown('ShiftLeft') ? SPRINT_SPEED : WALK_SPEED;
			// Движение только в горизонтальной плоскости, направление — по yaw.
			this.move.set(strafe, 0, -forward).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);
			pos.x += this.move.x * speed * dt;
			pos.z += this.move.z * speed * dt;
		}

		this.colliders.resolve(pos, RADIUS);

		// Шаги считаем по реально пройденному пути (упор в препятствие не даёт шагов).
		if (this.grounded) {
			const sprint = input.isDown('ShiftLeft');
			const stepLength = sprint ? SPRINT_STEP_LENGTH : STEP_LENGTH;
			this.stepDistance += Math.hypot(pos.x - startX, pos.z - startZ);
			if (this.stepDistance >= stepLength) {
				this.stepDistance -= stepLength;
				this.onStep?.(sprint ? 1.3 : 1);
			}
		}
	}
}
