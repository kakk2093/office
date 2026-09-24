import * as THREE from 'three';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { CircleColliders } from '../physics/CircleColliders.js';
import { Room, VIEW_WINDOW_SIZE } from '../world/Room.js';
import { Street } from '../world/Street.js';
import { Canteen, MUSIC_FADE_BITE, BITE_TIME, BITE_AT_MOUTH } from '../world/Canteen.js';
import { PostProcess } from '../render/PostProcess.js';
import { WindowPortal } from '../render/WindowPortal.js';
import { Footsteps } from '../audio/Footsteps.js';
import { Sfx } from '../audio/Sfx.js';
import { Music } from '../audio/Music.js';
import { RainSound } from '../audio/RainSound.js';
import { DreadAmbient } from '../audio/DreadAmbient.js';
import { PLAYER_NAME, type Dialogue, type Interaction, type InteractionSound, type Voice } from './Interaction.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { ObjectiveHud } from '../ui/ObjectiveHud.js';
import { TargetMarker } from '../ui/TargetMarker.js';
import { Letterbox, LETTERBOX_SLIDE_TIME } from '../ui/Letterbox.js';
import { StartScreen } from '../ui/StartScreen.js';
import { SawedOff, type ShotgunSound } from '../world/SawedOff.js';
import { Zombie } from '../world/People.js';
import { Impacts, type PelletEnd } from '../world/Impacts.js';

/** Отступ от стен, на который не пускаем камеру (стены — не коллайдеры, а простой клэмп по границам). */
const WALL_MARGIN = 0.4;
/** Размер «пикселя» в экранных пикселях: чем больше, тем грубее картинка. */
const PIXEL_SIZE = 4;
/** С какого расстояния до двери появляется подсказка E. */
const DOOR_REACH = 2.2;
/** Затемнение при переходе между местами (тёмно-багровое): скрывает смену сцены. Мягкое, не резкое. */
const FLASH_IN = 0.35;
const FLASH_HOLD = 0.15;
const FLASH_OUT = 0.6;
const FLASH_COLOR = '#5c0b14';
/** Высота «голоса» при печати реплик, Гц. */
const VOICE_PITCH: Record<Voice, number> = { dinnerLady: 330, cashier: 260, player: 170 };
/** За сколько секунд затихает музыка, пока игрок доедает солянку. */
const MUSIC_FADE_TIME = 5;
/** Отладка: начинать не в офисе, а на улице перед входом в столовую, лицом к двери. */
const DEBUG_START_AT_CANTEEN = false;
/** Отладка: без стартового экрана и вступления — сразу в геймплей (мышь захватывается по клику в игру). */
const DEBUG_SKIP_INTRO = true;
/** Отладка: обрез в руках, ЛКМ — дуплет (после него сама перезарядка), R — перезарядка. */
const DEBUG_SHOTGUN = true;
/** Обрез в руках — в координатах камеры: справа внизу, дулом чуть к центру экрана. */
const SHOTGUN_HELD_POSITION = new THREE.Vector3(0.16, -0.17, -0.42);
const SHOTGUN_HELD_YAW = 0.06;
/** Размах покачивания обреза при ходьбе, м (в координатах камеры). */
const SHOTGUN_BOB = 0.01;
/** Отладка: зомби-раздатчица в офисе — стоит в свободном углу, лицом к месту старта. */
const DEBUG_ZOMBIE = true;
const ZOMBIE_TEST_POSITION = { x: 1.5, z: 2 };
/** Дуплет: по 9 дробин из ствола (только эффект — попадание считает один луч); разброс — угол конуса, рад; дальше дробь не летит. */
const PELLETS = 18;
const PELLET_SPREAD = 0.06;
const PELLET_RANGE = 40;
/** Сбой картинки и звука (глитч в реплике): сколько длится, с. */
const GLITCH_TIME = 0.4;
/** После «Старт» — столько секунд просто смотрим в окно (без управления), потом начинаются мысли героя. */
const INTRO_DELAY = 1;
/** После вступительного диалога — столько секунд без задачи, потом появляется первая («выйти из офиса»). */
const FIRST_OBJECTIVE_DELAY = 4;
/** Описание на стартовом экране. */
const START_DESCRIPTION = [
	'Очередной рабочий день. Ничего примечательного.',
	'Единственное, что тебя радует, — сегодня четверг. А значит, в столовой соляночка.',
];
/** Граница уличного плейна, за которую не пускаем камеру. */
const STREET_HALF = 74;

