import { useContext, useEffect } from 'react';
import * as React from 'react';
import { UserContext } from './UserContext';
import { useNavigate } from 'react-router-dom';

// This is a simple helper component that requires you to be logged in
// and bounces you to the login page if you're not.
interface IRequireLoggedInProps {
  children: React.ReactNode;
}

export function RequireLoggedIn(props: IRequireLoggedInProps) {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      console.debug("Not logged in.  Redirecting to login page");
      // Use replace: true to avoid creating a history entry, so the back button
      // from the login page goes to the previous page instead of looping back to login
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  return <React.Fragment>{props.children}</React.Fragment>;
}