export class DragZoomController extends EventTarget {
  // 配置参数
  private _paddingXRatio: number;
  private _paddingYRatio: number;
  private _minScale = 1;
  private _maxScale = 1.6;
  private _defaultScale = 1;
  private _scaleFactor = 1;
  // DOM 元素引用
  private _container: HTMLElement;
  private _element: HTMLElement;

  // 尺寸缓存
  private _containerWidth = 0;
  private _containerHeight = 0;
  private _elementWidth = 0;
  private _elementHeight = 0;
  private _elementScale = 1;

  // 变换状态
  private _x = 0;
  private _y = 0;

  // RAF 调度（批量合并同帧内的多次变换请求）
  private _rafId: number | null = null;

  // ResizeObserver（替换 window resize + element.onresize）
  private _resizeObserver: ResizeObserver;

  // 事件缓存（用于处理多点触控）
  private _pointerEventCache: PointerEvent[] = [];

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
      this.dispatchEvent(value ? this._dragStartEvent : this._dragEndEvent);
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

    // 设置元素变换原点
    this._element.style.transformOrigin = "top left";

    // 禁用默认触摸行为
    this._container.style.touchAction = "none";

    // 使用 ResizeObserver 同时监听容器与元素的尺寸变化
    this._resizeObserver = new ResizeObserver(() => {
      this._updateContainerSize();
      this._updateElementSize();
    });
    this._resizeObserver.observe(this._container);
    this._resizeObserver.observe(this._element);

    this._updateContainerSize();
    this._updateElementSize();

    // 绑定事件监听器（箭头函数成员无需 bind）
    this._container.addEventListener("selectstart", this._onSelectStart);
    this._container.addEventListener("pointerdown", this._onPointerDeviceDown);
    this._container.addEventListener("pointermove", this._onPointerDeviceMove);
    this._container.addEventListener("pointerleave", this._onPointerDeviceUp);
    this._container.addEventListener("pointerup", this._onPointerDeviceUp);
    this._container.addEventListener("pointercancel", this._onPointerDeviceUp);
    this._container.addEventListener("wheel", this._onWheel, { passive: true });