/** Где сейчас игрок: у каждого места своя сцена и свои коллайдеры, в пространстве они не связаны. */
type Place = 'office' | 'street' | 'canteen';

/** Композиция: рендерер, цикл, ресайз. Логика — в Room / Street / PlayerController. */
export class Game {
	private readonly renderer = new THREE.WebGLRenderer({ antialias: false });
	private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
	private readonly post = new PostProcess(this.renderer);
	/** Окно офиса — живой вид на улицу (уличная сцена рисуется в текстуру стекла). */
	private readonly portal = new WindowPortal(this.renderer, VIEW_WINDOW_SIZE.width, VIEW_WINDOW_SIZE.height);
	private readonly timer = new THREE.Timer();
	private readonly input: Input;
	private readonly colliders = new CircleColliders();
	private readonly streetColliders = new CircleColliders();
	private readonly canteenColliders = new CircleColliders();
	private readonly footsteps = new Footsteps();
	private readonly sfx = new Sfx();
	private readonly music = new Music();
	private readonly rainSound = new RainSound();
	private readonly dreadAmbient = new DreadAmbient();
	private readonly dialogue = new DialogueBox();
	private readonly objectiveHud = new ObjectiveHud();
	private readonly targetMarker = new TargetMarker();
	private readonly letterbox: Letterbox;
	private readonly hint = document.getElementById('hint')!;
	private readonly prompt = document.getElementById('prompt')!;
	private readonly flash = document.getElementById('flash')!;
	private readonly crosshair = document.getElementById('crosshair')!;
	/** Время с начала перехода, с; null — переход не идёт. */
	private flashTime: number | null = null;
	private flashTeleported = false;
	/** Время с начала глитча, с; null — не идёт. */
	private glitchTime: number | null = null;
	/** Текущее место; рендерится только его сцена. Из офиса — только на улицу (без возврата), улица ⇄ столовая. */
	private place: Place = 'office';
	/** Куда ведёт идущий переход. */
	private destination: Place = 'street';
	/** Вступление у окна офиса ещё не закончилось: стоим на месте, пока герой не договорит. */
	private introPending = false;
	/** Стартовый экран: пока открыт, игра стоит (кадр рисуется, но ничего не обновляется). */
	private readonly startScreen = new StartScreen(START_DESCRIPTION);
	/** Сколько ещё ждать до вступительного диалога после «Старт», с; null — не ждём. */
	private introTimer: number | null = null;
	/** Сколько ещё ждать до показа первой задачи после вступления, с; null — не ждём. */
	private firstObjectiveTimer: number | null = null;
	readonly room: Room;
	readonly street: Street;
	readonly canteen: Canteen;
	readonly player: PlayerController;
	/** Обрез в руках (пока только для отладки, см. DEBUG_SHOTGUN): висит на камере. */
	private readonly shotgun: SawedOff | null = null;
	/** Враги по местам (пока только тестовый зомби в офисе). */
	private readonly zombies: { place: Place; zombie: Zombie }[] = [];
	private readonly raycaster = new THREE.Raycaster();
	/** Росчерки дроби, следы на стенах, пыль. */
	private readonly impacts = new Impacts();

