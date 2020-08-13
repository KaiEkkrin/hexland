import React, { useState, useEffect } from 'react';
import '../App.css';
import '../Map.css';

import { IPositionedAnnotation } from '../data/annotation';

import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover, { PopoverProps } from 'react-bootstrap/Popover';

import { faMapMarker } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// See https://react-bootstrap.github.io/components/overlays/#tooltips
const UpdatingPopover = React.forwardRef<HTMLElement, IMapPopoverProps>(
  ({ popper, children, left, bottom, ...props }, ref) => {
    useEffect(() => {
      popper.scheduleUpdate();
    }, [popper, left, bottom]);

    // TODO can I style this?  Translucency would be lovely
    return (
      <Popover ref={ref} content {...props}>{children}</Popover>
    );
  }
);

interface IMapAnnotationProps {
  annotation: IPositionedAnnotation;
}

interface IMapPopoverProps extends PopoverProps {
  left: string;
  bottom: string;
}

const defaultPinColour = "#5bc0de";

function MapAnnotation(props: IMapAnnotationProps) {
  // Show tooltips by default, unless you click them off.
  // TODO Have a way of click-hiding, click-showing all?
  const [showTooltip, setShowTooltip] = useState(true);

  function viewToPercent(c: number) {
    return 50.0 * (c + 1);
  }

  const [left, setLeft] = useState("0vw");
  const [bottom, setBottom] = useState("0vh");
  const [pinColour, setPinColour] = useState(defaultPinColour);

  useEffect(() => {
    setLeft(viewToPercent(props.annotation.clientX) + "vw");
    setBottom(viewToPercent(props.annotation.clientY) + "vh");
    setPinColour(props.annotation.visibleToPlayers === true ? defaultPinColour : "orange");
  }, [props.annotation]);

  return (
    <OverlayTrigger placement="top" show={showTooltip} overlay={
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
          zIndex: 1
        }}
      />
    </OverlayTrigger>
  );
}

interface IMapAnnotationsProps {
  annotations: IPositionedAnnotation[];
}

// This component draws annotations floating above the map.
function MapAnnotations(props: IMapAnnotationsProps) {
  return (
    <div>{props.annotations.map(a => <MapAnnotation key={a.id} annotation={a} />)}</div>
  );
}

export default MapAnnotations;