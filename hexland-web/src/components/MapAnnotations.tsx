import React, { useState, useEffect, useMemo } from 'react';
import '../App.css';
import '../Map.css';

import { IPositionedAnnotation } from '../data/annotation';

import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover, { PopoverProps } from 'react-bootstrap/Popover';

import { faMapMarker } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum ShowAnnotationFlags {
  None = 0,
  MapNotes = 1,
  TokenNotes = 2,
  All = 3
}

interface IMapPopoverProps extends PopoverProps {
  left: string;
  bottom: string;
}

// See https://react-bootstrap.github.io/components/overlays/#tooltips
const UpdatingPopover = React.forwardRef<HTMLElement, IMapPopoverProps>(
  ({ popper, children, left, bottom, ...props }, ref) => {
    useEffect(() => {
      popper.scheduleUpdate();
    }, [popper, left, bottom]);

    return (
      <Popover ref={ref} content {...props}>
        {children}
      </Popover>
    );
  }
);

interface IMapAnnotationProps {
  annotation: IPositionedAnnotation;
  showFlags: ShowAnnotationFlags;
  customFlags: boolean;
  setCustomFlags: (custom: boolean) => void;
  isDraggingView: boolean;
}

const defaultPinColour = "#5bc0de";

function MapAnnotation(props: IMapAnnotationProps) {
  // Show tooltips by default, unless you click them off.
  // If this is unset, we'll use what the flags say.
  const [showTooltip, setShowTooltip] = useState<boolean | undefined>(undefined);

  function viewToPercent(c: number) {
    return 50.0 * (c + 1);
  }

  const [left, setLeft] = useState("0vw");
  const [bottom, setBottom] = useState("0vh");
  const [pinColour, setPinColour] = useState(defaultPinColour);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [zIndex, setZIndex] = useState(1);

  var isToken = useMemo(() => props.annotation.id.startsWith("Token"), [props.annotation.id]);

  useEffect(() => {
    setLeft(viewToPercent(props.annotation.clientX) + "vw");
    setBottom(viewToPercent(props.annotation.clientY) + "vh");
    if (isToken) {
      // I think this was generated from a token and I should make it look different
      setPinColour(props.annotation.visibleToPlayers === true ? "green" : "red");
      setPlacement("bottom");
      setZIndex(2);
    } else {
      setPinColour(props.annotation.visibleToPlayers === true ? defaultPinColour : "orange");
      setPlacement("top");
      setZIndex(1);
    }
  }, [props.annotation, isToken]);

  // When the show flags change, force that change over the top of our current
  // tooltip setting.
  useEffect(() => {
    if (props.customFlags === false) {
      setShowTooltip(undefined);
    }
  }, [props.customFlags]);

  // When the user customises the show flag, inform the container that flags are customised:
  useEffect(() => {
    if (showTooltip !== undefined) {
      props.setCustomFlags(true);
    }
  }, [props, showTooltip]);

  var show = useMemo(() => {
    if (props.isDraggingView) {
      // Annotations are always hidden while dragging the view and re-shown afterwards,
      // for performance reasons
      return false;
    } else if (showTooltip !== undefined) {
      return showTooltip;
    } else if (isToken) {
      return (props.showFlags & ShowAnnotationFlags.TokenNotes) !== 0;
    } else {
      return (props.showFlags & ShowAnnotationFlags.MapNotes) !== 0;
    }
  }, [props.isDraggingView, props.showFlags, isToken, showTooltip]);

  return (
    <OverlayTrigger placement={placement} show={show} overlay={
      <UpdatingPopover id={props.annotation.id + "-tooltip"} left={left} bottom={bottom}>
        {props.annotation.text}
      </UpdatingPopover>
    }>
      <FontAwesomeIcon icon={faMapMarker} color={pinColour}
        onClick={() => setShowTooltip(!showTooltip)}
        style={{
          position: 'fixed',
          left: left,
          bottom: bottom,
          zIndex: zIndex,
        }}
      />
    </OverlayTrigger>
  );
}

interface IMapAnnotationsProps {
  annotations: IPositionedAnnotation[];
  showFlags: ShowAnnotationFlags;
  customFlags: boolean;
  setCustomFlags: (custom: boolean) => void;
  isDraggingView: boolean;
}

// This component draws annotations floating above the map.
function MapAnnotations(props: IMapAnnotationsProps) {
  return (
    <div>{props.annotations.map(a => <MapAnnotation
      key={a.id}
      annotation={a}
      showFlags={props.showFlags}
      customFlags={props.customFlags}
      setCustomFlags={props.setCustomFlags}
      isDraggingView={props.isDraggingView}
    />)}</div>
  );
}

export default MapAnnotations;