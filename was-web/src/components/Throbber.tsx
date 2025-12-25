import { useMemo } from 'react';

import './Throbber.css';

import useMeasure from 'react-use-measure';

// A quickie throbber thingy.

function Throbber() {
  const [measureRef, bounds] = useMeasure();
  const shownSize = useMemo(() => Math.min(bounds.width, bounds.height), [bounds.width, bounds.height]);

  return (
    <div className="Throbber-container" ref={measureRef}>
      <div>&nbsp;</div>
      <div className="Throbber-contents" style={{
        width: shownSize,
        height: shownSize
      }}>
        <div className="Throbber-box Throbber-box-0">&nbsp;</div>
        <div className="Throbber-box Throbber-box-1">&nbsp;</div>
        <div className="Throbber-box Throbber-box-2">&nbsp;</div>
        <div className="Throbber-box Throbber-box-3">&nbsp;</div>
      </div>
      <div className="Throbber-title">Loading...</div>
    </div>
  );
}

export default Throbber;