	constructor() {
		this.renderer.setPixelRatio(1);
		this.renderer.shadowMap.enabled = true;
		document.body.appendChild(this.renderer.domElement);

		this.input = new Input(this.renderer.domElement);
		this.room = new Room(this.colliders, this.portal.texture);
		this.street = new Street(this.streetColliders);
		this.canteen = new Canteen(this.canteenColliders);
		this.player = new PlayerController(this.camera, this.input, this.room, this.colliders);
		this.player.onStep = (loud) => this.footsteps.play(loud);
		if (DEBUG_SHOTGUN) {
			this.shotgun = new SawedOff();
			this.shotgun.group.position.copy(SHOTGUN_HELD_POSITION);
			this.shotgun.group.rotation.y = SHOTGUN_HELD_YAW;
			this.camera.add(this.shotgun.group);
			const sounds: Record<ShotgunSound, () => void> = {
				shot: () => this.sfx.shotgun(),
				open: () => this.sfx.shotgunOpen(),
				eject: () => this.sfx.shotgunEject(),
				insert: () => this.sfx.shotgunInsert(),
				close: () => this.sfx.shotgunClose(),
			};
			this.shotgun.onSound = (sound) => sounds[sound]();
		}
		if (DEBUG_ZOMBIE) {
			const zombie = new Zombie();
			const { x, z } = ZOMBIE_TEST_POSITION;
			const { spawnPoint } = this.room;
			zombie.group.position.set(x, 0, z);
			zombie.group.rotation.y = Math.atan2(spawnPoint.x - x, spawnPoint.z - z);
			this.room.scene.add(zombie.group);
			this.colliders.add(x, z, 0.35);
			this.zombies.push({ place: 'office', zombie });
		}
		if (DEBUG_START_AT_CANTEEN) {
			this.place = 'street';
			this.player.colliders = this.streetColliders;
			const { canteenExit } = this.street;
			this.player.spawn(canteenExit.x, canteenExit.z, canteenExit.yaw + Math.PI);
		} else {
			const { spawnPoint } = this.room;
			this.player.spawn(spawnPoint.x, spawnPoint.z, spawnPoint.yaw);
			this.introPending = !DEBUG_SKIP_INTRO;
		}
		// Кинорамка — на каждый диалог (и на вступление: выезжает вместе с ним, через секунду после «Старт»).
		this.letterbox = new Letterbox();
		this.flash.style.background = FLASH_COLOR;
		this.dialogue.onBlip = (voice) => this.sfx.voice(VOICE_PITCH[voice]);
		this.dialogue.onEnd = (sound) => {
			this._playSound(sound);
			this.letterbox.hide();
		};
		this.dialogue.onGlitch = () => {
			this.glitchTime = 0;
			this.sfx.glitch(GLITCH_TIME);
		};
		this.canteen.onSit = (seat) => {
			this.player.sit(seat.x, seat.z, seat.yaw, seat.eyeY);
		};
		this.canteen.onStand = (x, z) => this.player.stand(x, z);
		// Поднос разбился — с этого момента играет жуткий фон.
		this.canteen.onTrayCrash = () => {
			this.sfx.crash();
			this.dreadAmbient.start();
		};
		this.canteen.onDoorSlam = () => this.sfx.scare();
		this.canteen.onCameraPose = (pose) => this.player.setPose(pose.x, pose.y, pose.z, pose.yaw, pose.pitch);

		// Автоплей звука запрещён без жеста пользователя — запускаем звук на первый клик/клавишу (обычно ещё
		// на стартовом экране). Если игра началась не в офисе — сразу и уличное (дождь, ударные): до жеста их нельзя
		// включать, иначе удары копятся в приостановленном звуке и потом звучат разом.
		const startAudio = () => {
			this.music.start();
			if (this.place !== 'office') this._startStreetAudio();
		};
		// «Старт» — тоже жест: захватываем мышь; через INTRO_DELAY начнутся мысли героя.
		this.startScreen.onStart = () => {
			this.input.lockPointer();
			if (this.introPending) this.introTimer = INTRO_DELAY;
		};
		if (DEBUG_SKIP_INTRO) this.startScreen.skip();
		window.addEventListener('pointerdown', startAudio, { once: true });
		window.addEventListener('keydown', startAudio, { once: true });

		window.addEventListener('resize', () => this._resize());
		this._resize();
	}

	start(): void {
		this.timer.connect(document);
		this.renderer.setAnimationLoop((time) => this._frame(time));
	}

