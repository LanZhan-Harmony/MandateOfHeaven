import { createAnimatable, type AnimatableObject } from "animejs";

export class DragZoomController extends EventTarget {
  // 配置参数
  private _paddingXRatio: number;
  private _paddingYRatio: number;
  private _minScale = 1;
  private _maxScale = 1.6;
  private _defaultScale = 1;
  private _scaleFactor = 1;
  private _dragCursorCSS = "grab";

  // DOM 元素引用
  private _container: HTMLElement;
  private _element: HTMLElement;

  // 尺寸缓存
  private _containerWidth = 0;
  private _containerHeight = 0;
  private _elementWidth = 0;
  private _elementHeight = 0;
  private _elementScale = 1;

  // 原始光标样式
  private _containerOriginalCursor = "auto";
  private _elementOriginalCursor = "auto";

  // Anime.js 动画对象
  private _animatable: AnimatableObject;

  // resize 监听器引用（用于清理）
  private _resizeListener: () => void;

  // 事件缓存（用于处理多点触控）
  private _pointerEventCache: PointerEvent[] = [];
  private _pointerEventProcessingPaused = false;

  // 拖拽状态
  private _pointerDown = false;
  private _dragCenterX = 0;
  private _dragCenterY = 0;
  private _dragThresholdPx = 3;

  // 拖拽事件
  private _dragStartEvent = new Event("dragstart");
  private _dragEndEvent = new Event("dragend");

  private _inDrag = false;
  private _inResize = false;
  private _resizeLength = 0;

  get inDrag() {
    return this._inDrag;
  }

  set inDrag(value: boolean) {
    if (this._inDrag !== value) {
      this._inDrag = value;
      if (value) {
        this.dispatchEvent(this._dragStartEvent);
      } else {
        this.dispatchEvent(this._dragEndEvent);
      }
    }
  }

  /**
   * @param element - 需要拖拽/缩放的元素
   * @param container - 容器元素
   * @param paddingXRatio - X方向边距比例
   * @param paddingYRatio - Y方向边距比例
   */
  public constructor(element: HTMLElement, container: HTMLElement, paddingXRatio = 0, paddingYRatio = 0) {
    super();

    this._paddingXRatio = paddingXRatio;
    this._paddingYRatio = paddingYRatio;
    this._container = container;
    this._element = element;

    // 容器 resize 回调
    this._container.onresize = this._updateContainerSize.bind(this);
    this._updateContainerSize();

    // 禁用默认触摸行为
    this._container.style.touchAction = "none";

    // 绑定事件监听器
    this._container.addEventListener("selectstart", this._onSelectStart.bind(this));
    this._container.addEventListener("pointerdown", this._onPointerDeviceDown.bind(this));
    this._container.addEventListener("pointermove", this._onPointerDeviceMove.bind(this));
    this._container.addEventListener("pointerleave", this._onPointerDeviceUp.bind(this));
    this._container.addEventListener("pointerup", this._onPointerDeviceUp.bind(this));
    this._container.addEventListener("pointercancel", this._onPointerDeviceUp.bind(this));
    this._container.addEventListener("pointerover", this._onHover.bind(this));
    this._container.addEventListener("wheel", this._onWheel.bind(this), { passive: true });

    // 设置元素变换原点
    this._element.style.transformOrigin = "top left";
    this._element.onresize = this._updateElementSize.bind(this);
    this._updateElementSize();

    // 初始化 Anime.js 动画
    this._animatable = createAnimatable(this._element, {
      x: { duration: 0 },
      y: { duration: 0 },
      scale: { duration: 0 },
    });

    // 更新缩放因子
    this._updateScaleFactor();
    this.setScaleAbsolute(this._defaultScale);

    // 监听窗口大小变化
    this._resizeListener = this._onWindowResize.bind(this);
    globalThis.addEventListener("resize", this._resizeListener);
  }

  // ========== 尺寸更新方法 ==========

  private async _updateScaleFactor() {
    const oldFactor = this._scaleFactor;
    const newFactor = Math.max(this._containerWidth / this._elementWidth, this._containerHeight / this._elementHeight);
    if (newFactor === Infinity || newFactor === 0) return;

    this._scaleFactor = newFactor;
    this._minScale = (this._minScale / oldFactor) * this._scaleFactor;
    this._defaultScale = (this._defaultScale / oldFactor) * this._scaleFactor;
    if (this._animatable) {
      this.setScaleAbsolute(this._elementScale);
    }
  }

  private async _updateContainerSize() {
    this._containerWidth = this._container.clientWidth;
    this._containerHeight = this._container.clientHeight;
    await this._updateScaleFactor();
  }

  private async _updateElementSize() {
    this._elementWidth = this._element.clientWidth;
    this._elementHeight = this._element.clientHeight;
    await this._updateScaleFactor();
  }

  private async _onWindowResize() {
    await this._updateElementSize();
    await this._updateContainerSize();
  }

  // ========== 坐标限制 ==========

  private _hardLimitX(x: number): number {
    const padding = this._paddingXRatio * this._elementWidth;
    const max = padding;
    const min = this._containerWidth - (this._elementWidth - 2 * padding) * this._elementScale;
    return Math.max(Math.min(x, max), min);
  }

  private _hardLimitY(y: number): number {
    const padding = this._paddingYRatio * this._elementHeight;
    const max = padding;
    const min = this._containerHeight - (this._elementHeight - 2 * padding) * this._elementScale;
    return Math.max(Math.min(y, max), min);
  }

  private _hardLimitScale(scale: number): number {
    return Math.max(this._minScale, Math.min(this._maxScale, scale));
  }

