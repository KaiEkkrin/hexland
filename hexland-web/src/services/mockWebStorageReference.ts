import { IFunctionsService, IWebDAV } from "./interfaces";
import { MockStorageReference } from "./mockStorageReference";

export class MockWebStorageReference extends MockStorageReference {
  private readonly _functionsService: IFunctionsService;

  constructor(functionsService: IFunctionsService, webdav: IWebDAV, path: string) {
    super(webdav, path);
    this._functionsService = functionsService;
  }

  async put(file: any, metadata: any): Promise<void> {
    await super.put(file, metadata);

    // This call replaces the onFinalize trigger that is active in the real deployment.
    console.debug("making functions aware of " + this.path);
    await this._functionsService.handleMockStorageUpload(this.path, metadata?.customMetadata?.originalName);
  }
}