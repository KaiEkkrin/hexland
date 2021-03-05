import { IFunctionsService, IStorageReference } from "./interfaces";
import { MockStorage } from "./mockStorage";
import { MockWebStorageReference } from "./mockWebStorageReference";

// A mock storage service for the use of the local `run_docker.sh` deployment.
// This one communicates with the Firebase Functions to mock the
// use of function triggers on the real Cloud Firestore, but uses the node WebDAV --
// use in unit testing.

export class MockWebStorage extends MockStorage {
  private readonly _functionsService: IFunctionsService;

  constructor(functionsService: IFunctionsService, location: string) {
    super(location);
    this._functionsService = functionsService;
  }

  ref(path: string): IStorageReference {
    return new MockWebStorageReference(this._functionsService, this.webdav, path);
  }
}