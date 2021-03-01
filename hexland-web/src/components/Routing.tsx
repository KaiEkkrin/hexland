import { IContextProviderProps, IRoutingProps } from './interfaces';
import { BrowserRouter } from 'react-router-dom';
import * as React from 'react';

// A simple wrapper to the router component to enable it to be mocked.

function Routing(props: IContextProviderProps & IRoutingProps) {
  return (
    <BrowserRouter>
      {props.children}
    </BrowserRouter>
  );
}

export default Routing;