import "reflect-metadata";
import { addProxyHandler } from "q-proxyable";
import React, { Component } from "react";

let TEMP_RUNNING_COMPONENT_INSTANCE: any = null;
const RUNNING_INSTANCE_MAP = new Map<object, Map<string, Array<Component>>>();
const RUNNING_INSTANCE_PROXY_MAP = new Map<Component, Map<object, string[]>>();

const updateList: Set<Component> = new Set();
let inLife = false;
addProxyHandler({
  get(t, k) {
    if (TEMP_RUNNING_COMPONENT_INSTANCE) {
      if (!RUNNING_INSTANCE_MAP.get(t)) {
        RUNNING_INSTANCE_MAP.set(t, new Map());
      }
      const map = RUNNING_INSTANCE_MAP.get(t);
      if (map && !map?.get(k as string)) {
        map?.set(k as string, []);
      }
      // 把当前的依赖存到map中去，方便查看  表示 对象t的 k属性 被 TEMP_RUNNING_COMPONENT_INSTANCE 依赖，当值发生变化的时候要去更新 TEMP_RUNNING_COMPONENT_INSTANCE
      map?.get(k as string)?.push(TEMP_RUNNING_COMPONENT_INSTANCE);
      // 记录存活着的组件实例以及实例相关的属性
      if (!RUNNING_INSTANCE_PROXY_MAP.get(TEMP_RUNNING_COMPONENT_INSTANCE)) {
        RUNNING_INSTANCE_PROXY_MAP.set(
          TEMP_RUNNING_COMPONENT_INSTANCE,
          new Map()
        );
      }
      const map2 = RUNNING_INSTANCE_PROXY_MAP.get(
        TEMP_RUNNING_COMPONENT_INSTANCE
      );
      if (map2 && !map2.get(t)) {
        map2.set(t, []);
      }
      // 表示实例TEMP_RUNNING_COMPONENT_INSTANCE依赖 t 对象的 k属性，在重新渲染的时候要注意清空
      map2?.get(t)?.push(k as string);
    }
  },
  set(t, k) {
    if (!inLife) {
      inLife = true;
      setTimeout(() => {
        inLife = false;
        updateList.forEach((com) => com.forceUpdate());
        updateList.clear();
      });
    }
    RUNNING_INSTANCE_MAP.get(t)
      ?.get(k as string)
      ?.forEach((com) => updateList.add(com));
  },
});

/**
 * 清除组件实例的所有相关的依赖
 * @param component 组件
 */
function clearComponentRely(component: Component) {
  // 遍历组件实例所有的依赖的对象
  RUNNING_INSTANCE_PROXY_MAP.get(component)?.forEach((vals, key) => {
    // key就是依赖的对象 target  vals 是依赖的target的属性数组
    // map是根据以来的对象target获取的属性和组件实例的对应关系的map
    const map = RUNNING_INSTANCE_MAP.get(key);
    // 遍历
    vals.forEach((val) => {
      // 过滤这个组件
      const arr = map?.get(val)?.filter((com) => com !== (component as any));
      // 要是数组不存在了，表示这个属性没有任何的以来了，可以删除了
      if (!arr || (arr && arr.length <= 0)) {
        map?.delete(val);
      } else {
        // 存在，就重设下
        map?.set(val, arr);
      }
    });
  });
}

// 重写prototype防止污染源prototype
function resetProtoType(t: Function, m: Function = t) {
  const prototype = t.prototype;
  const Temp: any = function () {};
  Temp.prototype = prototype;
  try {
    m.prototype = new Temp();
  } catch (e) {
    console.log(e, t, t.prototype);
  }
  return t.prototype;
}
const q_react_component_symbol = Symbol("q_react_component");
// 标记某个组件已经被重写过
function tagComponentHasRewrited(component: typeof Component) {
  const proto = resetProtoType(component);
  proto[q_react_component_symbol] = true;
}

function isComponentReWrited(component: Function) {
  return component.prototype[q_react_component_symbol];
}

