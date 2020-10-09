import { IFunctionsService, IStorageReference, IWebDAV } from "./interfaces";
import { MockStorage, MockStorageReference } from "./mockStorage";

// A mock storage service for the use of the local `run_docker.sh` deployment.
// This is the Web one, and communicates with the Firebase Functions to mock the
// use of function triggers on the real Cloud Firestore.

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

export class MockWebStorageReference extends MockStorageReference {
  private readonly _functionsService: IFunctionsService;

  constructor(functionsService: IFunctionsService, webdav: IWebDAV, path: string) {
    super(webdav, path);
    this._functionsService = functionsService;
  }

  async put(file: File, metadata: any): Promise<void> {
    await super.put(file, metadata);

    // This call replaces the onFinalize trigger that is active in the real deployment.
    console.log("making functions aware of " + this.path);
    await this._functionsService.handleMockStorageUpload(this.path, metadata?.customMetadata?.originalName);
  }
}