import * as THREE from 'three';

/** Прямоугольник окна в своей сцене: центр стекла, «вправо» для смотрящего наружу, наружу (от помещения). */
export interface PortalFrame {
	center: THREE.Vector3;
	right: THREE.Vector3;
	outward: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Окно-портал: вид на другую сцену (улицу) через стекло в офисе. Камера на улице повторяет положение глаз
 * игрока относительно окна, а её пирамида обрезана ровно по раме (off-axis) и начинается на плоскости стекла —
 * получается настоящий параллакс, как в живом окне, а стена дома за окном не мешает.
 */
export class WindowPortal {
	readonly camera = new THREE.PerspectiveCamera();
	private readonly target: THREE.WebGLRenderTarget;
	private readonly relative = new THREE.Vector3();
	private readonly basis = new THREE.Matrix4();
	private readonly back = new THREE.Vector3();

	/** width × height — размер стекла, м; resolution — ширина картинки в пикселях (низкая — под пиксельный стиль). */
	constructor(
		private readonly renderer: THREE.WebGLRenderer,
		private readonly width: number,
		private readonly height: number,
		resolution = 200
	) {
		this.target = new THREE.WebGLRenderTarget(resolution, Math.round((resolution * height) / width), {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
		});
	}

	/** Картинка за окном — вешается на стекло (UV стекла: u — вправо, v — вверх). */
	get texture(): THREE.Texture {
		return this.target.texture;
	}

	/** Поставить уличную камеру по глазам игрока: from — окно в офисе, to — то же окно в уличной сцене. */
	placeCamera(eye: THREE.Vector3, from: PortalFrame, to: PortalFrame): void {
		this.relative.subVectors(eye, from.center);
		const ru = this.relative.dot(from.right);
		const rv = this.relative.dot(UP);
		// Глаза внутри помещения: вдоль «наружу» координата отрицательная; расстояние до стекла — с запасом от нуля.
		const distance = Math.max(-this.relative.dot(from.outward), 0.05);

		this.camera.position
			.copy(to.center)
			.addScaledVector(to.right, ru)
			.addScaledVector(UP, rv)
			.addScaledVector(to.outward, -distance);
		// Камера смотрит по −Z: её оси — вправо, вверх и «назад» (внутрь помещения).
		this.back.copy(to.outward).negate();
		this.basis.makeBasis(to.right, UP, this.back);
		this.camera.quaternion.setFromRotationMatrix(this.basis);
		this.camera.updateMatrixWorld();

		// Ближняя плоскость — само стекло, края пирамиды — края рамы.
		const near = distance;
		const far = 100;
		this.camera.projectionMatrix.makePerspective(
			-this.width / 2 - ru,
			this.width / 2 - ru,
			this.height / 2 - rv,
			-this.height / 2 - rv,
			near,
			far
		);
		this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
	}

	/** Отрисовать сцену за окном в текстуру стекла. Вызывать после placeCamera. */
	render(scene: THREE.Scene): void {
		const previous = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.target);
		this.renderer.render(scene, this.camera);
		this.renderer.setRenderTarget(previous);
	}
}
