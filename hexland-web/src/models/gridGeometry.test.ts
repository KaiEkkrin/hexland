import { coordString, edgeString, IGridCoord, IGridEdge } from '../data/coord';
import { FeatureDictionary, IFeature } from '../data/feature';
import { IGridGeometry } from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { SquareGridGeometry } from './squareGridGeometry';

import fluent from 'fluent-iterable';

function testQuadtreeAdjacencyEquivalence(geometry: IGridGeometry) {
  const fEdges = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  const fFaces = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  const qEdges = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  const qFaces = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  for (var size of [1, 2, 4, 8, 16, 32]) {
    for (var x of [0, -2, 6]) {
      for (var y of [0, -4, 7]) {
        // Fill the faces and edges of the face adjacencies here -- rejecting any
        // inside the quadtree coord:
        fEdges.clear();
        fFaces.clear();
        for (var j = 0; j < size; ++j) {
          for (var i = 0; i < size; ++i) {
            geometry.forEachAdjacentFace(
              { x: x + i, y: y + j },
              (f, e) => {
                if (f.x < x || f.y < y || f.x >= x + size || f.y >= y + size) {
                  fFaces.add({ position: f, colour: 0 });
                  fEdges.add({ position: e, colour: 0 });
                }
              }
            )
          }
        }

        // Fill the faces and edges of the quadtree adjacencies
        qEdges.clear();
        qFaces.clear();
        geometry.forEachQuadtreeAdjacentFace(
          { x: x, y: y, size: size },
          (f, e) => {
            qFaces.add({ position: f, colour: 0 });
            qEdges.add({ position: e, colour: 0 });
          }
        )

        // They should match
        var faceCount = fluent(fFaces).count();
        expect(fluent(qFaces).count()).toBe(faceCount);

        var edgeCount = fluent(fEdges).count();
        expect(fluent(qEdges).count()).toBe(edgeCount);

        qFaces.forEach(f => {
          expect(fFaces.get(f.position)?.colour).toBe(f.colour);
        });

        qEdges.forEach(e => {
          expect(fEdges.get(e.position)?.colour).toBe(e.colour);
        });
      }
    }
  }
}

test('Hex grid quadtree adjacency is equivalent to face adjacency', () => {
  testQuadtreeAdjacencyEquivalence(new HexGridGeometry(1, 1));
});

test('Square grid quadtree adjacency is equivalent to face adjacency', () => {
  testQuadtreeAdjacencyEquivalence(new SquareGridGeometry(1, 1));
});