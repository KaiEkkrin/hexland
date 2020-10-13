// This stuff helps me create a reducer that tracks what keys are down.
export type KeysDown = { [key: string]: boolean };
export interface IKeyAction {
  key: string;
  down: boolean;
}

export function isKeyDown(state: KeysDown, key: string) {
  return key in state && state[key] === true;
}

export function keysDownReducer(state: KeysDown, action: IKeyAction): KeysDown {
  if (isKeyDown(state, action.key) === action.down) {
    // No change.
    return state;
  } else {
    let newState = { ...state };
    if (action.down) {
      newState[action.key] = true;
    } else {
      delete newState[action.key];
    }

    return newState;
  }
}

export function isAMovementKeyDown(state: KeysDown) {
  return isKeyDown(state, 'ArrowLeft') || isKeyDown(state, 'ArrowRight') ||
    isKeyDown(state, 'ArrowUp') || isKeyDown(state, 'ArrowDown') ||
    isKeyDown(state, 'O')
}