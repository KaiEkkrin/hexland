export interface IWebDAV {
  getFileDownloadLink(path: string): string;
  putFileContents(path: string, file: File): Promise<void>;
}

export function createWebDAV(location: string): IWebDAV;