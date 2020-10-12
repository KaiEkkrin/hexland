import { IAuth, IAuthProvider, IUser } from "./interfaces";

import * as firebase from 'firebase/app';

import md5 from 'crypto-js/md5';

function createUser(user: firebase.User | null) {
  return user === null ? null : new User(user);
}

// Wraps the real Firebase auth service and the providers we recognise
// into our IAuth abstraction.

export class FirebaseAuth implements IAuth {
  private readonly _auth: firebase.auth.Auth;

  constructor(auth: firebase.auth.Auth) {
    this._auth = auth;
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    const credential = await this._auth.createUserWithEmailAndPassword(email, password);
    return createUser(credential.user);
  }

  fetchSignInMethodsForEmail(email: string) {
    return this._auth.fetchSignInMethodsForEmail(email);
  }

  sendPasswordResetEmail(email: string) {
    return this._auth.sendPasswordResetEmail(email);
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    let credential = await this._auth.signInWithEmailAndPassword(email, password);
    return createUser(credential.user);
  }

  async signInWithPopup(provider: IAuthProvider | undefined) {
    if (provider instanceof PopupAuthProviderWrapper) {
      let credential = await provider.signInWithPopup(this._auth);
      return createUser(credential.user);
    }

    throw Error("Incompatible auth provider");
  }

  signOut() {
    return this._auth.signOut();
  }

  onAuthStateChanged(onNext: (user: IUser | null) => void, onError?: ((e: Error) => void) | undefined) {
    return this._auth.onAuthStateChanged(
      u => onNext(createUser(u)),
      e => onError?.(new Error(e.message))
    );
  }
}

class PopupAuthProviderWrapper implements IAuthProvider {
  private readonly _provider: firebase.auth.AuthProvider;

  constructor(provider: firebase.auth.AuthProvider) {
    this._provider = provider;
  }

  signInWithPopup(auth: firebase.auth.Auth) {
    const credential = auth.signInWithPopup(this._provider);
    return credential;
  }
}

export class User implements IUser {
  private readonly _user: firebase.User;
  private readonly _userExtra: { emailMd5: string | null };

  constructor(user: firebase.User) {
    this._user = user;
    const emailMd5 = (this._user.email === null) ? null : md5(this._user.email).toString();
    this._userExtra = {
      emailMd5: emailMd5
    };
  }

  get displayName() { return this._user.displayName; }
  get email() { return this._user.email; }
  get emailMd5() { return this._userExtra.emailMd5; }
  get emailVerified() { return this._user.emailVerified; }
  get providerId() { return this._user.providerId; }
  get uid() { return this._user.uid; }

  async changePassword(oldPassword: string, newPassword: string) {
    if (this._user.email === null) {
      return;
    }

    // We always re-authenticate first to make sure we're not stale
    const updated = await this._user.reauthenticateWithCredential(
      firebase.auth.EmailAuthProvider.credential(this._user.email, oldPassword)
    );

    if (updated.user === null) {
      throw Error("Unable to reauthenticate (wrong password?)");
    }

    await updated.user?.updatePassword(newPassword);
  }

  sendEmailVerification() {
    return this._user.sendEmailVerification();
  }

  updateProfile(p: any) {
    return this._user.updateProfile(p);
  }
}

export const googleAuthProviderWrapper = new PopupAuthProviderWrapper(new firebase.auth.GoogleAuthProvider());