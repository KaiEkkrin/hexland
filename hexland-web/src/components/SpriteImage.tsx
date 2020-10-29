import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AdventureContext } from './AdventureContextProvider';
import { AnalyticsContext } from './AnalyticsContextProvider';

import { ITokenProperties } from '../data/feature';
import { fromSpriteGeometryString, ISprite } from '../data/sprite';
import { ISpritesheetEntry } from '../services/interfaces';

// A pretty display of the image in a sprite for use in choosers etc.

interface ISpriteImageProps {
  sprite?: ISprite | undefined;
  token?: ITokenProperties | undefined;
  altName: string;
  className?: string | undefined;
  size?: number | undefined;
  border?: string | undefined;
  borderColour?: string | undefined;
  onClick?: (() => void) | undefined;
}

// TODO #149 Fix the hardwiring of spritesheet dimensions here (when I need different ones...)
const sheetSize = 1024;

function SpriteImage(
  { sprite, token, altName, className, size, border, borderColour, onClick }: ISpriteImageProps
) {
  const { spriteManager } = useContext(AdventureContext);
  const { logError } = useContext(AnalyticsContext);

  // Resolve the sprite to display
  const [entry, setEntry] = useState<ISpritesheetEntry | undefined>(undefined);
  useEffect(() => {
    setEntry(undefined);
    if (spriteManager === undefined) {
      return undefined;
    }

    if (token !== undefined) {
      const sub = spriteManager.lookupToken(token).subscribe(
        setEntry,
        e => logError(`Failed to lookup token sprite for ${token.id}`, e)
      );
      return () => sub.unsubscribe();
    }

    if (sprite !== undefined) {
      const sub = spriteManager.lookupSprite(sprite).subscribe(
        setEntry,
        e => logError(`Failed to lookup sprite ${sprite.source}`, e)
      );
      return () => sub.unsubscribe();
    }

    return undefined;
  }, [logError, setEntry, sprite, spriteManager, token]);

  const style: React.CSSProperties | undefined = useMemo(() => {
    if (entry === undefined) {
      return undefined;
    }

    const geometry = fromSpriteGeometryString(entry.sheet.geometry);
    const x = entry.position % geometry.columns;
    const y = Math.floor(entry.position / geometry.columns);
    const spriteSize = sheetSize / geometry.columns; // `rows` won't be different
    const backgroundSize = size ? (sheetSize * size / spriteSize) : sheetSize;
    return {
      width: `${size ?? spriteSize}px`,
      height: `${size ?? spriteSize}px`,
      backgroundImage: `url(${entry.url})`,
      backgroundPosition: `${-x * (size ?? spriteSize)}px ${-y * (size ?? spriteSize)}px`,
      backgroundSize: `${backgroundSize}px ${backgroundSize}px`,
      border: `${border ?? "4px solid"}`,
      borderColor: borderColour,
      borderRadius: '50%'
    };
  }, [border, borderColour, entry, size]);

  return (
    <img className={className} style={style} src="/tiny.png" alt={altName} onClick={onClick} />
  );
}

export default SpriteImage;