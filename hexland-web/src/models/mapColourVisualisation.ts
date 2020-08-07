import { Areas } from './areas';
import { MapColouring } from './colouring';

import { IGridCoord } from '../data/coord';
import { FeatureColour } from './featureColour';

import * as THREE from 'three';

// Visualises the map colours as areas.
// Don't addToScene() it directly, but call visualise() -- this object needs to
// manage its own materials (which may vary).

export class MapColourVisualisation extends Areas {
  private _materials: THREE.Material[] = [];

  removeFromScene() {
    super.removeFromScene();
    this._materials.forEach(m => m.dispose());
    this._materials = [];
  }

  visualise(scene: THREE.Scene, colouring: MapColouring) {
    colouring.visualise(this, (position: IGridCoord, mapColour: number, mapColourCount: number) => {
      // If our scene has changed or the number of map colours has changed, we need to re-generate
      // our materials list:
      if (scene !== this.scene || mapColourCount !== this._materials.length) {
        this.removeFromScene();
        this._materials = [...Array(mapColourCount).keys()].map(c => {
          var colour = new FeatureColour(c / mapColourCount);
          return new THREE.MeshBasicMaterial({ color: colour.dark.getHex() });
        });
        this.setMaterials(this._materials);
        this.addToScene(scene);
      }

      return { position: position, colour: mapColour };
    });
  }
}