	private _frame(time: number): void {
		this.timer.update(time);
		const dt = Math.min(this.timer.getDelta(), 0.1);

		// Стартовый экран: игра стоит — только кадр под ним (чтобы после «Старт» сразу было что показать).
		if (this.startScreen.open) {
			this.input.consumeMouseDelta();
			this.hint.style.display = 'none';
			this._updateStreet(0);
			this.post.render(this._scene(), this.camera);
			this.input.endFrame();
			return;
		}
		if (this.introTimer !== null) {
			this.introTimer -= dt;
			if (this.introTimer <= 0) {
				this.introTimer = null;
				this._startDialogue({
					...this.room.intro,
					onEnd: () => {
						this.introPending = false;
						this.firstObjectiveTimer = FIRST_OBJECTIVE_DELAY;
					},
				});
			}
		}
		if (this.firstObjectiveTimer !== null) {
			this.firstObjectiveTimer -= dt;
			if (this.firstObjectiveTimer <= 0) this.firstObjectiveTimer = null;
		}

		// Во время разговора стоим на месте; движение мыши сбрасываем, чтобы после не было рывка взгляда.
		if (this.dialogue.active || this.introPending) this.input.consumeMouseDelta();
		else this.player.update(dt);
		this.dialogue.update(dt);
		this.room.update(dt);
		this._updateShotgun(dt);
		this._updateInteraction();
		this._updateFlash(dt);
		this._clamp();
		// После клэмпа — поднос в руках встаёт перед камерой в её итоговом положении.
		this.canteen.update(dt, this.camera);
		// Задача: плашка в углу и маркер цели (прячем на время перехода; маркер — и на время разговора).
		const objective = this._objective();
		this.objectiveHud.set(objective?.text ?? null);
		this.targetMarker.update(this.camera, this.dialogue.active ? null : (objective?.at ?? null));
		this.hint.style.display = this.input.isPointerLocked ? 'none' : 'flex';
		this._updateStreet(dt);
		this._updateGlitch(dt);

		this.post.render(this._scene(), this.camera);
		this.input.endFrame();
	}

	/** Обрез в руках: камера с ним должна быть в сцене текущего места (иначе дочерние объекты не рисуются).
	 * ЛКМ — дуплет, R — перезарядка; не во время разговора, перехода, вступления и катсцен, а за столом ЛКМ — ложка. */
	private _updateShotgun(dt: number): void {
		if (!this.shotgun) return;
		const scene = this._scene();
		if (this.camera.parent !== scene) scene.add(this.camera);
		// Обрез покачивается в такт шагам: из стороны в сторону и чуть отстаёт вниз, когда глаза поднимаются.
		const { bobPhase, bobWeight } = this.player;
		this.shotgun.group.position.set(
			SHOTGUN_HELD_POSITION.x + Math.sin(bobPhase) * SHOTGUN_BOB * bobWeight,
			SHOTGUN_HELD_POSITION.y - Math.abs(Math.sin(bobPhase)) * SHOTGUN_BOB * bobWeight,
			SHOTGUN_HELD_POSITION.z
		);
		const canteenBusy = this.place === 'canteen' && (this.canteen.eating || this.canteen.cutsceneActive);
		const canUse = !this.dialogue.active && !this.introPending && this.flashTime === null && !canteenBusy;
		// Перекрестие — когда из обреза можно стрелять (и мышь захвачена: без неё взгляд не наводится).
		this.crosshair.style.display = canUse && this.input.isPointerLocked ? 'block' : 'none';
		if (canUse && this.input.consumePress('Mouse0') && this.shotgun.fire()) {
			this.player.shake();
			this._shoot(scene);
		}
		if (canUse && this.input.consumePress('KeyR')) this.shotgun.reload();
		this.shotgun.update(dt);
		for (const { place, zombie } of this.zombies) if (place === this.place) zombie.update(dt);
		this.impacts.update(dt);
	}

