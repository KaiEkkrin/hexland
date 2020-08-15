import React, { useContext } from 'react';
import { UserContext } from '../App';
import { useHistory } from 'react-router-dom';

// This is a simple helper component that requires you to be logged in
// and bounces you to the login page if you're not.
interface IRequireLoggedInProps {
  children: React.ReactNode;
}

export function RequireLoggedIn(props: IRequireLoggedInProps) {
  const userContext = useContext(UserContext);
  const history = useHistory();
  if (userContext.user === null) {
    console.log("Not logged in.  Redirecting to login page");
    history.push("/login");
  }

  return <div>{props.children}</div>;
}