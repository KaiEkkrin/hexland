// This is an invitation to join an adventure.

export interface IInvite {
  adventureName: string;
  owner: string; // the owner of the adventure
  ownerName: string;
  timestamp: firebase.firestore.FieldValue; // initialise this to `serverTimestamp`.
                                            // TODO make invites expire?
}