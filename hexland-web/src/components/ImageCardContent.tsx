import React, { useContext, useEffect, useState, useMemo } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';

import Card from 'react-bootstrap/Card';

// Draws a card, with an image if one is available at the given path.

interface IImageCardProps {
  altName: string | undefined;
  imagePath: string | undefined;
  children?: React.ReactNode | undefined;
}

function ImageCardContent(props: IImageCardProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const [url, setUrl] = useState<string | undefined>(undefined);

  // Resolve the image URL, if any
  useEffect(() => {
    if (!userContext.storageService || !props.imagePath || props.imagePath.length === 0) {
      setUrl(undefined);
      return;
    }

    // TODO #149 I need to be able to cancel this, right now it will cause updates after
    // the component has unmounted
    const imagePath = props.imagePath;
    userContext.storageService.ref(imagePath).getDownloadURL()
      .then(u => {
        console.log(`got download URL for image ${imagePath} : ${u}`);
        setUrl(String(u));
      })
      .catch(e => analyticsContext.logError("Failed to get download URL for image " + imagePath, e));
  }, [analyticsContext, props.imagePath, setUrl, userContext.storageService]);

  const contents = useMemo(
    () => (url) ? (<React.Fragment>
      <Card.Img src={url} alt={props.altName} style={{ maxHeight: '400px', objectFit: 'contain' }} />
      <Card.ImgOverlay style={{ textShadow: '2px 2px #000000' }}>
        {props.children}
      </Card.ImgOverlay>
    </React.Fragment>) : (
      <Card.Body>
        {props.children}
      </Card.Body>
    ),
    [props.altName, props.children, url]
  );

  return (
    <React.Fragment>
      {contents}
    </React.Fragment>
  );
}

export default ImageCardContent;