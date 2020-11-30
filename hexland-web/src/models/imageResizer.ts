import { Change, createImageAdd, createImageRemove } from "../data/change";
import { IIdDictionary } from "../data/identified";
import { Anchor, anchorsEqual, anchorsFormValidImage, anchorString, IMapControlPointDictionary, IMapControlPointIdentifier, IMapImage } from "../data/image";

// Manages image sizing via the (start, end) control points.
// For now we support only one selected image at a time.
// Because we're okay with supporting a quite limited number of live control points,
// it's okay to identify them by iterating.
// TODO #135 Would it be cleaner if this class took over responsibility for image
// drag-move as well?
export class ImageResizer {
  private readonly _images: IIdDictionary<IMapImage>; // only read this
  private readonly _highlights: IMapControlPointDictionary; // we manage this
  private readonly _selection: IMapControlPointDictionary; // and this

  private _dragging: IMapControlPointIdentifier | undefined;

  constructor(
    images: IIdDictionary<IMapImage>,
    highlights: IMapControlPointDictionary,
    selection: IMapControlPointDictionary
  ) {
    this._images = images;
    this._highlights = highlights;
    this._selection = selection;
  }

  get inDrag() { return this._dragging !== undefined; }

  dragCancel() {
    this._highlights.clear();
    this._dragging = undefined;
  }

  // Populates a list of changes that would create the image edit.
  dragEnd(anchor: Anchor | undefined, changes: Change[]): IMapImage | undefined {
    this.moveHighlight(anchor);
    if (this._dragging === undefined) {
      return undefined;
    }

    const image = this._images.get(this._dragging.id);
    const startedAt = this._selection.get(this._dragging);
    const movedTo = this._highlights.get(this._dragging);
    const otherAnchor = this._dragging.which === 'start' ? image?.end : image?.start;
    if (
      image !== undefined && startedAt !== undefined && movedTo !== undefined &&
      !anchorsEqual(startedAt.anchor, movedTo.anchor) &&
      anchorsFormValidImage(movedTo.anchor, otherAnchor) // TODO #135 draw highlights in red when this is false
    ) {
      // _images.get() may have returned internal fields, which we don't want to include!
      const updatedImage: IMapImage = {
        id: image.id,
        image: image.image,
        start: this._dragging.which === 'start' ? movedTo.anchor : image.start,
        end: this._dragging.which === 'end' ? movedTo.anchor : image.end
      };

      changes.push(
        createImageRemove(this._dragging.id),
        createImageAdd(updatedImage)
      );

      this.dragCancel();
      return updatedImage;
    } else {
      this.dragCancel();
      return undefined;
    }
  }

  // Returns true if we started a drag, else false.
  dragStart(hitTest: (anchor: Anchor) => boolean): boolean {
    this.dragCancel();
    for (const s of this._selection) {
      if (hitTest(s.anchor) === true) {
        this._dragging = s;
        this._highlights.add(s);
        return true;
      }
    }
    
    return false;
  }

  // Returns true if something changed, else false.
  moveHighlight(anchor: Anchor | undefined): boolean {
    if (this._dragging === undefined) {
      return false;
    }

    const currently = this._highlights.get(this._dragging);
    console.log(`moving: ${anchorString(currently?.anchor)} -> ${anchorString(anchor)}`);
    if (currently !== undefined && (anchor === undefined || anchorsEqual(currently.anchor, anchor))) {
      // No change.
      return false;
    }

    if (currently !== undefined) {
      this._highlights.remove(currently);
    }

    if (anchor !== undefined) {
      console.log(`adding highlight at ${anchorString(anchor)}`);
      this._highlights.add({ ...this._dragging, anchor: anchor });
    }

    return true;
  }

  // Draws the highlights for an image (or removes them.)
  setSelectedImage(image: IMapImage | undefined) {
    if (image !== undefined) {
      console.log(`selecting image ${image.id} at ${anchorString(image.start)}, ${anchorString(image.end)}`);
    }
    this.dragCancel();
    this._selection.clear();
    if (image !== undefined) {
      this._selection.add({ anchor: image.start, id: image.id, which: 'start' });
      this._selection.add({ anchor: image.end, id: image.id, which: 'end' });
    }
  }
}