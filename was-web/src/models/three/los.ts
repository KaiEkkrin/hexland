import { GridEdge, edgeString } from "../../data/coord";
import { IFeature } from "../../data/feature";
import { LoSPosition, losPositionsEqual } from "../../data/losPosition";
import { Drawn } from "../drawn";
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { RedrawFlag } from "../redrawFlag";
import { RenderTargetReader } from "./renderTargetReader";

import * as THREE from "three";
import fluent from "fluent-iterable";

// Shader-based LoS.
//
// Careful with this!  In order for it to work correctly, we need to not use the built-in
// attributes `modelMatrix` or `modelViewMatrix`, because they are not instanced.  Instead
// we refer to the built-in attribute `instanceMatrix` in place of `modelMatrix`.  `viewMatrix`
// is not instanced anyway and can be used as expected.
//
// We can assume that a token never overlaps a wall (code elsewhere guarantees this), although
// it may be tangent to one.
//
// To do this, for each wall of the shader, I want to transform the following geometry for
// each token, given the wall co-ordinates and the token's centre position and radius:
//
//                    P_______________Q_______R_______________S
//                      \_            |\     /|            _/
//                        \_          | \   / |          _/
//                          \_        |  \ /  |        _/
//                            \_      |   X   |      _/
//                              \_    |  / \  |    _/
//                                \_  | /   \ |  _/
//                                  \_|/     \|_/
//                                    T=======U
//                                   . .     . .
//                                  .    . .    .
//                                 .   .     .   .
//                                .  . ####### .  .
//                               . .#############. .
//                              ..#################..
//                             . ################### .
//                               ###################    <-- token
//                               ###################
//                                #################
//                                  #############
//                                     #######
//                                         
//
// as follows:
//
// - ===== is the wall edge; ----- define the other edges of our LoS triangles;
//
// Vertices
// --------
//
// We expect input vertices P, Q, R, S, X, T, U, T' and U'. We disregard their input
// positions and relocate them as follows:
//
// - T and U become the vertices of the opposite ends of the wall edge.
// - T' and U' get the same positions, so that we can assign them different vertex colours
// (see later.)
// - P, Q, R and S all become vertices 2x viewable area away from the token centre.
// - X becomes the vertex where lines RT and QU intersect, if it exists and the wall
// is between the token centre and point X (see later.)
//
// Edges
// -----
//
// - TU is the wall edge.
// - We also define two vertices T' and U' such that T'U' is also the wall edge (this
// allows us to assign them different vertex colours.)
// - PT and RT are segments of the two possible lines that go through vertex T and are
// tangent to the token circle.
// - QU and SU are segments of the two possible lines that go through vertex U and are
// tangent to the token circle.
//
// Triangles
// ---------
//
// The input geometry consists of the following triangles: PQT', QXT, TXU, UXR, RXQ, RSU'.
// Note the references to T' and U' rather than T or U for the two outer, "penumbra"
// triangles.
//
// Case 1
// ------
//
// (As illustrated in the diagram above.)
//
// Point X exists (lines RT and QU are not parallel), and the wall edge TU lies between
// the token centre and point X.
//
// - The position of vertex X is the intersection point between lines RT and QU.
// - The following vertices are assigned the colour black, being totally shadowed: T, X, U.
// - The following vertices are assigned the colour white, being totally visible: P, S, T', U'.
// - Vertex Q is assigned a grey colour, linearly interpolated between its distance from point P
// (white) and its distance from point X (black).
// - Vertex R is assigned a grey colour, linearly interpolated between its distance from point S
// (white) and its distance from point X (black).
//
// Case 2
// ------
//
// Lines RT and QU are parallel (point X does not exist), or, point X does exist but
// it lies on the opposite side of the token from the wall edge. Diagram:
//
//                    P_______________R_______Q_______________S
//                      \_            |\      |            _/
//                        \_          | \     |          _/
//                          \_        |  \    |        _/
//                            \_      |   \   |      _/
//                              \_    |    \  |    _/
//                                \_  |     \ |  _/
//                                  \_|      \|_/
//                                    T=======U
//                                    . .   . .
//                                    .   .   .
//                                    . . # . .
//                                    .#######.
//                                    #########   <-- token
//                                     #######
//                                        #
//
//
//
// - The position of point X is set equal to the position of point U (this makes two of the four
// inner triangles disappear, since they will have area 0.)
// - The following vertices are assigned the colour black, being totally shadowed: Q, R, T, X, U.
// - The following vertices are assigned the colour white, being totally visible: P, S, T', U'.
//
// Composing together the LoS of multiple tokens
// ---------------------------------------------
//
// This will render the LoS from a single token; to compose multiple tokens together,
// repeat in batches (size 4?) and run a "merge" shader that adds together all the textures in the batches.
// When we've got a final LoS render, we can overlay it onto the screen one by multiply to create
// the drawn LoS layer, and also sample it for allowed/disallowed move purposes.
// We're going to need uniforms:
// - tokenCentre (vec3)
// - tokenRadius (float)
// - zValue (float) (for determining which edges to project; *not* q)
// - wallT (vec3) - canonical T position in local space
// - wallU (vec3) - canonical U position in local space
const tokenCentre = "tokenCentre";
const tokenRadius = "tokenRadius";
const zValue = "zValue";
const wallT = "wallT";
const wallU = "wallU";

