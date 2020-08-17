import React from 'react';
import { IContextProviderProps, IRoutingProps } from "../interfaces";
import { MemoryRouter } from "react-router-dom";

// We'll use the memory router as a mock routing arrangement here:
function Routing(props: IContextProviderProps & IRoutingProps) {
  return (
    <MemoryRouter initialEntries={[props.defaultRoute ?? '/']}>
      {props.children}
    </MemoryRouter>
  );
}

export default Routing;