	/**
	 * Выстрел: попадание решает один луч из центра экрана — до первого видимого меша (сам обрез на камере не в счёт);
	 * попал в живого зомби — hit. Дробь — только эффект: PELLETS росчерков от дульного среза с разбросом; если луч
	 * упёрся в поверхность, дробины ложатся на её плоскость вокруг точки попадания и оставляют следы.
	 */
	private _shoot(scene: THREE.Scene): void {
		const origin = this.camera.getWorldPosition(new THREE.Vector3());
		const forward = this.camera.getWorldDirection(new THREE.Vector3());
		this.raycaster.set(origin, forward);
		this.raycaster.far = PELLET_RANGE;
		const targets = scene.children.filter((o) => o !== this.camera);
		const hit = this.raycaster.intersectObjects(targets, true).find((h) => h.object instanceof THREE.Mesh && isShown(h.object));
		const target = hit && this.zombies.find(({ place, zombie }) => place === this.place && zombie.alive && zombie.owns(hit.object));
		if (hit && target) {
			target.zombie.hit(hit.point, forward);
			this.sfx.flesh();
		}

		// Плоскость, на которую ложится дробь: поверхность под лучом, нормалью к стрелку. По зомби следов нет — там кровь.
		// По лежащему телу — тоже нет: следы повисли бы в воздухе вокруг него.
		const onZombie = hit && this.zombies.some(({ zombie }) => zombie.owns(hit.object));
		let plane: THREE.Plane | null = null;
		if (hit?.face && !onZombie) {
			const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
			if (normal.dot(forward) > 0) normal.negate();
			plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
		}
		const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
		const up = new THREE.Vector3().crossVectors(right, forward);
		const ray = new THREE.Ray();
		const ends: PelletEnd[] = [];
		for (let i = 0; i < PELLETS; i++) {
			// Равномерно по кругу конуса: радиус — корень из случайного.
			const r = Math.sqrt(Math.random()) * PELLET_SPREAD;
			const a = Math.random() * Math.PI * 2;
			ray.set(origin, forward.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize());
			const point = new THREE.Vector3();
			const onPlane = plane && ray.intersectPlane(plane, point) && point.distanceTo(origin) <= PELLET_RANGE;
			if (onPlane) ends.push({ point, normal: plane!.normal });
			else if (hit && onZombie) ends.push({ point: ray.at(hit.distance, point), normal: null });
			else ends.push({ point: ray.at(PELLET_RANGE, point), normal: null });
		}
		this.impacts.shot(scene, this.shotgun!.muzzle(new THREE.Vector3()), ends);
	}

	/** Глитч: сила скачет от кадра к кадру (то сильный сбой, то почти чисто) и к концу спадает; картинка каждый кадр новая. */
	private _updateGlitch(dt: number): void {
		if (this.glitchTime === null) return;
		this.glitchTime += dt;
		if (this.glitchTime >= GLITCH_TIME) {
			this.glitchTime = null;
			this.post.setGlitch(0, 0);
			return;
		}
		const fade = 1 - (this.glitchTime / GLITCH_TIME) * 0.5;
		this.post.setGlitch((Math.random() < 0.75 ? 1 : 0.15) * fade, Math.random() * 100);
	}

	/** Текущая задача по месту: офис — выйти (после вступления), улица — двор и столовая, столовая — своя цепочка. */
	private _objective(): { text: string; at: THREE.Vector3 | null } | null {
		if (this.flashTime !== null) return null;
		if (this.place === 'canteen') return this.canteen.objective;
		if (this.place === 'street') return this.street.objective(this.camera.position);
		return this.introPending || this.firstObjectiveTimer !== null ? null : this.room.objective;
	}

	private _scene(): THREE.Scene {
		if (this.place === 'street') return this.street.scene;
		if (this.place === 'canteen') return this.canteen.scene;
		return this.room.scene;
	}

	/** Улица снаружи живёт вокруг игрока; из офиса — вокруг камеры окна-портала, и её вид рисуется на стекло.
	 * Из столовой улицы не видно (окна зала — статичная картинка), её не обновляем. */
	private _updateStreet(dt: number): void {
		if (this.place === 'street') {
			this.street.update(dt, this.camera.position);
			return;
		}
		if (this.place !== 'office') return;
		this.portal.placeCamera(this.camera.position, this.room.viewWindow, this.street.officeWindow);
		this.street.update(dt, this.portal.camera.position);
		this.portal.render(this.street.scene);
	}

