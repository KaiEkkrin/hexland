import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';

import { fromSpriteGeometryString, getSpritePathFromId, ISprite, ISpritesheet } from '../data/sprite';
import { ISpritesheetCache } from '../services/interfaces';

import { from } from 'rxjs';

// A pretty display of the image in a sprite for use in choosers etc.

interface ISpriteImageProps {
  sprite: ISprite;
  spritesheetCache: ISpritesheetCache | undefined;
  altName: string;
  size?: number | undefined;
  borderColour?: string | undefined;
}

// TODO #149 Fix the hardwiring of spritesheet dimensions here (when I need different ones...)
const sheetSize = 1024;

function SpriteImage({ sprite, spritesheetCache, altName, size, borderColour }: ISpriteImageProps) {
  const { logError } = useContext(AnalyticsContext);
  const { storageService } = useContext(UserContext);

  // Get hold of the spritesheet and its URL
  const [sheet, setSheet] = useState<{ data: ISpritesheet, url: string } | undefined>(undefined);
  useEffect(() => {
    async function fetchDownloadURL() {
      if (spritesheetCache === undefined || storageService === undefined) {
        return undefined;
      }

      const { value, release } = await spritesheetCache.resolve(sprite);
      try {
        if (value === undefined) {
          return undefined;
        }

        const url = await storageService.ref(getSpritePathFromId(value.id)).getDownloadURL();
        return { data: value.data, url: url };
      } finally {
        await release();
      }
    }

    const sub = from(fetchDownloadURL()).subscribe(
      setSheet,
      e => logError("Failed to get download URL for sprite " + sprite.source, e)
    );
    return () => sub.unsubscribe();
  }, [logError, setSheet, sprite, spritesheetCache, storageService]);

  const style: React.CSSProperties | undefined = useMemo(() => {
    if (sheet === undefined) {
      return undefined;
    }

    const position = sheet.data.sprites.indexOf(sprite.source);
    if (position < 0) {
      return undefined;
    }

    const geometry = fromSpriteGeometryString(sheet.data.geometry);
    const x = position % geometry.columns;
    const y = Math.floor(position / geometry.columns);
    const spriteSize = sheetSize / geometry.columns; // `rows` won't be different
    const backgroundSize = size ? (sheetSize * size / spriteSize) : sheetSize;
    return {
      width: `${size ?? spriteSize}px`,
      height: `${size ?? spriteSize}px`,
      backgroundImage: `url(${sheet.url})`,
      backgroundPosition: `${-x * (size ?? spriteSize)}px ${-y * (size ?? spriteSize)}px`,
      backgroundSize: `${backgroundSize}px ${backgroundSize}px`,
      border: '4px solid',
      borderColor: borderColour,
      borderRadius: '50%'
    };
  }, [sheet, sprite, size, borderColour]);

  return (
    <img style={style} src="/tiny.png" alt={altName} />
  );
}

export default SpriteImage;