import { IStatusContext, IToast } from './interfaces';

import { v4 as uuidv4 } from 'uuid';

// This helper function adds a toast and returns the function that will
// remove it.
export function addToast(context: IStatusContext, toast: IToast) {
  let id = uuidv4();
  context.toasts.next({ id: id, record: toast });
  return () => {
    context.toasts.next({ id: id, record: undefined });
  }
}