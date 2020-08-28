import { IGridCoord, coordString, IGridEdge } from '../../data/coord';
import { IGridGeometry } from '../gridGeometry';
import { IVisibility } from '../los';
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';
import { IFeature } from '../../data/feature';

// Shader-based LoS.
// To do this, I will supply a pair of triangles (forming a rectangle) for each wall
// to the shader, where the vertices are at (edgeA, z); (edgeB, z); (edgeA, q); (edgeB; q)
// The vertices at z=q will be transformed by the vertex shader to be at the point where the
// line from the token centre to the vertex intersects the closest one of the four bounds.
// (which can be fixed at the size 2 cube centred on 0, because we can do this stuff post-
// orthographic projection.)
// This will render the LoS from a single token; to compose multiple tokens together,
// repeat in batches (size 4?) and run a "merge" shader that adds together all the textures in the batches.
// When we've got a final LoS render, we can overlay it onto the screen one by multiply to create
// the drawn LoS layer, and also sample it for allowed/disallowed move purposes.
// We're going to need uniforms:
// - tokenCentre (vec3)
// - zValue (float) (for determining which edges to project; *not* q)
const losShader = {
  uniforms: {
    "tokenCentre": { value: null },
    "zValue": { value: null },
  },
  vertexShader: [
    "uniform vec3 tokenCentre;",
    "uniform float zValue;",

    "vec3 intersectHorizontalBounds(const in vec3 token, const in vec3 dir) {",
    "  vec3 iPositive = vec3(token.x + (1 - token.y) * dir.x / dir.y, 1, token.z);",
    "  vec3 iNegative = vec3(token.x + (-1 - token.y) * dir.x / dir.y, -1, token.z);",
    "  return dot(iPositive, dir) > 0 ? iPositive : iNegative;",
    "}",

    "vec3 intersectVerticalBounds(const in vec3 token, const in vec3 dir) {",
    "  vec3 iPositive = vec3(1, token.y + (1 - token.x) * dir.y / dir.x, token.z);",
    "  vec3 iNegative = vec3(-1, token.y + (-1 - token.x) * dir.y / dir.x, token.z);",
    "  return dot(iPositive, dir) > 0 ? iPositive : iNegative;",
    "}",

    "vec4 project() {",
    "  if (position.z == zValue) {",
    "    return projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "  }",
    "  vec3 projected = projectionMatrix * modelViewMatrix * vec4(position.xy, zValue, 1.0).xyz;",
    "  vec3 token = projectionMatrix * modelViewMatrix * vec4(tokenCentre, 1.0).xyz;",
    "  vec3 dir = normalize(projected - token);",
    "  vec3 iHoriz = intersectHorizontalBounds(token, dir);",
    "  vec3 iVert = intersectVerticalBounds(token, dir);",
    "  return distance(iHoriz, projected) < distance(iVert, projected) ?",
    "    vec4(iHoriz, 1.0) : vec4(iVert, 1.0);",
    "}",

    "void main() {",
    "  gl_Position = project();",
    "}"
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);",
    "}"
  ].join("\n")
};

// Vary the material when rendering this to draw LoS for different tokens
// TODO #52 Before achieving this, I need to have achieved a non-clearing `setMaterial` :)
// class LoSFeatures extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>> {
//   private readonly _bufferGeometry: THREE.BufferGeometry;

//   constructor()
// }