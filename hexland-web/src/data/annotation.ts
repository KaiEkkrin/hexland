import { IGridCoord } from "./coord";
import { IFeature } from "./feature";

// Describes an annotation on the map.
// This is expected to be rendered using React and so needs to have a unique id
// to use as a key in the list of annotation elements.
export interface IAnnotation extends IFeature<IGridCoord> {
  id: string;
  text: string;
}

// This will not be stored, but will be sent to the React layer for rendering.
// The clientX and clientY values will be in projected co-ordinates, in the range
// -1..1 -- the callee should scale them linearly to fit the ranges
// 0..<client width>, 0..<client height>.
export interface IPositionedAnnotation extends IAnnotation {
  clientX: number;
  clientY: number;
}