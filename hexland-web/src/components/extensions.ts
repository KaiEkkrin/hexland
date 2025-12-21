import { IStatusContext, IToast } from './interfaces';

import { v7 as uuidv7 } from 'uuid';

// This helper function adds a toast and returns the function that will
// remove it.
export function addToast(context: IStatusContext, toast: IToast) {
  const id = uuidv7();
  context.toasts.next({ id: id, record: toast });
  return () => {
    context.toasts.next({ id: id, record: undefined });
  }
}