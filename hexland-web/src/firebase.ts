import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// TODO DO NOT DO THIS
// I should be able to get a proper, smart setup that keeps the config out
// of github (this is only the test application here anyway...)
// See e.g. https://firebase.googleblog.com/2017/04/easier-configuration-for-firebase-on-web.html
// Temporarily, though, I feel it's okay to submit the hexland-test API key
// to a private github repo

const firebaseConfig = {
  apiKey: "AIzaSyA7CCAedeMXXz2QvF-rll1b0Jlx8dhOyq4",
  authDomain: "hexland-test.firebaseapp.com",
  databaseURL: "https://hexland-test.firebaseio.com",
  projectId: "hexland-test",
  storageBucket: "hexland-test.appspot.com",
  messagingSenderId: "1072727000053",
  appId: "1:1072727000053:web:c044f7cd3e8521f79596bc"
};

firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleAuthProvider = new firebase.auth.GoogleAuthProvider();
export default firebase;