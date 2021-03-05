import { useMemo, useState } from 'react';

import './Throbber.css';

import Measure from 'react-measure';

// A quickie throbber thingy.

function Throbber() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const shownSize = useMemo(() => Math.min(size.width, size.height), [size]);

  return (
    <Measure bounds onResize={r => setSize({ width: r.bounds?.width ?? 0, height: r.bounds?.height ?? 0 })}>
      {({ measureRef }) => (
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
      )}
    </Measure>
  );
}

export default Throbber;