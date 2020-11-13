import React from 'react';
import Spinner from 'react-bootstrap/Spinner';

interface IBusyElementProps {
  normal: React.ReactNode;
  busy: React.ReactNode;
  isBusy: boolean;
}

// A quickie doodah that helps me change a button to different text
// with a spinner when something is busy.
function BusyElement({ normal, busy, isBusy }: IBusyElementProps) {
  return isBusy === true ? (
    <React.Fragment>
      {busy}&nbsp;
      <Spinner as="span" animation="border" variant="light" role="status" size="sm" aria-hidden="true" />
    </React.Fragment>
  ) : (<React.Fragment>{normal}</React.Fragment>);
}

export default BusyElement;