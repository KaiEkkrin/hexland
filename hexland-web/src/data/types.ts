import firebase from 'firebase/app';
import 'firebase/firestore';

// We use this to define anything that might differ between the Functions and
// the web application.
export type Timestamp = firebase.firestore.FieldValue;
