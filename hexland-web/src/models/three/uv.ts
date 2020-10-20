import { coordString, coordSub, IGridCoord } from '../../data/coord';
import { defaultToken, FeatureDictionary, IFeature, ITokenFace, TokenSize } from '../../data/feature';
import { ITokenGeometry } from '../../data/tokenGeometry';
import { IGridGeometry } from '../gridGeometry';

import * as THREE from 'three';

function createUvBounds(vertices: Iterable<THREE.Vector3>) {
  const min = new THREE.Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const max = new THREE.Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  for (const v of vertices) {
    min.min(v);
    max.max(v);
  }

  return {
    min: min, max: max,
    offset: new THREE.Vector2(min.x, min.y),
    scale1: Math.max(max.x - min.x, max.y - min.y),
    scale2: Math.min(max.x - min.x, max.y - min.y)
  };
}

// Creates UVs across the given object, preserving aspect ratio
export function *createBoundingUvs(vertices: THREE.Vector3[]) {
  if (vertices.length === 0) {
    return;
  }

  const { min, max, offset, scale1, scale2 } = createUvBounds(vertices);

  // Jiggle the offset about so that the UVs are centred in the smaller dimension
  const centredOffset = offset.clone();
  if (max.x - min.x < max.y - min.y) {
    centredOffset.setX(offset.x + 0.5 * (scale2 - scale1));
  } else {
    centredOffset.setY(offset.y + 0.5 * (scale2 - scale1));
  }

  for (const v of vertices) {
    yield (v.x - centredOffset.x) / scale1;
    yield (v.y - centredOffset.y) / scale1;
  }
}

// These functions create the bounding UVs of higher-order token features by enumerating
// and scaling their constituent features, and thence come up with a transform from the
// single-feature base UVs to the composite.
export interface IUvTransform {
  offset: THREE.Vector2;
  scale: number;
  transform: THREE.Matrix4;

  // TODO #149 Remove this debug shit
  testVertices: THREE.Vector3[];
  testTransform: THREE.Matrix4;
  testBuvs: Float32Array;
}

export interface ITokenUvTransform {
  getFaceTransform(token: ITokenFace): IUvTransform | undefined;
  getFillEdgeTransform(token: ITokenFace): IUvTransform | undefined;
  getFillVertexTransform(token: ITokenFace): IUvTransform | undefined;
}

interface IUvTransformFeature<K extends IGridCoord> extends IFeature<K>, IUvTransform {}

function debugMatrix(m: THREE.Matrix4): string {
  function extractCol(c: number) {
    const col = m.elements.slice(4 * c, 4 * (c + 1));
    col.splice(2, 1);
    return `${col}`;
  }

  return [extractCol(0), extractCol(1), extractCol(3)].join("\n");
}

