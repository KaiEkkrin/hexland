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
}

export interface ITokenUvTransform {
  getFaceTransform(token: ITokenFace): IUvTransform | undefined;
  getFillEdgeTransform(token: ITokenFace): IUvTransform | undefined;
  getFillVertexTransform(token: ITokenFace): IUvTransform | undefined;
}

interface IUvTransformFeature<K extends IGridCoord> extends IFeature<K>, IUvTransform {}

function createTokenUvTransform(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  alpha: number,
  tokenSize: TokenSize
): ITokenUvTransform {
  // We assume that the base UVs fill the [0..1] square (assuming aspect ratio is preserved that's correct)
  // and create the UVs for the whole token, then work out what we need to do to cram them into that square
  const single = gridGeometry.toSingle();
  const facePositions = [...tokenGeometry.enumerateFacePositions(
    { ...defaultToken, position: { x: 0, y: 0 }, size: tokenSize }
  )];
  const posVec = new THREE.Vector2();

  const uvFeatures = new FeatureDictionary<IGridCoord, IUvTransformFeature<IGridCoord>>(coordString);
  const boundsMin = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const boundsMax = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  for (const c of facePositions) {
    const relCoord = coordSub(c, facePositions[0]);
    posVec.set(c.x, c.y);
    const { offset, scale1 } = createUvBounds(single.createSolidVertices(posVec, alpha, 0));
    uvFeatures.set({ position: relCoord, colour: 0, offset: offset, scale: scale1 });
    boundsMin.min(offset);
    boundsMax.max(offset.clone().addScalar(scale1));
  }

  // Now we can work out a scale for the composite token based on those bounds and 
  // correct for off-centre
  const boundsWidth = boundsMax.x - boundsMin.x;
  const boundsHeight = boundsMax.y - boundsMin.y;
  if (boundsWidth < boundsHeight) {
    boundsMin.x -= 0.5 * (boundsHeight - boundsWidth);
  } else {
    boundsMin.y -= 0.5 * (boundsWidth - boundsHeight);
  }

  const boundsSize = Math.max(boundsWidth, boundsHeight);

  // Splice in the overall scale
  for (const f of uvFeatures) {
    f.offset.sub(boundsMin).divideScalar(boundsSize);
    f.scale /= boundsSize;
  }

  return {
    getFaceTransform: token => {
      const relCoord = coordSub(token.position, token.basePosition);
      const f2 = uvFeatures.get(relCoord);
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