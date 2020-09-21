import { IAuth, IAuthProvider, IUser } from "./interfaces";

import * as firebase from 'firebase/app';

// Wraps the real Firebase auth service and the providers we recognise
// into our IAuth abstraction.

export class FirebaseAuth implements IAuth {
  private readonly _auth: firebase.auth.Auth;

  constructor(auth: firebase.auth.Auth) {
    this._auth = auth;
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    let credential = await this._auth.createUserWithEmailAndPassword(email, password);
    return credential.user;
  }

  sendPasswordResetEmail(email: string) {
    return this._auth.sendPasswordResetEmail(email);
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    let credential = await this._auth.signInWithEmailAndPassword(email, password);
    return credential.user;
  }

  async signInWithPopup(provider: IAuthProvider | undefined) {
    if (provider instanceof PopupAuthProviderWrapper) {
      let credential = await provider.signInWithPopup(this._auth);
      return credential.user;
    }

    throw Error("Incompatible auth provider");
  }

  signOut() {
    return this._auth.signOut();
  }

  onAuthStateChanged(onNext: (user: IUser | null) => void, onError?: ((e: Error) => void) | undefined) {
    return this._auth.onAuthStateChanged(onNext, e => onError?.(new Error(e.message)));
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

export const googleAuthProviderWrapper = new PopupAuthProviderWrapper(new firebase.auth.GoogleAuthProvider());