function createTokenUvTransform(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  alpha: number,
  tokenSize: TokenSize
): ITokenUvTransform {
  console.log(`createTokenUvTransform: size=${tokenSize}`);

  // We assume that the base UVs fill the [0..1] square (assuming aspect ratio is preserved that's correct)
  // and create the UVs for the whole token, then work out what we need to do to cram them into that square
  const single = gridGeometry.toSingle();
  const facePositions = [...tokenGeometry.enumerateFacePositions(
    { ...defaultToken, position: { x: 0, y: 0 }, size: tokenSize }
  )];
  const faceVertices = [...single.createSolidVertices(new THREE.Vector2(0, 0), alpha, 0)];

  const scratchVertices = [...faceVertices.map(v => v.clone())];
  const uvFaces = new FeatureDictionary<IGridCoord, IUvTransformFeature<IGridCoord>>(coordString);
  const boundsMin = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const boundsMax = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  for (const c of facePositions) {
    // Transform the vertices of the zero face to this position, and work out its UV bounds
    const relCoord = coordSub(c, facePositions[0]);
    const transform = gridGeometry.transformToCoord(new THREE.Matrix4(), relCoord);
    scratchVertices.forEach(v => v.applyMatrix4(transform));
    const { offset, scale1 } = createUvBounds(scratchVertices);

    // Contribute that to my overall bounds for the token
    uvFaces.set({ position: relCoord, colour: 0, offset: offset, scale: scale1, transform: transform,
      testVertices: faceVertices, testTransform: transform, testBuvs: new Float32Array([]) });
    boundsMin.min(offset);
    boundsMax.max(offset.clone().addScalar(scale1));

    // Reset those scratch vertices for the next pass
    scratchVertices.forEach((v, i) => v.copy(faceVertices[i]));
  }

  // Now we can work out a scale for the composite token based on those bounds and 
  // correct aspect ratio.
  const boundsWidth = boundsMax.x - boundsMin.x;
  const boundsHeight = boundsMax.y - boundsMin.y;
  console.log(`found boundsWidth ${boundsWidth} (${boundsMin.x}..${boundsMax.x}), boundsHeight ${boundsHeight} (${boundsMin.y}..${boundsMax.y})`);
  if (boundsWidth < boundsHeight) {
    boundsMin.x -= 0.5 * (boundsHeight - boundsWidth);
  } else {
    boundsMin.y -= 0.5 * (boundsWidth - boundsHeight);
  }

  const boundsSize = Math.max(boundsWidth, boundsHeight);

  // Splice in the overall scale
  const scratchMatrix1 = new THREE.Matrix4();
  const scratchMatrix2 = new THREE.Matrix4();
  for (const f of uvFaces) {
    f.offset.sub(boundsMin).divideScalar(boundsSize);
    f.scale /= boundsSize;

    const baseTransform = scratchMatrix1.copy(f.transform);
    console.log(`face ${coordString(f.position)}: base transform\n` +
      debugMatrix(baseTransform)
    );

    const fScaling = f.transform.makeScale(1.0 / boundsSize, 1.0 / boundsSize, 1);
    console.log(`face ${coordString(f.position)}: face scaling\n` +
      debugMatrix(fScaling)
    );

    // TODO #149 correct for off-centre (very, very confusing)
    const fTranslation = scratchMatrix2.makeTranslation(-boundsMin.x, -boundsMin.y, 0);
    console.log(`face ${coordString(f.position)}: face translation\n` +
      debugMatrix(fTranslation)
    );

    f.transform = fScaling.multiply(fTranslation).multiply(baseTransform);
    console.log(`face ${coordString(f.position)}: offset ${f.offset.toArray()}, scale ${f.scale}, transform\n` +
      debugMatrix(f.transform)
    );

    // TODO #149 REMOVE DEBUG: To test the transform matrix, we re-enumerate the
    // face positions, and show them after transform:
    const vertices = [...single.createSolidVertices(new THREE.Vector2(), alpha, 0)];
    const buvs = new Float32Array(createBoundingUvs(vertices));
    f.testBuvs = buvs;
    vertices.forEach((v, i) => {
      const vTransform = gridGeometry.transformToCoord(new THREE.Matrix4(), f.position);
      const xy = v.clone().applyMatrix4(vTransform);
      const uv = v.clone().applyMatrix4(f.transform);
      console.log(`mat: ${xy.toArray()} -> ${uv.toArray()}`);

      const sc = new THREE.Vector2(buvs[2 * i], buvs[2 * i + 1])
        .multiplyScalar(f.scale).add(f.offset);
      console.log(`sc : ${xy.toArray()} -> ${sc.toArray()}`);
    });
  }

  return {
    getFaceTransform: token => {
      const relCoord = coordSub(token.position, token.basePosition);
      const f2 = uvFaces.get(relCoord);
      return f2 === undefined ? undefined : f2;
    },

    // TODO These
    getFillEdgeTransform: token => undefined,
    getFillVertexTransform: token => undefined
  };
}

export function createLargeTokenUvTransform(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  alpha: number
): ITokenUvTransform {
  const bySize = new Map<TokenSize, ITokenUvTransform>();
  for (const size of tokenGeometry.getTokenSizes()) {
    bySize.set(size, createTokenUvTransform(gridGeometry, tokenGeometry, alpha, size));
  }

  return {
    getFaceTransform: token => bySize.get(token.size)?.getFaceTransform(token),
    getFillEdgeTransform: token => bySize.get(token.size)?.getFillEdgeTransform(token),
    getFillVertexTransform: token => bySize.get(token.size)?.getFillVertexTransform(token)
  };
}