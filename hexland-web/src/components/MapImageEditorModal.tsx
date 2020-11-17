import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ImagePickerForm } from './ImagePickerModal';
import { ProfileContext } from './ProfileContextProvider';
import { IImage, IMapImageProperties } from '../data/image';
import { getUserPolicy } from '../data/policy';

import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

import { v4 as uuidv4 } from 'uuid';

interface IMapImageEditorProps {
  show: boolean;
  mapImage: IMapImageProperties | undefined;
  handleClose: () => void;
  handleDelete: (id: string) => void;
  handleImageDelete: (image: IImage | undefined) => void;
  handleSave: (mapImage: IMapImageProperties) => void;
}

function MapImageEditorModal(
  { show, mapImage, handleClose, handleDelete, handleImageDelete, handleSave }: IMapImageEditorProps
) {
  // This is of course quite similar to the image picker modal
  const { profile } = useContext(ProfileContext);
  const maxImages = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level).images,
    [profile]
  );

  const [activeImage, setActiveImage] = useState<IImage | undefined>(undefined);
  const [imageCount, setImageCount] = useState(0);
  const activeImagePath = useMemo(() => activeImage?.path, [activeImage]);
  const saveDisabled = useMemo(() => activeImagePath === undefined, [activeImagePath]);

  // Initialise the active image to the one in the map image record if we have one
  useEffect(() => {
    if (show) {
      setActiveImage(mapImage?.image);
    }
  }, [mapImage, show]);

  const doHandleSave = useCallback(() => {
    if (activeImage === undefined) {
      return;
    }

    handleSave({
      id: mapImage === undefined ? uuidv4() : mapImage.id,
      image: activeImage
    });
  }, [activeImage, handleSave, mapImage]);

  const doHandleDelete = useCallback(() => {
    if (mapImage === undefined) {
      return;
    }

    handleDelete(mapImage.id);
  }, [handleDelete, mapImage]);

  const doHandleDeleteImage = useCallback(() => {
    if (activeImage === undefined) {
      return;
    }

    handleImageDelete(activeImage);
  }, [activeImage, handleImageDelete]);

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Map image ({imageCount}/{maxImages})</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ImagePickerForm show={show} setActiveImage={setActiveImage} setImageCount={setImageCount}
          handleDelete={doHandleDeleteImage} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={doHandleDelete}>Delete</Button>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="primary" disabled={saveDisabled} onClick={doHandleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MapImageEditorModal;