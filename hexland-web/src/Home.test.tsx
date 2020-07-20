import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders home and login', () => {
  const { getByText } = render(<App />);
  const homeElement = getByText(/home/i);
  expect(homeElement).toBeInTheDocument();
  const loginElement = getByText(/login/i);
  expect(loginElement).toBeInTheDocument();
});
