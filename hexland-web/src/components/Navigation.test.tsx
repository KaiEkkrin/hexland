import React from 'react';

import { ProfileContextProvider } from '../App';
import { SimulatedFirebaseContextProvider } from '../Home.test';
import Navigation from './Navigation';

import { StaticRouter } from 'react-router-dom';

import { render } from '@testing-library/react';

test('title, user display name and links appear', () => {
  const { getByText } = render(
    <SimulatedFirebaseContextProvider>
      <ProfileContextProvider>
        <StaticRouter location="/">
          <Navigation title="test title" />
        </StaticRouter>
      </ProfileContextProvider>
    </SimulatedFirebaseContextProvider>
  );

  const brandElement = getByText(/hexland/i);
  expect(brandElement).toBeInTheDocument();

  const homeElement = getByText(/home/i);
  expect(homeElement).toBeInTheDocument();

  const allElement = getByText(/my adventures/i);
  expect(allElement).toBeInTheDocument();

  const sharedElement = getByText(/shared with me/i);
  expect(sharedElement).toBeInTheDocument();

  const titleElement = getByText(/test title/);
  expect(titleElement).toBeInTheDocument();

  const userElement = getByText(/Owner/);
  expect(userElement).toBeInTheDocument();
});