import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';

import { fromSpriteGeometryString, getSpritePath, ISprite } from '../data/sprite';

import { from } from 'rxjs';

// A pretty display of the image in a sprite for use in choosers etc.

interface ISpriteImageProps {
  sprite: ISprite;
  altName: string;
  size?: number | undefined;
  borderColour?: string | undefined;
}

// TODO #149 Fix the hardwiring of spritesheet dimensions here (when I need different ones...)
const sheetSize = 1024;

function SpriteImage({ sprite, altName, size, borderColour }: ISpriteImageProps) {
  const { logError } = useContext(AnalyticsContext);
  const { storageService } = useContext(UserContext);

  // Get hold of the spritesheet URL
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!storageService) {
      setUrl(undefined);
      return;
    }

    const spritePath = getSpritePath(sprite);
    const sub = from(storageService.ref(spritePath).getDownloadURL()).subscribe(
      u => setUrl(String(u)),
      e => logError("Failed to get download URL for sprite " + sprite.id, e)
    );
    return () => sub.unsubscribe();
  }, [logError, setUrl, sprite, storageService]);

  const style: React.CSSProperties = useMemo(() => {
    const geometry = fromSpriteGeometryString(sprite.geometry);
    const x = sprite.position % geometry.columns;
    const y = Math.floor(sprite.position / geometry.columns);
    const spriteSize = sheetSize / geometry.columns; // `rows` won't be different
    const backgroundSize = size ? (sheetSize * size / spriteSize) : sheetSize;
    return {
      width: `${size ?? spriteSize}px`,
      height: `${size ?? spriteSize}px`,
      backgroundImage: `url(${url})`,
      backgroundPosition: `${-x * (size ?? spriteSize)}px ${-y * (size ?? spriteSize)}px`,
      backgroundSize: `${backgroundSize}px ${backgroundSize}px`,
      border: '4px solid',
      borderColor: borderColour,
      borderRadius: '50%'
    };
  }, [sprite, url, size, borderColour]);

  return (
    <img style={style} src="/tiny.png" alt={altName} />
  );
}

export default SpriteImage;