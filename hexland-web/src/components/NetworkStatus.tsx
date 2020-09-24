import React, { useMemo } from 'react';

import MapInfoCard from './MapInfoCard';

import ListGroup from 'react-bootstrap/ListGroup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';

// This is a network status component to go into the map info.
// We replace the map info card in this component so that we can show
// the button in different variants depending on status.
export interface INetworkStatusProps {
  resyncCount: number;
}

function NetworkStatus(props: INetworkStatusProps) {
  const buttonBg = useMemo(() => {
    return props.resyncCount === 0 ? 'success' :
      props.resyncCount < 3 ? 'warning': 'danger';
  }, [props.resyncCount]);

  return (
    <MapInfoCard title="Network Status" bg={buttonBg} buttonContent={(
      <FontAwesomeIcon icon={faNetworkWired} color="white" />
    )}>
      <ListGroup variant="flush">
        <ListGroup.Item className="Map-info-list-item">
          <div className="Map-network-status-item">
            <div>Recent resyncs</div>
            <div className="ml-2">{props.resyncCount}</div>
          </div>
        </ListGroup.Item>
      </ListGroup>
    </MapInfoCard>
  );
}

export default NetworkStatus;