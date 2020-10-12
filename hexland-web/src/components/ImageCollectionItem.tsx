import React, { useContext, useEffect, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';

import { IImage } from '../data/image';

import { from } from 'rxjs';

interface IImageCollectionItemProps {
  image: IImage;
}

function ImageCollectionItem(props: IImageCollectionItemProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!userContext.storageService) {
      return;
    }

    const sub = from(userContext.storageService.ref(props.image.path).getDownloadURL()).subscribe(
      u => setUrl(String(u)),
      e => analyticsContext.logError("Failed to get download URL for image " + props.image.path, e)
    );
    return () => sub.unsubscribe();
  }, [analyticsContext, userContext.storageService, props.image, setUrl]);

  return (
    <div className="App-image-collection-item">
      <img className="App-image-collection-image" src={url} alt={props.image.name} />
      <p>{props.image.name}</p>
    </div>
  );
}

export default ImageCollectionItem;