import { IImage, IImages } from '../data/image';
import { getUserPolicy } from '../data/policy';
import { IProfile } from '../data/profile';
import { IDataReference, IDataService, IDataView, ILogger } from './interfaces';

async function addImageTransaction(
  view: IDataView,
  name: string,
  path: string,
  imagesRef: IDataReference<IImages>,
  profileRef: IDataReference<IProfile>
): Promise<boolean> {
  // Fetch the current images record
  const images = await view.get(imagesRef);
  const imageCount = images?.images.length ?? 0;

  async function completeWithError(error: string) {
    if (images !== undefined) {
      await view.update(imagesRef, { lastError: error });
    } else {
      const newImages: IImages = {
        images: [],
        lastError: error
      };
      await view.set(imagesRef, newImages);
    }

    return false;
  }

  // Fetch the user's profile, to check whether they can add any more images
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    return await completeWithError("No profile found");
  }

  const userPolicy = getUserPolicy(profile.level);
  if (imageCount >= userPolicy.images) {
    return await completeWithError("You have too many images; delete one to upload another.");
  }

  // Add the new image to the front of the list
  const newImage: IImage = { name: name, path: path };
  if (images !== undefined) {
    await view.update(imagesRef, { images: [newImage, ...images.images] });
  } else {
    const newImages: IImages = {
      images: [newImage],
      lastError: ""
    };
    await view.set(imagesRef, newImages);
  }

  return true;
}

// Adds an image.
// If we return false, the add wasn't successful -- delete the uploaded image.
export async function addImage(
  dataService: IDataService,
  logger: ILogger,
  name: string,
  path: string,
): Promise<boolean> {
  // Extract the uid from the path.  We rely on the Storage security rules to have
  // enforced that uid
  const result = /^images\/([^\/]+)\/([^\/]+)/.exec(path);
  if (!result) {
    logger.logWarning("Found image with unrecognised path: " + path);
    return false;
  }

  const uid = result[1];
  const imagesRef = dataService.getImagesRef(uid);
  const profileRef = dataService.getProfileRef(uid);
  return await dataService.runTransaction(tr => addImageTransaction(tr, name, path, imagesRef, profileRef));
}