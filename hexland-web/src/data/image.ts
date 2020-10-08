// Describes the images that a user has uploaded.

export interface IImage {
  // The user's name for the image.
  name: string;

  // The path in Cloud Storage where the image can be found.
  path: string;
}

// We'll have one of these for each user.
export interface IImages {
  images: IImage[];

  // The upload trigger will fill this out if something goes wrong so
  // we can show it to the user.
  lastError: string;
}