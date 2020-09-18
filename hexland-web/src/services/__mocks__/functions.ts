import { IFunctionsService } from "../interfaces";
import * as firebase from 'firebase/app';

// We mock the FunctionsService to do nothing at all for now.  That is okay in the
// App.test.tsx context, and it saves us from having to work around the
// Functions emulator's need to have a real project id rather than a randomly
// generated one :/
export class FunctionsService implements IFunctionsService {
  constructor(functions: firebase.functions.Functions) {
  }

  // Consolidates changes in the given map.
  async consolidateMapChanges(adventureId: string, mapId: string) {
  }
}