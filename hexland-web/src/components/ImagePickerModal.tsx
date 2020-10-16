import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import ImageCollectionItem from './ImageCollectionItem';
import { ProfileContext } from './ProfileContextProvider';
import { UserContext } from './UserContextProvider';

import { IImage } from '../data/image';
import { getUserPolicy } from '../data/policy';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';

interface IImageStatusProps {
  message: string;
  isError?: boolean | undefined;
}

function ImageStatus({ message, isError }: IImageStatusProps) {
  const className = useMemo(() => isError === true ? "App-image-error-status" : undefined, [isError]);
  return (
    <p className={className}>{message}</p>
  );
}

interface IImagePickerFormProps {
  show: boolean;
  setActiveImage: (value: IImage | undefined) => void;
  setImageCount: (value: number) => void;
  handleDelete: () => void;
}

export function ImagePickerForm({ show, setActiveImage, setImageCount, handleDelete }: IImagePickerFormProps) {
  const { logError } = useContext(AnalyticsContext);
  const { dataService, storageService, user } = useContext(UserContext);

  const [status, setStatus] = useState<IImageStatusProps>({ message: "" });

  // Reset the status when the dialog is opened
  useEffect(() => {
    if (show === true) {
      setStatus({ message: "" });
    }
  }, [show, setStatus]);

  // File uploads

  const handleFileChange = useCallback((e: any) => {
    if (!storageService || !user) {
      return;
    }

    const path = "/images/" + user.uid + "/" + uuidv4();
    const file = e.target.files[0] as File;
    if (!file) {
      return;
    }

    setStatus({ message: `Uploading ${file.name}...` });
    storageService.ref(path).put(file, {
      customMetadata: {
        originalName: file.name
      }
    }).then(() => setStatus({ message: `Processing ${file.name}...` })) // will be replaced when the onUpload function finishes
      .catch(e => {
        setStatus({ message: "Upload failed: " + e.message, isError: true });
        logError("Upload failed", e);
      });
  }, [logError, setStatus, storageService, user]);

  const [images, setImages] = useState<IImage[]>([]);
  useEffect(() => {
    if (!dataService || !user) {
      return undefined;
    }

    const imagesRef = dataService.getImagesRef(user.uid);
    console.log("watching images");
    return dataService.watch(
      imagesRef,
      r => {
        setImages(r?.images ?? []);
        setImageCount(r?.images?.length ?? 0);
        if (r !== undefined) {
          setStatus({ message: r.lastError, isError: r.lastError.length > 0 });
        }
      },
      e => logError("Error watching images", e)
    );
  }, [logError, setImageCount, setImages, setStatus, dataService, user]);

  const [index, setIndex] = useReducer(
    (state: number, action: number) => action === 0 ? 0 : state + action,
    0
  );

  const goBackDisabled = useMemo(() => index <= 0, [index]);
  const goForwardDisabled = useMemo(() => index >= (images.length - 1), [index, images]);
  const goBack = useCallback(() => setIndex(-1), [setIndex]);
  const goForward = useCallback(() => setIndex(1), [setIndex]);

  // When the list changes, we also reset the index to 0 so that the new item is visible right away
  const [list, setList] = useState<React.ReactNode[]>([]);
  useEffect(() => {
    setList(images.map(i => (
      <ImageCollectionItem key={i.path} image={i} />
    )));
    console.log("new images arrived; resetting index to 0");
    setIndex(0);
  }, [images, setIndex, setList]);

  // Sync the active image with our list and index
  const shownIndex = useMemo(
    () => list.length === 0 ? undefined : Math.max(0, Math.min(list.length - 1, index)),
    [index, list]
  );

  useEffect(
    () => setActiveImage(shownIndex !== undefined ? images[shownIndex] : undefined),
    [setActiveImage, images, shownIndex]
  );

  const shownItem = useMemo(
    () => shownIndex === undefined ? <div></div> : list[shownIndex],
    [list, shownIndex]
  );

  const saveDisabled = useMemo(() => shownIndex === undefined, [shownIndex]);

  return (
    <React.Fragment>
      <Form>
        <Form.Group>
          <Form.Label htmlFor="uploadButton">Upload a new image</Form.Label>
          <Form.Control id="uploadButton" as="input" type="file" accept="image/*" onChange={handleFileChange} />
          <Form.Text className="text-muted">The maximum image size is 2MB.</Form.Text>
        </Form.Group>
      </Form>
      <ImageStatus {...status} />
      <div className="App-image-collection">
        <Button variant="primary" disabled={goBackDisabled} onClick={goBack}>
          <FontAwesomeIcon icon={faChevronLeft} color="white" />
        </Button>
        {shownItem}
        <div className="App-image-collection-item">
          <Button variant="danger" disabled={saveDisabled} onClick={handleDelete}>
            <FontAwesomeIcon icon={faTimes} color="white" />
          </Button>
          <Button variant="primary" disabled={goForwardDisabled} onClick={goForward}>
            <FontAwesomeIcon icon={faChevronRight} color="white" />
          </Button>
          <div>{/* empty div to provide alignment */}</div>
        </div>
      </div>
    </React.Fragment>
  );
}

interface IImagePickerModalProps {
  show: boolean;
  handleClose: () => void;
  handleDelete: (image: IImage | undefined) => void;
  handleSave: (path: string | undefined) => void;
}

function ImagePickerModal({ show, handleClose, handleDelete, handleSave }: IImagePickerModalProps) {
  const profile = useContext(ProfileContext);
  const maxImages = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level).images,
    [profile]
  );

  const [activeImage, setActiveImage] = useState<IImage | undefined>(undefined);
  const [imageCount, setImageCount] = useState(0);
  const activeImagePath = useMemo(() => activeImage?.path, [activeImage]);
  const saveDisabled = useMemo(() => activeImagePath === undefined, [activeImagePath]);
  const doHandleSave = useCallback(() => {
    if (activeImagePath === undefined) {
      return;
    }

    handleSave(activeImagePath);
  }, [activeImagePath, handleSave]);

  const doHandleDelete = useCallback(() => {
    if (activeImage === undefined) {
      return;
    }

    handleDelete(activeImage);
  }, [activeImage, handleDelete]);

  const handleUseNone = useCallback(() => { handleSave(undefined); }, [handleSave]);

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Choose image ({imageCount}/{maxImages})</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ImagePickerForm show={show} setActiveImage={setActiveImage} setImageCount={setImageCount}
          handleDelete={doHandleDelete} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="warning" onClick={handleUseNone}>Use no image</Button>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="primary" disabled={saveDisabled} onClick={doHandleSave}>Use this image</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ImagePickerModal;