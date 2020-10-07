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

interface IImageCollectionProps {
  images: IImage[];
}

function ImageCollection(props: IImageCollectionProps) {
  // The carousel appears to be entirely busted under these circumstances (images are always 0 high)
  // so I'm going to create a poor man's one by myself
  const [index, setIndex] = useReducer(
    (state: number, action: number) => action === 0 ? 0 : state + action,
    0
  );

  const goBackDisabled = useMemo(() => index <= 0, [index]);
  const goForwardDisabled = useMemo(() => index >= (props.images.length - 1), [index, props.images]);
  const goBack = useCallback(() => setIndex(-1), [setIndex]);
  const goForward = useCallback(() => setIndex(1), [setIndex]);

  // When the list changes, we also reset the index to 0 so that the new item is visible right away
  const [list, setList] = useState<React.ReactNode[]>([]);
  useEffect(() => {
    setList(props.images.map(i => (
      <ImageCollectionItem key={i.path} image={i} />
    )));
    setIndex(0);
  }, [props.images, setIndex, setList]);

  const shownItem = useMemo(() => {
    // Correct that index just in case
    const shownIndex = Math.max(0, Math.min(list.length - 1, index));
    return list[shownIndex];
  }, [index, list]);

  return (
    <div className="App-image-collection">
      <Button variant="primary" disabled={goBackDisabled} onClick={goBack}>
        <FontAwesomeIcon icon={faChevronLeft} color="white" />
      </Button>
      {shownItem}
      <Button variant="primary" disabled={goForwardDisabled} onClick={goForward}>
        <FontAwesomeIcon icon={faChevronRight} color="white" />
      </Button>
    </div>
  );
}

interface IImagePickerModalProps {
  show: boolean;
  handleClose: () => void;
}

function ImagePickerModal(props: IImagePickerModalProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);
  const saveDisabled = useMemo(() => true, []);

  // Watch the user's images.
  // TODO #149 Solve the possible problem of lots of reads when the user has lots of these
  const [images, setImages] = useState<IImage[]>([]);
  useEffect(() => {
    if (!userContext.dataService || !userContext.user) {
      return undefined;
    }

    return userContext.dataService.watchImages(
      userContext.user.uid,
      setImages,
      e => analyticsContext.logError("Error watching images", e)
    );
  }, [analyticsContext, setImages, userContext]);

  // Only display the images element if there's at least one image
  const imagesElement = useMemo(
    () => images.length > 0 ? (<ImageCollection images={images} />) : undefined,
    [images]
  );

  const [status, setStatus] = useState("");
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

    setStatus("Uploading " + file.name + "...");
    firebaseContext.storage.ref(path).put(file, {
      customMetadata: {
        originalName: file.name
      }
    }).then(() => setStatus(file.name + " uploaded successfully"))
      .catch(e => {
        setStatus("Upload failed: " + e.message);
        analyticsContext.logError("Upload failed", e);
      });
  }, [analyticsContext, firebaseContext, setStatus, userContext]);

  const handleSave = useCallback(() => {}, []);

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
        <p>{status}</p>
        {imagesElement}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={saveDisabled} onClick={handleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ImagePickerModal;