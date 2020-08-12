import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Firebase auto-configuration
// See https://firebase.google.com/docs/hosting/reserved-urls?authuser=0
fetch('/__/firebase/init.json').then(async response => {
  //firebase.initializeApp(await response.json());
  console.log("Fetched auto-configuration");
});

// TODO DO NOT DO THIS
// I should be able to get a proper, smart setup that keeps the config out
// of github (this is only the test application here anyway...)
// See e.g. https://firebase.googleblog.com/2017/04/easier-configuration-for-firebase-on-web.html
// Temporarily, though, I feel it's okay to submit the hexland-test API key
// to a private github repo

const testConfig = {
  apiKey: "AIzaSyA7CCAedeMXXz2QvF-rll1b0Jlx8dhOyq4",
  authDomain: "hexland-test.firebaseapp.com",
  databaseURL: "https://hexland-test.firebaseio.com",
  projectId: "hexland-test",
  storageBucket: "hexland-test.appspot.com",
  messagingSenderId: "1072727000053",
  appId: "1:1072727000053:web:c044f7cd3e8521f79596bc"
};

const productionConfig = {
  apiKey: "AIzaSyBZPbUPliKp12bgN6ZbDj5qmqd3xzhfIjU",
  authDomain: "hexland.firebaseapp.com",
  databaseURL: "https://hexland.firebaseio.com",
  projectId: "hexland",
  storageBucket: "hexland.appspot.com",
  messagingSenderId: "1098951821514",
  appId: "1:1098951821514:web:b7d1172a66ee03018e0c33"
};

firebase.initializeApp(window.location.hostname === 'hexland.web.app' || window.location.hostname === 'hexland.firebaseapp.com' ? productionConfig : testConfig);
export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleAuthProvider = new firebase.auth.GoogleAuthProvider();
export const timestampProvider = firebase.firestore.FieldValue.serverTimestamp;
export default firebase;