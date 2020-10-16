# 响应式 React 工具 --- q-reactive

> q-reactive，使 React 有类似 Vue 的写法，开发可以更专注于数据、业务逻辑。

## 基本使用

```tsx
import { QComponent, State } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @State()
  count = 0;
  // 渲染
  render() {
    return <div onClick={() => this.count++}>{this.count}</div>;
  }
}
```

如此便实现了最基本的工具的使用：

1. 定义了一个可以被监测的属性`count`。
2. 直接修改`count`，组件自动更新。

## 基本原理

本工具依赖于另一个独立工具库`q-proxyable`，该工具主要实现对对象的代理，由于功能相对独立，这里独立成了一个单独的库。

为什么我不愿意使用`setState`，因为我觉得这是一个很不效率的功能：

```tsx
this.setState({
  count: 2,
});
```

这个函数会将`count`重置为`2`，按照`react`的思想，每个状态都是独立的，但却与我们的编程直觉有背。

比如我们定义了一个`State`后，我们改变了某个属性，我们直觉是这个`state`依然是以前的`state`，只不过是它的内部的某个值变化了。

**这是两种思想，但是我更倾向于直觉**

另外最重要的是，需要不停的新建对象，旧对象还可能存在内存泄漏的问题，用起来总觉得很**奢侈**。

这也是为什么要写这个工具的原因

### 自动依赖

需要注意的是，并不是被`State`注解过的属性发生了变化，我们的组件一定会被渲染，你会发现，我们的渲染更加的智能，只有和页面相关的数据发生了变化，我们的组件才会自动渲染。

> 简单的原理：render 函数执行的时候，会获取所需要的各种依赖值，也就是说，如果这些值，没有变化，页面并不需要更新

我们会在`render`函数执行的时候去记录组件所依赖的对象、属性。

```tsx
import { QComponent, State } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @State()
  count = 0;

  @State()
  age = 1;
  // 渲染
  render() {
    console.log("i am running");
    return <div onClick={() => this.age++}>{this.count}</div>;
  }
}
```

你可以尝试下， 当你点击这个组件的时候，页面没有更新，`i am running` 也没有被执行。

### 自动计算: @Computed

> 借鉴于`Vue`

有的时候，有的值是依赖于其他的值得，在`react`中我们常见的做法是使用一个函数去计算，但是这么做有个问题就是，每次渲染的时候，我们的函数都会被计算一遍，其实浪费资源的。

为了解决这个问题，我们引入了`Computed`注解：

```tsx
import { Computed } from "q-proxyable";
import { QComponent, State } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @State()
  count = 0;

  @State()
  age = 1;

  @Computed()
  size() {
    console.log("i am computed");
    return this.age;
  }
  // 渲染
  render() {
    console.log("i am running");
    return (
      <div>
        <Button onClick={() => this.age++}>{this.size()}</Button>
        <Button onClick={() => this.count++}>{this.count}</Button>
      </div>
    );
  }
}
```

如上所示，`size`依赖于`age`，

1. 当我点击第一个按钮的时候
   自动调用`render`函数，执行到`size`的时候，检测到`age`发生过变化，`size`函数也被调用:
   ```bash
   i am running
   i am computed
   ```
2. 当我点击第二个按钮的时候
   自动调用`render`函数，由于`age`没有发生过变化，`size`也不会重复计算：

   ```bash
   i am running
   ```

### 渲染合并

在一个函数的计算过程中，我们可能会改变`state`内部的多个属性，我们可以先存储变量，最后统一`setState`，事实上，随着时间的推移，我们总是不可避免的因为函数的相互调用、人员的相互协作等问题导致一个函数执行完毕时会调用多次`setState`。

这个时候，`react`为我们底层实现了优化：多次最终会合并成一次。也就是最终我们的`render`函数只会被调用一次。

> 这里的合并也是有条件的，比如我们在定时函数中去使用的话就不会成功，render 函数会被多次调用，这是因为 React 是在自己定义的整个的事件系统中去实现的。

这里，我们也实现了这样的功能，不过，却没有太多的限制：

```tsx
import { QComponent, State } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @State()
  count = 0;
  // 渲染
  render() {
    console.log("i am running");
    return (
      <div
        onClick={() => {
          setTimeout(() => this.age++);
          setTimeout(() => this.age++);
        }}
      >
        {this.count}
      </div>
    );
  }
}
```

如果是使用`setState`，`i am running`是会被调用两次的，但是在我们的工具中，你会发现，它始终都执行一次。

### 调用原始数据

我们使用的数据都是经过`Proxyable`代理的，在使用的过程中会有一些可能存在的问题：

#### 调用 console 等函数

调用 console 等函数的时候，其实是会遍历对象的，这个时候可能就会触发很多的事件，有点没必要。

#### 原生对象被代理