function rewriteComponent(type: typeof Component) {
  // 是类组件  重写类组件相关方法
  reWriteWillUnmount(type);
  reWriteRender(type);
  // 标记已经重写过
  tagComponentHasRewrited(type);
}

function newWillUnMount(componentWillUnmount: Function) {
  return function () {
    clearComponentRely(this as any);
    RUNNING_INSTANCE_PROXY_MAP.delete(this as any);
    return componentWillUnmount && componentWillUnmount.apply(this);
  };
}

function reWriteWillUnmount(component: typeof Component) {
  component.prototype.componentWillUnmount = newWillUnMount(
    component.prototype.componentWillUnmount!
  );
}

function newRender(render: Function) {
  return function () {
    clearComponentRely(this as any);
    // 记录render期间的实例 在createElement中使用
    TEMP_RUNNING_COMPONENT_INSTANCE = this;
    const res = render.apply(this);
    TEMP_RUNNING_COMPONENT_INSTANCE = null;
    return res;
  };
}

function reWriteRender(component: typeof Component) {
  component.prototype.render = newRender(component.prototype.render);
}

function reWriteFunction(func: Function) {
  // 按道理这个时候是存在的
  const temp = TEMP_RUNNING_COMPONENT_INSTANCE;
  function newCom() {
    // 到了这里不一定存在了 需要重新记录一下依赖
    TEMP_RUNNING_COMPONENT_INSTANCE = temp;
    const res = func(...arguments);
    TEMP_RUNNING_COMPONENT_INSTANCE = null;
    return res;
  }
  resetProtoType(func, newCom);
  return newCom;
}

// 修改渲染逻辑
const createElement = React.createElement;
function newCreateElement(type: any, ...rest: any[]) {
  if (typeof type === "function") {
    const IS_REACT_COMPONENT = type.prototype.isReactComponent;
    if (!IS_REACT_COMPONENT) {
      // 是函数组件的话，重写函数
      type = reWriteFunction(type);
    } else if (!isComponentReWrited(type)) {
      // 是类组件的话，标记类
      rewriteComponent(type);
    }
  }
  return createElement.apply(this, [type, ...rest]);
}

(React as any).createElement = newCreateElement;

export function OnRendered() {
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.render;
    target["render"] = function () {
      const v = func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
      return v;
    };
  };
}

// 卸载时调用
export function OnUnmount() {
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.componentWillUnmount;
    target["componentWillUnmount"] = function () {
      func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
    };
  };
}

// 加载到DOM时调用
export function OnMounted() {
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.componentDidMount;
    target["componentDidMount"] = function () {
      func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
    };
  };
}

export function OnWillUpdate() {
  // UNSAFE_componentWillUpdate
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.UNSAFE_componentWillUpdate;
    target["UNSAFE_componentWillUpdate"] = function () {
      func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
    };
  };
}

export function OnUpdated() {
  // UNSAFE_componentWillUpdate
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.componentDidUpdate;
    target["componentDidUpdate"] = function () {
      func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
    };
  };
}

//   UNSAFE_componentWillReceiveProps
export function OnReceiveProps() {
  // UNSAFE_componentWillUpdate
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func = target.UNSAFE_componentWillReceiveProps;
    target["UNSAFE_componentWillReceiveProps"] = function () {
      func && func.apply(this, arguments);
      descripter.value.apply(this, arguments);
    };
  };
}
/**
 * 被标记的方法会存放上一个条件的结果，自行去判断是否更新
 */
export function ShuoldUpdate() {
  return (target: any, key: string, descripter: PropertyDescriptor) => {
    const func =
      target.shouldComponentUpdate ||
      function (nextProps: any) {
        return Object.keys(nextProps).some(
          (key) => nextProps[key] !== this.props[key]
        );
      };
    // 我们这里不需要状态了 单反用到这个指令的都不传state
    target["shouldComponentUpdate"] = function (
      nextProps: any,
      preStatus?: boolean
    ) {
      return descripter.value.apply(this, [
        nextProps,
        func.apply(this, [nextProps, preStatus]),
      ]);
    };
  };
}
