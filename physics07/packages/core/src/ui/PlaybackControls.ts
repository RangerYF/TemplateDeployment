export class PlaybackControls {
  private container: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private speedDisplay!: HTMLSpanElement;

  public onPlay?: () => void;
  public onPause?: () => void;
  public onReset?: () => void;
  public onStepForward?: () => void;
  public onStepBackward?: () => void;
  public onSpeedChange?: (speed: number) => void;

  private playing: boolean = false;
  private speed: number = 1.0;
  private speeds = [0.1, 0.25, 0.5, 1, 2, 5];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'playback-controls';
    parent.appendChild(this.container);
    this.build();
  }

  private build(): void {
    const makeBtn = (text: string, title: string, cb: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.className = 'pb-btn';
      btn.textContent = text;
      btn.title = title;
      btn.addEventListener('click', cb);
      return btn;
    };

    this.container.appendChild(makeBtn('\u23EE', '重置', () => this.onReset?.()));
    this.container.appendChild(makeBtn('\u23EA', '后退一步', () => this.onStepBackward?.()));

    this.playBtn = makeBtn('\u25B6', '播放/暂停', () => this.togglePlay());
    this.container.appendChild(this.playBtn);

    this.container.appendChild(makeBtn('\u23E9', '前进一步', () => this.onStepForward?.()));

    // Speed control
    const speedGroup = document.createElement('div');
    speedGroup.className = 'speed-group';

    const slowBtn = makeBtn('-', '减速', () => this.changeSpeed(-1));
    this.speedDisplay = document.createElement('span');
    this.speedDisplay.className = 'speed-display';
    this.speedDisplay.textContent = '1.0x';
    const fastBtn = makeBtn('+', '加速', () => this.changeSpeed(1));

    speedGroup.appendChild(slowBtn);
    speedGroup.appendChild(this.speedDisplay);
    speedGroup.appendChild(fastBtn);
    this.container.appendChild(speedGroup);

    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'time-display';
    timeDisplay.id = 'time-display';
    timeDisplay.textContent = 't = 0.00 s';
    this.container.appendChild(timeDisplay);
  }

  updateTime(t: number): void {
    const el = document.getElementById('time-display');
    if (el) el.textContent = `t = ${t.toFixed(2)} s`;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.playBtn.textContent = playing ? '\u23F8' : '\u25B6';
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.playBtn.textContent = this.playing ? '\u23F8' : '\u25B6';
    if (this.playing) this.onPlay?.();
    else this.onPause?.();
  }

  private changeSpeed(dir: number): void {
    const currentIdx = this.speeds.indexOf(this.speed);
    const newIdx = Math.max(0, Math.min(this.speeds.length - 1, currentIdx + dir));
    this.speed = this.speeds[newIdx];
    this.speedDisplay.textContent = `${this.speed}x`;
    this.onSpeedChange?.(this.speed);
  }
}