const featureShader = {
  uniforms: {
    tokenCentre: { type: "v3", value: null },
    tokenRadius: { type: "f", value: null },
    zValue: { type: "f", value: null },
    wallT: { type: "v3", value: null },
    wallU: { type: "v3", value: null },
  },
  vertexShader: `
    uniform vec3 tokenCentre;
    uniform float tokenRadius;
    uniform float zValue;
    uniform vec3 wallT;
    uniform vec3 wallU;

    varying vec4 vColour;

    // Large value to project shadows beyond any visible area (world space)
    const float worldBound = 1000.0;
    const float epsilon = 0.00001;

    // Vertex type constants
    const int V_T = 0;
    const int V_U = 1;
    const int V_T_PRIME = 2;
    const int V_U_PRIME = 3;
    const int V_P = 4;
    const int V_Q = 5;
    const int V_R = 6;
    const int V_S = 7;
    const int V_X = 8;

    // Project point to world bounds along direction, returning the closer intersection
    vec3 projectToBounds(vec3 origin, vec3 dir) {
      // Handle near-zero direction components to avoid division issues
      float tX = abs(dir.x) > epsilon
        ? (dir.x > 0.0 ? (worldBound - origin.x) / dir.x : (-worldBound - origin.x) / dir.x)
        : 1e10;
      float tY = abs(dir.y) > epsilon
        ? (dir.y > 0.0 ? (worldBound - origin.y) / dir.y : (-worldBound - origin.y) / dir.y)
        : 1e10;
      float t = min(tX, tY);
      return vec3(origin.xy + dir.xy * t, origin.z);
    }

    // Compute tangent directions from vertex V to token circle
    // Returns directions via out parameters:
    // - outerTangent: tangent line on the "outside" (away from the other wall endpoint)
    // - innerTangent: tangent line on the "inside" (toward the other wall endpoint)
    // The "outer" vs "inner" distinction depends on which side of the V-to-token line
    // the other endpoint is on.
    void computeTangentDirections(
      vec3 V,
      vec3 otherEndpoint,
      vec3 tokenPos,
      float radius,
      out vec3 outerTangent,
      out vec3 innerTangent
    ) {
      vec2 toToken = tokenPos.xy - V.xy;
      float dist = length(toToken);

      // Handle degenerate case: vertex inside or very close to token
      if (dist <= radius + epsilon) {
        // Use perpendicular directions
        vec2 perp = normalize(vec2(-toToken.y, toToken.x));
        outerTangent = vec3(perp, 0.0);
        innerTangent = vec3(-perp, 0.0);
        return;
      }

      // Calculate angle from V-to-token to tangent line
      float sinAlpha = radius / dist;
      float cosAlpha = sqrt(1.0 - sinAlpha * sinAlpha);

      // Normalise the direction AWAY from the token (shadow projection direction)
      // We negate toToken because shadows project away from the token, not towards it
      vec2 awayFromToken = -toToken / dist;

      // Rotate to get the two tangent directions (projecting away from token)
      // Left tangent (rotate counter-clockwise by alpha)
      vec3 leftDir = vec3(
        awayFromToken.x * cosAlpha - awayFromToken.y * sinAlpha,
        awayFromToken.x * sinAlpha + awayFromToken.y * cosAlpha,
        0.0
      );

      // Right tangent (rotate clockwise by alpha)
      vec3 rightDir = vec3(
        awayFromToken.x * cosAlpha + awayFromToken.y * sinAlpha,
        -awayFromToken.x * sinAlpha + awayFromToken.y * cosAlpha,
        0.0
      );

      // Determine which is "outer" vs "inner" based on the other endpoint
      // The inner tangent is the one that points more toward the other endpoint
      vec2 toOther = otherEndpoint.xy - V.xy;
      float leftDot = dot(leftDir.xy, toOther);
      float rightDot = dot(rightDir.xy, toOther);

      if (leftDot > rightDot) {
        innerTangent = leftDir;
        outerTangent = rightDir;
      } else {
        innerTangent = rightDir;
        outerTangent = leftDir;
      }
    }

    // Find intersection of two lines in 2D
    // Line 1: point1 + t * dir1
    // Line 2: point2 + s * dir2
    // Returns intersection point via out parameter, returns false if parallel
    bool lineIntersection(vec3 point1, vec3 dir1, vec3 point2, vec3 dir2, out vec3 intersection) {
      float cross = dir1.x * dir2.y - dir1.y * dir2.x;
      if (abs(cross) < epsilon) {
        return false; // Lines are parallel
      }

      vec2 diff = point2.xy - point1.xy;
      float t = (diff.x * dir2.y - diff.y * dir2.x) / cross;
      intersection = vec3(point1.xy + dir1.xy * t, point1.z);
      return true;
    }

    // Check if X is valid for Case 1 geometry:
    // 1. X must be in the forward direction along the inner tangent rays (not behind the wall)
    // 2. X must be on the opposite side of the wall from the token
    bool isXValid(vec3 X, vec3 T, vec3 U, vec3 tokenPos, vec3 T_inner, vec3 U_inner) {
      // Check 1: X must be in the forward direction from T along T_inner
      // (If dot product is negative, X is behind T in the opposite direction)
      vec2 TtoX = X.xy - T.xy;
      if (dot(TtoX, T_inner.xy) < 0.0) {
        return false;
      }

      // Check 2: X must be in the forward direction from U along U_inner
      vec2 UtoX = X.xy - U.xy;
      if (dot(UtoX, U_inner.xy) < 0.0) {
        return false;
      }

      // Check 3: X should be on the opposite side of the wall from the token
      vec2 wallMid = (T.xy + U.xy) * 0.5;
      vec2 wallToToken = tokenPos.xy - wallMid;
      vec2 wallToX = X.xy - wallMid;
      return dot(wallToToken, wallToX) < 0.0;
    }

    void main() {
      int vType = gl_VertexID % 9;

      // Transform matrix for final clip space output
      mat4 VP = projectionMatrix * viewMatrix;

      // Transform wall endpoints to world space (canonical -> actual position)
      vec3 T = (instanceMatrix * vec4(wallT.xy, zValue, 1.0)).xyz;
      vec3 U = (instanceMatrix * vec4(wallU.xy, zValue, 1.0)).xyz;

      // Token centre and radius are already in world space
      vec3 token = tokenCentre;
      float radius = tokenRadius;

      // Compute tangent directions for T and U (all in world space)
      vec3 T_outer, T_inner, U_outer, U_inner;
      computeTangentDirections(T, U, token, radius, T_outer, T_inner);
      computeTangentDirections(U, T, token, radius, U_outer, U_inner);

      // Find X (intersection of inner tangent rays from T and U)
      vec3 X;
      bool xValid = lineIntersection(T, T_inner, U, U_inner, X);
      xValid = xValid && isXValid(X, T, U, token, T_inner, U_inner);

      // Default colours
      vec4 BLACK = vec4(0.0, 0.0, 0.0, 1.0);
      vec4 WHITE = vec4(1.0, 1.0, 1.0, 1.0);

      // Case 2: X is invalid, collapse geometry
      if (!xValid) {
        X = U;
      }

      // Route by vertex type (all positions in world space, transformed to clip at end)
      if (vType == V_T) {
        // T: wall endpoint, umbra (black)
        gl_Position = VP * vec4(T, 1.0);
        vColour = BLACK;
      } else if (vType == V_U) {
        // U: wall endpoint, umbra (black)
        gl_Position = VP * vec4(U, 1.0);
        vColour = BLACK;
      } else if (vType == V_T_PRIME) {
        // T': wall endpoint for penumbra triangle (white)
        gl_Position = VP * vec4(T, 1.0);
        vColour = WHITE;
      } else if (vType == V_U_PRIME) {
        // U': wall endpoint for penumbra triangle (white)
        gl_Position = VP * vec4(U, 1.0);
        vColour = WHITE;
      } else if (vType == V_P) {
        // P: outer tangent from T, projected to bounds (white)
        gl_Position = VP * vec4(projectToBounds(T, T_outer), 1.0);
        vColour = WHITE;
      } else if (vType == V_Q) {
        // Q: inner tangent from T, projected to bounds
        // Grey in Case 1 (penumbra), black in Case 2 (umbra)
        gl_Position = VP * vec4(projectToBounds(T, T_inner), 1.0);
        if (xValid) {
          // Case 1: interpolate grey based on position in penumbra
          // For now, use a simple midpoint grey; can refine later
          float greyValue = 0.5; // Placeholder - will refine in next step
          vColour = vec4(greyValue, greyValue, greyValue, 1.0);
        } else {
          // Case 2: solid black umbra
          vColour = BLACK;
        }
      } else if (vType == V_R) {
        // R: inner tangent from U, projected to bounds
        // Grey in Case 1 (penumbra), black in Case 2 (umbra)
        gl_Position = VP * vec4(projectToBounds(U, U_inner), 1.0);
        if (xValid) {
          // Case 1: interpolate grey based on position in penumbra
          float greyValue = 0.5; // Placeholder - will refine in next step
          vColour = vec4(greyValue, greyValue, greyValue, 1.0);
        } else {
          // Case 2: solid black umbra
          vColour = BLACK;
        }
      } else if (vType == V_S) {
        // S: outer tangent from U, projected to bounds (white)
        gl_Position = VP * vec4(projectToBounds(U, U_outer), 1.0);
        vColour = WHITE;
      } else if (vType == V_X) {
        // X: inner tangent intersection (black)
        gl_Position = VP * vec4(X, 1.0);
        vColour = BLACK;
      }
    }
  `,
  fragmentShader: `
    varying vec4 vColour;

    void main() {
      gl_FragColor = vColour;
    }
  `,
};