我们代理的逻辑是，用到的时候会自动代理，普通的对象代理后并没有问题， 但是原生的对象，如`File`等，在代理后使用可能就会有问题，比如`Excel`文件的读取就会显示文件有问题。

总之，在一些情况下我们需要的是原生对象而不是代理对象，这个时候我们可以这么做:

```tsx
import { getOriginTarget } from "q-proxyable";

getOriginTarget(someProxyData);
```

通过这种方式能够得到原始的数据(原始的数据也是会自动变化的)

### 单例模式

非常讨厌`redux`的那套，太过于规范化，太麻烦，而且没办法利用`typescript`的只能提示，重要的是，`redux`本身就是单例呀！

为了能够使用单例模式，你可以这么做：

#### 使用`qzx-ioc`工具

该工具是另一个独立出来的工具库，使用便捷，代码也仅仅几十行。

```typescript
import { Injectable } from "qzx-ioc";
@Injectable()
export class A {
  count = 1;
}

@Injectable()
export class B {
  constructor(private a: A) {
    console.log(a.count);
  }
}

const b = Ioc(B);
```

熟悉`Angular`那套的同学对这个肯定很熟悉，因为几乎一模一样，这里就是希望能够在`React`中使用`Angular`中的这个单例模式。

这个工具没有任何依赖，可以独立使用，常用的函数也就`Injectable` 和`Ioc`

#### 例子

```tsx
import { QComponent, State } from "q-reactive";
import React, { Component } from "react";
import { Iocable } from "qzx-ioc";
@QComponent()
export default class extends Component {
  @Iocable()
  a: A; // 你也可以不用注解  a = Ioc(A)
  // 渲染
  render() {
    console.log("i am running");
    return <div onClick={() => this.a.count++}>{this.a.count}</div>;
  }
}
```

这么写，能够渲染，但是当你点击的时候去并没有反应，这也能理解，这本身就是两个不关联的库，能反应才奇怪，你应该这么做：

修改 A:

```tsx
import { Injectable } from "qzx-ioc";
import { State } from "q-reactive";
@Injectable()
export class A {
  @State()
  count = 1;
}
```

发现没有，仅仅加了一个注解就可以了。

## 入口函数进阶

`qzx-ioc`的`Injectable`提供了一个配置参数`bootstrap`：

```tsx
import ReactDOM from "react-dom";
import "./styles/index.less";
import { Component } from "react";
import { Injectable } from "qzx-ioc";
import Core from "./$core";

@Injectable({ bootstrap: true })
export default class Main {
  constructor(private $core: Core) {
    this.init();
  }

  init() {
    this.injectComponent();
    this.render();
  }
  // 向组件中注入全局变量
  private injectComponent() {
    Component.propotype.$core = this.$core;
  }
  // 渲染组件至指定节点
  private render(dom = document.getElementById("root")) {
    ReactDOM.render(
      this.$core.service.router.applyRouter(this.$core.config.router.routes),
      dom
    );
  }
}
```

如图所示，一旦`bootstrap`设置成了`true`，这个单例就会立即被实例化，相当于自动的执行了`Ioc(XXXX)`

这么做的好处就是能够轻松的使用全局的其他地方的实例(通过`constructor`引用)。

## 接口函数

| 接口名称     | 功能描述                  |
| ------------ | ------------------------- |
| OnUnmount    | 组件卸载时调用            |
| OnRendered   | render 函数调用结束时调用 |
| OnMounted    | 组件装载后调用            |
| OnWillUpdate | 组件更新前调用            |
| OnUpdated    | 组件更新后调用            |
| ShuoldUpdate | 是否需要更新              |

### OnUnmount / OnRendered / OnMounted / OnWillUpdate / OnUpdated

```tsx
import { QComponent, State, OnUnmount } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @State()
  count = 1;

  @OnUnmount()
  unmountHandler1() {
    console.log(1);
  }

  @OnUnmount()
  unmountHandler1() {
    console.log(2);
  }

  render() {
    return <div onClick={() => this.count++}>{this.count}</div>;
  }
}
```

它们的使用方式都是一样，使用注解的方式，更加自由些。

### ShuoldUpdate

```tsx
import { QComponent, State, ShuoldUpdate } from "q-reactive";
import React, { Component } from "react";
@QComponent()
export default class extends Component {
  @ShuoldUpdate()
  should1(nextProps, preStatus) {
    return true;
  }

  @ShuoldUpdate()
  should1(nextProps, preStatus) {
    return true;
  }

  render() {
    return <div onClick={() => this.count++}>{this.count}</div>;
  }
}
```

`ShouldUpdate`同样是多个，不过具有前后关联性，下一个函数的第二个参数是上一个函数的结果 。

## Mobx 对比

`Mobx`更加复杂，功能也更加多样，`q-reactive`更可以看成是一个简化版的`mobx`，作为响应式库使用, 结合`qzx-ioc`单例模式可以很方便。