  // ========== 释放回弹 ==========

  private _onRelease() {
    this.setXRelative(0);
    this.setYRelative(0);
  }

  // ========== 位置/缩放控制 ==========

  get AnimeJsAnimatable() {
    return this._animatable;
  }

  setXAbsolute(x: number) {
    this._animatable.x!(this._hardLimitX(x));
  }

  setXRelative(dx: number) {
    if (dx !== 0) {
      this.setXAbsolute((this._animatable.x!() as number) + dx);
    }
  }

  setYAbsolute(y: number) {
    this._animatable.y!(this._hardLimitY(y));
  }

  setYRelative(dy: number) {
    if (dy !== 0) {
      this.setYAbsolute((this._animatable.y!() as number) + dy);
    }
  }

  setScaleAbsolute(scale: number) {
    this._elementScale = this._hardLimitScale(scale);
    this._animatable.scale!(this._elementScale);
  }

  setScaleRelative(delta: number, pivotX = 0, pivotY = 0) {
    if (delta === 0) return;
    const oldScale = this._elementScale;
    const newScale = oldScale * Math.exp(delta * 0.1);
    this.setScaleAbsolute(newScale);
    this.setXRelative((-pivotX * (this._elementScale - oldScale)) / this._elementScale);
    this.setYRelative((-pivotY * (this._elementScale - oldScale)) / this._elementScale);
  }

  /**
   * 设置视图中心点
   * 用于将某个节点移动到屏幕中央
   */
  setCenter(x: number, y: number) {
    this.setXAbsolute(this._containerWidth / 2 - x * this._elementScale);
    this.setYAbsolute(this._containerHeight / 2 - y * this._elementScale);
  }

  // ========== 事件处理 ==========

  private async _onSelectStart(event: Event) {
    event.preventDefault();
  }

  private async _onWheel(event: WheelEvent) {
    let scaleDelta = 0;
    if (event.deltaY < 0 || event.deltaZ < 0) {
      scaleDelta = 1; // 放大
    }
    if (event.deltaY > 0 || event.deltaZ > 0) {
      scaleDelta = -1; // 缩小
    }

    const scrollX = event.deltaX;

    // 根据滚动模式调整系数
    let factor = 1;
    switch (event.deltaMode) {
      case WheelEvent.DOM_DELTA_PIXEL:
        factor = 1 / 3;
        break;
      case WheelEvent.DOM_DELTA_LINE:
        factor = 1;
        break;
      case WheelEvent.DOM_DELTA_PAGE:
        factor = 3;
        break;
    }

    // 以鼠标位置为中心进行缩放
    const rect = this._element.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    this.setScaleRelative(scaleDelta * factor, mouseX, mouseY);

    // 同时处理水平滚动
    this.setXRelative(-scrollX * factor);
  }

  private _getStyle(el: HTMLElement, prop: string): string {
    let current: HTMLElement | null = el;
    let val = globalThis.getComputedStyle(current)[prop as any] as string;
    while (!val && (current = current.parentElement)) {
      val = globalThis.getComputedStyle(current)[prop as any] as string;
    }
    return val;
  }

  private async _onPointerDeviceDown(event: PointerEvent) {
    // 首次按下时保存原始光标
    if (this._pointerEventCache.length === 0) {
      this._containerOriginalCursor = this._getStyle(this._container, "cursor");
      this._container.style.cursor = this._dragCursorCSS;
      this._elementOriginalCursor = this._getStyle(this._element, "cursor");
      this._element.style.cursor = this._dragCursorCSS;
    }

    this._pointerEventCache.push(event);
    this._pointerDown = true;
    this._dragCenterX = event.clientX;
    this._dragCenterY = event.clientY;

    // 释放指针捕获（允许指针离开元素后仍能跟踪）
    const target = event.target as Element | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  private async _onPointerDeviceMove(event: PointerEvent) {
    if (!this._pointerDown || this._pointerEventProcessingPaused) return;

    const deltaX = event.clientX - this._dragCenterX;
    const deltaY = event.clientY - this._dragCenterY;

    this.setXRelative(deltaX);
    this.setYRelative(deltaY);

    this._dragCenterX = event.clientX;
    this._dragCenterY = event.clientY;

    // 超过阈值才认为是拖拽
    if (Math.abs(deltaX) > this._dragThresholdPx || Math.abs(deltaY) > this._dragThresholdPx) {
      this.inDrag = true;
    }
  }

  private async _onPointerDeviceUp(event: PointerEvent) {
    // 从缓存中移除
    const index = this._pointerEventCache.findIndex((e) => e.pointerId === event.pointerId);
    if (index !== -1) {
      this._pointerEventCache.splice(index, 1);
    }

    // 所有指针都抬起时结束拖拽
    if (this._pointerEventCache.length === 0) {
      this._pointerDown = false;
      this.inDrag = false;

      // 恢复鼠标样式
      this._container.style.cursor = this._containerOriginalCursor;
      this._element.style.cursor = this._elementOriginalCursor;
    }
  }

  private async _onPointerDeviceLeave(_event: PointerEvent) {
    this._pointerEventProcessingPaused = true;
  }

  private async _onPointerDeviceEnter(_event: PointerEvent) {
    this._pointerEventProcessingPaused = false;
  }

  private async _onHover(_event: PointerEvent) {
    // 预留 hover 处理
  }

  /**
   * 停止控制器，清理资源
   */
  stop() {
    globalThis.removeEventListener("resize", this._resizeListener);
    this._animatable.revert();
  }
}