// This feature object draws the shadows cast by the walls using the above shader.
// (It doesn't own the material.)
// Edit the material before rendering this to draw LoS for different tokens
class LoSFeatureObject extends InstancedFeatureObject<
  GridEdge,
  IFeature<GridEdge>
> {
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _material: THREE.ShaderMaterial;

  constructor(
    gridGeometry: IGridGeometry,
    z: number,
    q: number,
    material: THREE.ShaderMaterial,
    maxInstances: number
  ) {
    super(
      edgeString,
      (o, p) => gridGeometry.transformToEdge(o, p),
      maxInstances
    );
    const single = gridGeometry.toSingle();
    const vertices = [...single.createLoSVertices(z, q)];

    this._geometry = new THREE.InstancedBufferGeometry();
    this._geometry.setFromPoints(vertices);
    this._geometry.setIndex(gridGeometry.createLoSIndices());

    this._material = material;
  }

  protected createMesh(maxInstances: number) {
    return new THREE.InstancedMesh(
      this._geometry,
      this._material,
      maxInstances
    );
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
  }
}

class LoSFeatures extends InstancedFeatures<GridEdge, IFeature<GridEdge>> {
  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    z: number,
    q: number,
    material: THREE.ShaderMaterial,
    maxInstances?: number | undefined
  ) {
    super(
      geometry,
      redrawFlag,
      edgeString,
      (maxInstances) => {
        return new LoSFeatureObject(geometry, z, q, material, maxInstances);
      },
      maxInstances
    );
  }
}

