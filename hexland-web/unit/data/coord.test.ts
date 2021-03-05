import { coordsEqual, edgesEqual, getFace, getTile, createGridCoord, createGridEdge } from "./coord";

test('convert to and from grid coords', () => {
  const tileDim = 12;
  for (let i = 0; i < 5000; ++i) {
    let x = Math.floor(Math.random() * 1000) - 500;
    let y = Math.floor(Math.random() * 1000) - 500;
    let coord = { x: x, y: y };
    let tile = getTile(coord, tileDim);
    let face = getFace(coord, tileDim);
    let coord2 = createGridCoord(tile, face, tileDim);

    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.x).toBeLessThan(tileDim);

    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeLessThan(tileDim);

    expect(coordsEqual(coord, coord2)).toBeTruthy();

    let e = Math.floor(Math.random() * 3);
    let edge = { x: x, y: y, edge: e };
    tile = getTile(edge, tileDim);
    face = getFace(edge, tileDim);
    let edge2 = createGridEdge(tile, face, tileDim, e);

    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.x).toBeLessThan(tileDim);

    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeLessThan(tileDim);

    expect(edgesEqual(edge, edge2)).toBeTruthy();
  }
});