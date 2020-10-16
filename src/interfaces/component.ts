import { Component } from "react";
import { IConstructor } from ".";

export interface IComponentStoreInfo<T = any> {
  target: IConstructor<T>;
  inited?: Array<(ins?: Component) => void>;
  mounted?: Array<(ins?: Component) => void>;
  updated?: Array<(ins?: Component) => void>;
  unmount?: Array<(ins?: Component) => void>;
}

export type COMPONENT_HANDLER_TYPE = (ins: any) => void;
