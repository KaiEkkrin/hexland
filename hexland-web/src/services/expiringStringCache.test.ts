import { ExpiringStringCache } from './expiringStringCache';

// TODO #194 Gracefully handle errors from the fetch function?
test('Entries are cached successfully', async () => {
  // We map string -> 'fetched_{string}'
  const fetch = jest.fn<Promise<string>, [string]>(id => new Promise((resolve) => resolve(`fetched_${id}`)));

  // We won't expire anything until this subject trips
  const cache = new ExpiringStringCache(10);

  // These should cause fetches
  let oneEntry = await cache.resolve('one', fetch);
  expect(oneEntry).toBe('fetched_one');
  expect(fetch).toHaveBeenLastCalledWith('one');
  expect(fetch).toHaveBeenCalledTimes(1);

  let twoEntry = await cache.resolve('two', fetch);
  expect(twoEntry).toBe('fetched_two');
  expect(fetch).toHaveBeenLastCalledWith('two');
  expect(fetch).toHaveBeenCalledTimes(2);

  // These should not
  oneEntry = await cache.resolve('one', fetch);
  expect(oneEntry).toBe('fetched_one');
  expect(fetch).toHaveBeenCalledTimes(2);

  twoEntry = await cache.resolve('two', fetch);
  expect(twoEntry).toBe('fetched_two');
  expect(fetch).toHaveBeenCalledTimes(2);

  // But after expiry, re-fetches should happen
  await new Promise((resolve) => setTimeout(resolve, 100));
  oneEntry = await cache.resolve('one', fetch);
  expect(oneEntry).toBe('fetched_one');
  expect(fetch).toHaveBeenLastCalledWith('one');
  expect(fetch).toHaveBeenCalledTimes(3);

  twoEntry = await cache.resolve('two', fetch);
  expect(twoEntry).toBe('fetched_two');
  expect(fetch).toHaveBeenLastCalledWith('two');
  expect(fetch).toHaveBeenCalledTimes(4);
});