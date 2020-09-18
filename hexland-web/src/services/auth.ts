import { IAuth, IAuthProvider, IUser } from "./interfaces";

import * as firebase from 'firebase/app';

// Wraps the real Firebase auth service and the providers we recognise
// into our IAuth abstraction.

export class FirebaseAuth implements IAuth {
  private readonly _auth: firebase.auth.Auth;

  constructor(auth: firebase.auth.Auth) {
    this._auth = auth;
  }

  async signInWithPopup(provider: IAuthProvider | undefined) {
    if (provider instanceof FirebaseAuthProviderWrapper) {
      let credential = await provider.signInWithPopup(this._auth);
      return credential.user;
    }

    throw Error("Incompatible auth provider");
  }

  signOut() {
    return this._auth.signOut();
  }

  onAuthStateChanged(onNext: (user: IUser | null) => void, onError?: ((e: Error) => void) | undefined) {
    return this._auth.onAuthStateChanged(u => {
      onNext(u === null ? null : {
        displayName: u.displayName,
        email: u.email,
        providerId: u.providerId,
        uid: u.uid
      });
    }, e => onError?.(new Error(e.message)));
  }
}

abstract class FirebaseAuthProviderWrapper implements IAuthProvider {
  abstract signInWithPopup(auth: firebase.auth.Auth): Promise<firebase.auth.UserCredential>;
}

export class GoogleAuthProviderWrapper extends FirebaseAuthProviderWrapper {
  private readonly _provider: firebase.auth.GoogleAuthProvider;

  constructor() {
    super();
    this._provider = new firebase.auth.GoogleAuthProvider();
  }

  signInWithPopup(auth: firebase.auth.Auth) {
    const credential = auth.signInWithPopup(this._provider);
    return credential;
  }
}