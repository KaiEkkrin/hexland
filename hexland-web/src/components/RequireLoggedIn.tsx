import React, { useContext, useEffect } from 'react';
import { UserContext } from './UserContextProvider';
import { useHistory } from 'react-router-dom';

// This is a simple helper component that requires you to be logged in
// and bounces you to the login page if you're not.
interface IRequireLoggedInProps {
  children: React.ReactNode;
}

export function RequireLoggedIn(props: IRequireLoggedInProps) {
  const { user } = useContext(UserContext);
  const history = useHistory();

  useEffect(() => {
    if (user === null) {
      console.log("Not logged in.  Redirecting to login page");
      history.push("/login");
    }
  }, [user, history]);

  return <React.Fragment>{props.children}</React.Fragment>;
}