    // 更新缩放因子并应用初始变换
    this._updateScaleFactor();
    this._applyTransform();
  }

  // ========== RAF 渲染调度 ==========

  /** 将变换写入 DOM，所有操作合并至同一帧，避免多余 layout */
  private _applyTransform() {
    this._element.style.transform = `translate(${this._x}px, ${this._y}px) scale(${this._elementScale})`;
  }

  private _scheduleRender() {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._applyTransform();
    });
  }

  // ========== 尺寸更新方法 ==========

  private _updateScaleFactor() {
    const oldFactor = this._scaleFactor;
    const newFactor = Math.max(this._containerWidth / this._elementWidth, this._containerHeight / this._elementHeight);
    if (!isFinite(newFactor) || newFactor === 0) return;

    this._scaleFactor = newFactor;
    this._minScale = (this._minScale / oldFactor) * this._scaleFactor;
    this._defaultScale = (this._defaultScale / oldFactor) * this._scaleFactor;
    // 同步按比例缩放当前缩放值，保证 fit-to-screen 行为正确
    this._elementScale = (this._elementScale / oldFactor) * this._scaleFactor;
    this.setScaleAbsolute(this._elementScale);
  }

  private _updateContainerSize() {
    this._containerWidth = this._container.clientWidth;
    this._containerHeight = this._container.clientHeight;
    this._updateScaleFactor();
  }

  private _updateElementSize() {
    this._elementWidth = this._element.clientWidth;
    this._elementHeight = this._element.clientHeight;
    this._updateScaleFactor();
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

  // ========== 位置/缩放控制 ==========

  setXAbsolute(x: number) {
    this._x = this._hardLimitX(x);
    this._scheduleRender();
  }

  setXRelative(dx: number) {
    if (dx === 0) return;
    this._x = this._hardLimitX(this._x + dx);
    this._scheduleRender();
  }

  setYAbsolute(y: number) {
    this._y = this._hardLimitY(y);
    this._scheduleRender();
  }

  setYRelative(dy: number) {
    if (dy === 0) return;
    this._y = this._hardLimitY(this._y + dy);
    this._scheduleRender();
  }

  setScaleAbsolute(scale: number) {
    this._elementScale = this._hardLimitScale(scale);
    // 缩放改变后边界也改变，需重新限制位置
    this._x = this._hardLimitX(this._x);
    this._y = this._hardLimitY(this._y);
    this._scheduleRender();
  }

  setScaleRelative(delta: number, pivotX = 0, pivotY = 0) {
    if (delta === 0) return;
    const oldScale = this._elementScale;
    const newScale = this._hardLimitScale(oldScale * Math.exp(delta * 0.1));
    const scaleDiff = newScale - oldScale;
    this._elementScale = newScale;
    // 合并计算，一次调度渲染
    this._x = this._hardLimitX(this._x + (-pivotX * scaleDiff) / newScale);
    this._y = this._hardLimitY(this._y + (-pivotY * scaleDiff) / newScale);
    this._scheduleRender();
  }

  /**
   * 设置视图中心点
   * 用于将某个节点移动到屏幕中央
   */
  setCenter(x: number, y: number) {
    this._x = this._hardLimitX(this._containerWidth / 2 - x * this._elementScale);
    this._y = this._hardLimitY(this._containerHeight / 2 - y * this._elementScale);
    this._scheduleRender();
  }

  // ========== 事件处理（箭头函数成员，自动绑定 this，无需 bind）==========

  private _onSelectStart = (event: Event) => {
    event.preventDefault();
  };

  private _onWheel = (event: WheelEvent) => {
    let scaleDelta = 0;
    if (event.deltaY < 0 || event.deltaZ < 0) scaleDelta = 1;
    if (event.deltaY > 0 || event.deltaZ > 0) scaleDelta = -1;

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

    // 以鼠标位置为缩放中心
    const rect = this._element.getBoundingClientRect();
    this.setScaleRelative(scaleDelta * factor, event.clientX - rect.left, event.clientY - rect.top);

    if (event.deltaX !== 0) {
      this.setXRelative(-event.deltaX * factor);
    }
  };

  private _onPointerDeviceDown = (event: PointerEvent) => {
    this._pointerEventCache.push(event);
    this._pointerDown = true;

    if (this._pointerEventCache.length === 1) {
      this._dragCenterX = event.clientX;
      this._dragCenterY = event.clientY;
    } else if (this._pointerEventCache.length === 2) {
      const p1 = this._pointerEventCache[0]!;
      const p2 = this._pointerEventCache[1]!;
      this._resizeLength = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      this._dragCenterX = (p1.clientX + p2.clientX) / 2;
      this._dragCenterY = (p1.clientY + p2.clientY) / 2;
    }

    // 释放指针捕获（允许指针离开元素后仍能跟踪）
    const target = event.target as Element | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  };

  private _onPointerDeviceMove = (event: PointerEvent) => {
    if (!this._pointerDown) return;

    // 更新缓存中的指针位置
    const index = this._pointerEventCache.findIndex((p) => p.pointerId === event.pointerId);
    if (index !== -1) {
      this._pointerEventCache[index] = event;
    }

    if (this._pointerEventCache.length === 2) {
      // 双指缩放/平移逻辑
      this._inResize = true;
      const p1 = this._pointerEventCache[0]!;
      const p2 = this._pointerEventCache[1]!;

      const currMidX = (p1.clientX + p2.clientX) / 2;
      const currMidY = (p1.clientY + p2.clientY) / 2;
      const currDiff = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);

      if (this._resizeLength > 0) {
        const ratio = currDiff / this._resizeLength;
        const delta = Math.log(ratio) * 10;

        const rect = this._element.getBoundingClientRect();
        const pivotX = currMidX - rect.left;
        const pivotY = currMidY - rect.top;

        // 缩放
        const oldScale = this._elementScale;
        const newScale = this._hardLimitScale(oldScale * Math.exp(delta * 0.1));
        const scaleDiff = newScale - oldScale;
        this._elementScale = newScale;
        this._x = this._hardLimitX(this._x + (-pivotX * scaleDiff) / newScale);
        this._y = this._hardLimitY(this._y + (-pivotY * scaleDiff) / newScale);

        // 平移
        const deltaX = currMidX - this._dragCenterX;
        const deltaY = currMidY - this._dragCenterY;
        this._x = this._hardLimitX(this._x + deltaX);
        this._y = this._hardLimitY(this._y + deltaY);

        // 合并为一次 RAF 写入
        this._scheduleRender();

        if (Math.abs(deltaX) > this._dragThresholdPx || Math.abs(deltaY) > this._dragThresholdPx) {
          this.inDrag = true;
        }
      }

      this._resizeLength = currDiff;
      this._dragCenterX = currMidX;
      this._dragCenterY = currMidY;
    } else if (this._pointerEventCache.length === 1) {
      // 单指拖拽（排除刚从双指释放的状态）
      if (this._inResize) return;

      const deltaX = event.clientX - this._dragCenterX;
      const deltaY = event.clientY - this._dragCenterY;

      this._x = this._hardLimitX(this._x + deltaX);
      this._y = this._hardLimitY(this._y + deltaY);
      this._scheduleRender();

      this._dragCenterX = event.clientX;
      this._dragCenterY = event.clientY;

      if (Math.abs(deltaX) > this._dragThresholdPx || Math.abs(deltaY) > this._dragThresholdPx) {
        this.inDrag = true;
      }
    }
  };

  private _onPointerDeviceUp = (event: PointerEvent) => {
    const index = this._pointerEventCache.findIndex((e) => e.pointerId === event.pointerId);
    if (index !== -1) {
      this._pointerEventCache.splice(index, 1);
    }

    if (this._pointerEventCache.length < 2) {
      this._inResize = false;
      this._resizeLength = 0;
    }

    if (this._pointerEventCache.length === 1) {
      this._dragCenterX = this._pointerEventCache[0]!.clientX;
      this._dragCenterY = this._pointerEventCache[0]!.clientY;
    } else if (this._pointerEventCache.length === 0) {
      this._pointerDown = false;
      this.inDrag = false;
    }
  };

  /**
   * 停止控制器，清理资源
   */
  stop() {
    this._resizeObserver.disconnect();

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._container.removeEventListener("selectstart", this._onSelectStart);
    this._container.removeEventListener("pointerdown", this._onPointerDeviceDown);
    this._container.removeEventListener("pointermove", this._onPointerDeviceMove);
    this._container.removeEventListener("pointerleave", this._onPointerDeviceUp);
    this._container.removeEventListener("pointerup", this._onPointerDeviceUp);
    this._container.removeEventListener("pointercancel", this._onPointerDeviceUp);
    this._container.removeEventListener("wheel", this._onWheel);

    this._element.style.transform = "";
    this._element.style.transformOrigin = "";
    this._container.style.touchAction = "";
  }
}