// This class encapsulates the LoS drawing along with its intermediate surfaces.
const maxComposeCount = 8;
export class LoS extends Drawn {
  private readonly _featureClearColour: THREE.Color;
  private readonly _features: LoSFeatures;

  private readonly _featureMaterial: THREE.ShaderMaterial;
  private readonly _featureRenderTargets: THREE.WebGLRenderTarget[];
  private readonly _featureScene: THREE.Scene;
  private readonly _featureUniforms: Record<string, THREE.IUniform>;

  private readonly _composeClearColour: THREE.Color;

  private readonly _composeGeometry: THREE.BufferGeometry;
  private readonly _composeRenderTarget: THREE.WebGLRenderTarget;
  private readonly _composeScene: THREE.Scene;

  private readonly _composedTargetReader: RenderTargetReader;

  private _tokenPositions: LoSPosition[] = [];

  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    z: number,
    q: number,
    renderWidth: number,
    renderHeight: number,
    maxInstances?: number | undefined
  ) {
    super(geometry, redrawFlag);

    this._featureClearColour = new THREE.Color(1, 1, 1); // visible by default; we draw the shadows

    // Get canonical wall endpoint positions from the geometry
    const single = geometry.toSingle();
    const vertices = [...single.createLoSVertices(z, q)];

    this._featureUniforms = THREE.UniformsUtils.clone(featureShader.uniforms);
    this._featureUniforms[tokenCentre].value = new THREE.Vector3();
    this._featureUniforms[tokenRadius].value = 0.5; // Default; updated per token in render
    this._featureUniforms[zValue].value = z;
    this._featureUniforms[wallT].value = vertices[0].clone(); // Canonical T position
    this._featureUniforms[wallU].value = vertices[1].clone(); // Canonical U position
    this._featureMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: this._featureUniforms,
      vertexShader: featureShader.vertexShader,
      fragmentShader: featureShader.fragmentShader,
      // Use MIN blending to retain the minimum (darkest) color value when
      // multiple shadow fragments overlap the same pixel
      blending: THREE.CustomBlending,
      blendEquation: THREE.MinEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });

    this._features = new LoSFeatures(
      geometry,
      redrawFlag,
      z,
      q,
      this._featureMaterial,
      maxInstances
    );
    this._featureRenderTargets = [];
    for (let i = 0; i < maxComposeCount; ++i) {
      this._featureRenderTargets.push(
        this.createRenderTarget(renderWidth, renderHeight)
      );
    }

    this._featureScene = new THREE.Scene();
    this._features.addToScene(this._featureScene);

    this._composeClearColour = new THREE.Color(0, 0, 0); // invisible unless seen by something
    this._composeRenderTarget = this.createRenderTarget(
      renderWidth,
      renderHeight
    );
    this._composeScene = new THREE.Scene();

    this._composedTargetReader = new RenderTargetReader(
      this._composeRenderTarget
    );

    // Create the geometry we use to compose the LoS together
    this._composeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(-1, 1, 0),
      new THREE.Vector3(1, 1, 0),
    ]);
    this._composeGeometry.setIndex([0, 1, 2, 1, 2, 3]);

    // Yes, having the UVs specified is mandatory :P
    this._composeGeometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)
    );
  }

  private compose(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    count: number
  ) {
    // Composes the contents of the given number of feature renders onto the compose target.
    // TODO #52 To successfully down-scale the LoS, this here needs its own camera
    renderer.setRenderTarget(this._composeRenderTarget);
    const materials: THREE.MeshBasicMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < count; ++i) {
      const material = new THREE.MeshBasicMaterial({
        // Use MAX blending to combine LoS from multiple tokens:
        // a pixel is visible if ANY token can see it
        blending: THREE.CustomBlending,
        blendEquation: THREE.MaxEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        map: this._featureRenderTargets[i].texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      materials.push(material);

      const mesh = new THREE.Mesh(this._composeGeometry, material);
      meshes.push(mesh);
      this._composeScene.add(mesh);
    }

    renderer.render(this._composeScene, camera);

    // Put settings back
    meshes.forEach((m) => this._composeScene.remove(m));
    materials.forEach((m) => m.dispose());
  }

  private createRenderTarget(renderWidth: number, renderHeight: number) {
    return new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      depthBuffer: false,
      // Using linear filtering here, though counter-intuitive, will reduce our vulnerability
      // to hairline 'cracks' forming in between shadows that ought to line up but don't quite
      // because of float inaccuracies/quirks of the rasterizer
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
  }

  // Accesses the LoS features themselves -- these should be sync'd with the walls,
  // but with only colour 0.
  get features() {
    return this._features;
  }

  // Accesses the composed LoS render target so that we can use it to draw.
  get target() {
    return this._composeRenderTarget;
  }

  // Checks the LoS for the given client position and returns true if the position
  // is visible, else false.
  // TODO #56 This is now really messed up and needs sorting out :)
  checkLoS(cp: THREE.Vector3) {
    const x = Math.floor((cp.x + 1) * 0.5 * this._composeRenderTarget.width);
    const y = Math.floor((cp.y + 1) * 0.5 * this._composeRenderTarget.height);
    function* enumerateSamplePositions() {
      yield [x, y];
      yield [x - 2, y - 2];
      yield [x + 2, y - 2];
      yield [x - 2, y + 2];
      yield [x + 2, y + 2];
    }

    const visibleCount = fluent(enumerateSamplePositions())
      .map((p) =>
        this._composedTargetReader.sample(
          p[0],
          p[1],
          (buf, offset) => buf[offset] ?? 0
        )
      )
      .sum();
    return visibleCount > 0;
  }

  // Renders the LoS frames.  Overwrites the render target and clear colours.
  // TODO Can I sometimes avoid re-rendering these?  Separate the `needsRedraw` flags?
  render(
    camera: THREE.Camera,
    fixedCamera: THREE.Camera,
    renderer: THREE.WebGLRenderer
  ) {
    // Always clear the composed target to begin with (otherwise, with 0 token positions to
    // render, we'll end up returning the old composed target!)
    renderer.setRenderTarget(this._composeRenderTarget);
    renderer.setClearColor(this._composeClearColour);
    renderer.clear();

    // Render the LoS features for each token position
    let lastRenderedIndex = maxComposeCount;
    this._tokenPositions.forEach((pos, i) => {
      const targetIndex = i % maxComposeCount;
      // Use the pre-calculated world centre and radius directly
      this._featureUniforms[tokenCentre].value.copy(pos.centre);
      this._featureUniforms[tokenRadius].value = pos.radius;

      renderer.setRenderTarget(this._featureRenderTargets[targetIndex]);
      renderer.setClearColor(this._featureClearColour);
      renderer.clear();
      renderer.render(this._featureScene, camera);
      lastRenderedIndex = targetIndex;

      if (targetIndex === maxComposeCount - 1) {
        // We've filled all our feature render targets; we must compose these down
        // before we can continue.
        this.compose(fixedCamera, renderer, maxComposeCount);
        lastRenderedIndex = maxComposeCount;
      }
    });

    // Complete any composition we might need to do
    if (lastRenderedIndex < maxComposeCount) {
      this.compose(fixedCamera, renderer, lastRenderedIndex + 1);
    }

    renderer.setRenderTarget(null);
    this._composedTargetReader.refresh(renderer);
  }

  resize(width: number, height: number) {
    this._featureRenderTargets.forEach((t) => t.setSize(width, height));
    this._composeRenderTarget.setSize(width, height);
  }

  // Assigns the positions of the tokens to draw LoS for.
  setTokenPositions(positions: LoSPosition[]) {
    // If these are the same, we don't need to do anything:
    if (losPositionsEqual(positions, this._tokenPositions)) {
      return;
    }

    this._tokenPositions = [...positions];
    this.setNeedsRedraw();
  }

  dispose() {
    if (this._isDisposed === false) {
      this._features.dispose();
      this._featureMaterial.dispose();
      this._featureRenderTargets.forEach((t) => t.dispose());

      this._composeGeometry.dispose();
      this._composeRenderTarget.dispose();

      this._isDisposed = true;
    }
  }
}