	/** Подсказка E у ближайшей двери/калитки; нажатие — действие. Во время перехода подсказки нет. */
	private _updateInteraction(): void {
		if (this.dialogue.active) {
			this.prompt.style.display = 'none';
			// Реплики листаются левой кнопкой мыши; E во время разговора ничего не делает.
			if (this.input.consumePress('Mouse0')) this.dialogue.advance();
			return;
		}
		// Вступление ещё не началось (ждём первый клик) — никаких действий.
		if (this.introPending) {
			this.prompt.style.display = 'none';
			return;
		}
		// Катсцена: управление заблокировано — подсказок нет.
		if (this.place === 'canteen' && this.canteen.cutsceneActive) {
			this.prompt.style.display = 'none';
			return;
		}
		// За столом ЛКМ — ложка солянки; после MUSIC_FADE_BITE-й ложки музыка затихает.
		if (this.place === 'canteen' && this.canteen.eating) {
			this.prompt.textContent = 'ЛКМ — есть солянку';
			// Пониже обычного — чтобы не закрывала тарелку.
			this.prompt.classList.add('low');
			this.prompt.style.display = 'block';
			if (this.input.consumePress('Mouse0') && this.canteen.canEat) {
				const bites = this.canteen.eat();
				this.sfx.eat(BITE_TIME * BITE_AT_MOUTH);
				if (bites === MUSIC_FADE_BITE) this.music.fadeOut(MUSIC_FADE_TIME);
			}
			return;
		}
		const action = this.flashTime === null ? this._nearbyInteraction() : null;
		if (!action) {
			this.prompt.style.display = 'none';
			return;
		}
		const usable = action.run || action.dialogue;
		this.prompt.textContent = usable ? `E — ${action.text}` : action.text;
		this.prompt.classList.remove('low');
		this.prompt.style.display = 'block';
		if (usable && this.input.consumePress('KeyE')) {
			if (action.dialogue) this._startDialogue(action.dialogue);
			else action.run?.();
			this._playSound(action.sound);
		}
	}

	/** Разговор всегда в кинорамке: полосы выезжают, реплики — на нижней, когда полосы доехали (если уже стоят —
	 * сразу). Уезжают полосы по dialogue.onEnd. */
	private _startDialogue(dialogue: Dialogue): void {
		const delay = this.letterbox.visible ? 0 : LETTERBOX_SLIDE_TIME;
		this.letterbox.show();
		this.dialogue.start(dialogue, delay);
	}

	private _playSound(sound: InteractionSound | undefined): void {
		if (sound === 'tray') this.sfx.tray();
		else if (sound === 'bread') this.sfx.bread();
		else if (sound === 'dish') this.sfx.dish();
		else if (sound === 'card') this.sfx.card();
	}

	private _nearbyInteraction(): Interaction | null {
		const cam = this.camera.position;
		const near = (x: number, z: number) => Math.hypot(cam.x - x, cam.z - z) < DOOR_REACH;

		if (this.place === 'office') {
			const { doorway } = this.room;
			if (!near(doorway.wallX, doorway.z)) return null;
			return {
				text: `${this.room.isDoorOpen ? 'закрыть' : 'открыть'} дверь`,
				run: () => {
					const opening = !this.room.isDoorOpen;
					this.room.toggleDoor();
					this.sfx.door(opening);
					// Открыли — вспышкой прячем смену сцены и переносим на отдельную уличную сцену (без возврата).
					if (opening) this._beginTransition('street');
				},
			};
		}

		if (this.place === 'canteen') {
			// Сначала — предмет в прицеле (подносы, хлеб), потом дверь.
			const focused = this.canteen.interaction(this.camera);
			if (focused) return focused;
			// Из столовой не выйти: сначала — незачем, после катсцены дверь не открывается.
			const { exitDoor } = this.canteen;
			if (!near(exitDoor.x, exitDoor.z)) return null;
			const text = this.canteen.finished ? 'Не поддаётся.' : 'Незачем выходить. Я же ещё не поел соляночку.';
			return {
				text: 'выйти на улицу',
				dialogue: { lines: [{ speaker: PLAYER_NAME, text, voice: 'player' }] },
			};
		}

		const { gate, canteenDoor } = this.street;
		if (near(canteenDoor.x, canteenDoor.z)) {
			return {
				text: 'войти в столовую',
				run: () => {
					this.street.openCanteenDoor();
					this.sfx.door(true);
					this._beginTransition('canteen');
				},
			};
		}
		if (near(gate.x, gate.z)) {
			// Коллайдер и полотно калитки двигает Street сам (см. Street.toggleGate).
			return {
				text: `${this.street.isGateOpen ? 'закрыть' : 'открыть'} калитку`,
				run: () => {
					const opening = !this.street.isGateOpen;
					this.street.toggleGate();
					this.sfx.gate(opening);
				},
			};
		}
		return null;
	}

