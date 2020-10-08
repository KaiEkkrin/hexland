import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { FirebaseContext } from './FirebaseContextProvider';
import { UserContext } from './UserContextProvider';

import { IImage } from '../data/image';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';

interface IImageCollectionItemProps {
  image: IImage;
}

function ImageCollectionItem(props: IImageCollectionItemProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const firebaseContext = useContext(FirebaseContext);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!firebaseContext.storage) {
      return;
    }

    firebaseContext.storage.ref(props.image.path).getDownloadURL()
      .then(u => setUrl(String(u)))
      .catch(e => analyticsContext.logError("Failed to get download URL for image " + props.image.path, e));
  }, [analyticsContext, firebaseContext.storage, props.image, setUrl]);

  return (
    <div className="App-image-collection-item">
      <img className="App-image-collection-image" src={url} alt={props.image.name} />
      <p>{props.image.name}</p>
    </div>
  );
}

interface IImageStatusProps {
  message: string;
  isError?: boolean | undefined;
}

function ImageStatus(props: IImageStatusProps) {
  const className = useMemo(() => props.isError === true ? "App-image-error-status" : undefined, [props.isError]);
  return (
    <p className={className}>{props.message}</p>
  );
}

interface IImagePickerModalProps {
  show: boolean;
  handleClose: () => void;
  handleSave: (path: string | undefined) => void;
}

function ImagePickerModal(props: IImagePickerModalProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);

  const [status, setStatus] = useState<IImageStatusProps>({ message: "" });

  // File uploads

  const handleFileChange = useCallback((e: any) => {
    if (!firebaseContext.storage || !userContext.user) {
      return;
    }

    // TODO #149 Think about code structure (move stuff into a service object?)
    const path = "/images/" + userContext.user.uid + "/" + uuidv4();
    const file = e.target.files[0] as File;
    if (!file) {
      return;
    }

    setStatus({ message: `Uploading ${file.name}...` });
    firebaseContext.storage.ref(path).put(file, {
      customMetadata: {
        originalName: file.name
      }
    }).then(() => setStatus({ message: `Processing ${file.name}...` })) // will be replaced when the onUpload function finishes
      .catch(e => {
        setStatus({ message: "Upload failed: " + e.message, isError: true });
        analyticsContext.logError("Upload failed", e);
      });
  }, [analyticsContext, firebaseContext, setStatus, userContext]);

  // Image view
  // The bootstrap carousel appears to be entirely busted under these circumstances (images are always 0 high)
  // so I'm going to create a poor man's one by myself

  const [images, setImages] = useState<IImage[]>([]);
  useEffect(() => {
    if (!userContext.dataService || !userContext.user) {
      return undefined;
    }

    const imagesRef = userContext.dataService.getImagesRef(userContext.user.uid);
    console.log("watching images");
    return userContext.dataService.watch(
      imagesRef,
      r => {
        setImages(r?.images ?? []);
        if (r !== undefined) {
          setStatus({ message: r.lastError, isError: r.lastError.length > 0 });
        }
      },
      e => analyticsContext.logError("Error watching images", e)
    );
  }, [analyticsContext, setImages, setStatus, userContext]);

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

  const shownItem = useMemo(() => {
    if (list.length === 0) {
      return <div></div>;
    } else {
      const shownIndex = Math.max(0, Math.min(list.length - 1, index));
      return list[shownIndex];
    }
  }, [index, list]);

  // Buttons and save handling

  const activeImagePath = useMemo(() => {
    if (images.length === 0) {
      return undefined;
    } else {
      const shownIndex = Math.max(0, Math.min(images.length - 1, index));
      return images[shownIndex].path;
    }
  }, [images, index]);

  const saveDisabled = useMemo(() => activeImagePath === undefined, [activeImagePath]);
  const handleSave = useCallback(() => {
    if (activeImagePath === undefined) {
      return;
    }

    props.handleSave(activeImagePath);
  }, [activeImagePath, props]);

  const handleUseNone = useCallback(() => { props.handleSave(undefined); }, [props]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header>
        <Modal.Title>Choose image</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="uploadButton">Upload a new image</Form.Label>
            <Form.Control id="uploadButton" as="input" type="file" accept="image/*" onChange={handleFileChange} />
          </Form.Group>
        </Form>
        <ImageStatus {...status} />
        <div className="App-image-collection">
          <Button variant="primary" disabled={goBackDisabled} onClick={goBack}>
            <FontAwesomeIcon icon={faChevronLeft} color="white" />
          </Button>
          {shownItem}
          <Button variant="primary" disabled={goForwardDisabled} onClick={goForward}>
            <FontAwesomeIcon icon={faChevronRight} color="white" />
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="warning" onClick={handleUseNone}>Use no image</Button>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={saveDisabled} onClick={handleSave}>Use this image</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ImagePickerModal;