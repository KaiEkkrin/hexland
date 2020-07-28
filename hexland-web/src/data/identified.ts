// Trivially describes a record with an identifier.
export interface IIdentified<T> {
  id: string;
  record: T;
}