	/** Мягкое багровое затемнение на весь экран: в середине хода — смена сцены и телепорт, к концу — исчезает. */
	private _beginTransition(destination: Place): void {
		this.destination = destination;
		this.flashTime = 0;
		this.flashTeleported = false;
	}

	private _updateFlash(dt: number): void {
		if (this.flashTime === null) return;
		this.flashTime += dt;
		const t = this.flashTime;

		if (!this.flashTeleported && t >= FLASH_IN) {
			this._teleport();
			this.flashTeleported = true;
		}

		let opacity: number;
		if (t < FLASH_IN) {
			opacity = t / FLASH_IN;
		} else if (t < FLASH_IN + FLASH_HOLD) {
			opacity = 1;
		} else if (t < FLASH_IN + FLASH_HOLD + FLASH_OUT) {
			opacity = 1 - (t - FLASH_IN - FLASH_HOLD) / FLASH_OUT;
		} else {
			opacity = 0;
			this.flashTime = null;
		}
		this.flash.style.opacity = String(opacity);
	}

	/** Пока экран залит — переключаем сцену и набор коллайдеров у игрока: места никак не связаны в пространстве. */
	private _teleport(): void {
		const from = this.place;
		this.place = this.destination;
		if (this.place === 'canteen') {
			this.player.colliders = this.canteenColliders;
			const { spawnPoint } = this.canteen;
			this.canteen.resetDoor();
			this.player.spawn(spawnPoint.x, spawnPoint.z, spawnPoint.yaw);
			this.rainSound.setIndoor(true);
			return;
		}

		this.player.colliders = this.streetColliders;
		this.street.resetCanteenDoor();
		if (from === 'canteen') {
			// Вышли из столовой — на крыльце, спиной к двери.
			const { canteenExit } = this.street;
			this.player.spawn(canteenExit.x, canteenExit.z, canteenExit.yaw);
		} else {
			// Из офиса — спиной к двери, лицом от дома (дверь и дом позади, к северу).
			const { spawnPoint } = this.street;
			this.player.spawn(spawnPoint.x, spawnPoint.z, Math.PI);
		}
		this.rainSound.setIndoor(false);
		this._startStreetAudio();
	}

	/** Дождь и ударные включаются при первом выходе на улицу и дальше играют всегда (в помещениях дождь стихает). */
	private _startStreetAudio(): void {
		this.rainSound.start();
		this.music.setPercussion(true);
	}

	/** Клэмп по границам текущей сцены — простой прямоугольник; места не пересекаются в пространстве. */
	private _clamp(): void {
		const pos = this.camera.position;
		if (this.place === 'street') {
			pos.x = THREE.MathUtils.clamp(pos.x, -STREET_HALF, STREET_HALF);
			pos.z = THREE.MathUtils.clamp(pos.z, -STREET_HALF, STREET_HALF);
			return;
		}
		const { bounds } = this.place === 'canteen' ? this.canteen : this.room;
		pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX + WALL_MARGIN, bounds.maxX - WALL_MARGIN);
		pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ + WALL_MARGIN, bounds.maxZ - WALL_MARGIN);
	}

	private _resize(): void {
		// Рисуем в уменьшенном буфере; канвас растягивается на экран CSS (image-rendering: pixelated) — крупные пиксели.
		const width = Math.ceil(window.innerWidth / PIXEL_SIZE);
		const height = Math.ceil(window.innerHeight / PIXEL_SIZE);
		this.renderer.setSize(width, height, false);
		this.post.setSize(width, height);
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
	}
}

/** Объект и все его родители видимы — скрытое дробь не задевает. */
function isShown(object: THREE.Object3D): boolean {
	for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
	return true;
}
