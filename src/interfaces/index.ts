export interface ILifeOption {
  // 加载到DOM后
  onMounted?: () => void;
  // 加载到DOM前
  beforeMounted?: () => void;
  // 卸载前
  willUnMount?: () => void;
  // 手动判断是否要更新
  shouldUpdate?: <P, S>(nextProps: P, nextState: S) => boolean;
  // 组件更新后
  updated?: () => void;
}

export type IConstructor<T> = new (...args: any[]) => T;
