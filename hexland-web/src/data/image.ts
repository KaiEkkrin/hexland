import { Timestamp } from "./types";

// Describes the images that a user has uploaded.

export interface IImage {
  // The user's name for the image.
  name: string;

  // The date of upload.
  date?: Timestamp | undefined;

  // The uid of this image's owner.
  owner: string;

  // The path in Cloud Storage where the image can be found.
  path: string;
}