import * as Convert from './converter';
import { ChangeType, ChangeCategory, ITokenAdd, ITokenMove, ITokenRemove } from '../data/change';
import { defaultGridCoord } from '../data/coord';

// I'm not going to pedantically go through all the possible conversions, but just
// target a few I want to verify:

test('A token operation without id receives the undefined id', () => {
  const rawChanges = {
    chs: [{
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 3, y: 4 },
        colour: 1,
        players: ["user2"],
        text: "TO1",
        note: "Token 1",
      }
    }, {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: 0, y: 4 },
      oldPosition: { x: 3, y: 4 },
    }, {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Token,
      position: { y: 4 } // the x should default to -10000
    }],
    timestamp: 0,
    incremental: true,
    user: "user1"
  };

  const convertedChanges = Convert.changesConverter.convert(rawChanges);

  // I should have retained the basics:
  expect(convertedChanges.user).toBe("user1");
  
  convertedChanges.chs.forEach(ch => expect(ch.cat).toBe(ChangeCategory.Token));

  expect(convertedChanges.chs[0].ty).toBe(ChangeType.Add);
  expect(convertedChanges.chs[1].ty).toBe(ChangeType.Move);
  expect(convertedChanges.chs[2].ty).toBe(ChangeType.Remove);

  // All the changes should now have undefined ids:
  expect((convertedChanges.chs[0] as ITokenAdd).feature.id).toBeUndefined();
  expect((convertedChanges.chs[1] as ITokenMove).tokenId).toBeUndefined();
  expect((convertedChanges.chs[2] as ITokenRemove).tokenId).toBeUndefined();

  // I should have incidentally filled in "noteVisibleToPlayers" as false
  expect((convertedChanges.chs[0] as ITokenAdd).feature.noteVisibleToPlayers).toBe(false);

  // ...and I should have filled in the default x
  expect((convertedChanges.chs[2] as ITokenRemove).position.x).toBe(defaultGridCoord.x);
  expect((convertedChanges.chs[2] as ITokenRemove).position.y).toBe(4);
});

test('A token operation with id has its id retained', () => {
  const rawChanges = {
    chs: [{
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 3, y: 4 },
        colour: 1,
        id: "TID1",
        players: ["user2"],
        text: "TO1",
        note: "Token 1",
      }
    }, {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: 0, y: 4 },
      oldPosition: { x: 3, y: 4 },
      tokenId: "TID2"
    }, {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Token,
      position: { y: 4 },
      tokenId: "TID3"
    }],
    timestamp: 0,
    incremental: true,
    user: "user1"
  };

  const convertedChanges = Convert.changesConverter.convert(rawChanges);

  // I should have retained the basics:
  expect(convertedChanges.user).toBe("user1");
  
  convertedChanges.chs.forEach(ch => expect(ch.cat).toBe(ChangeCategory.Token));

  expect(convertedChanges.chs[0].ty).toBe(ChangeType.Add);
  expect(convertedChanges.chs[1].ty).toBe(ChangeType.Move);
  expect(convertedChanges.chs[2].ty).toBe(ChangeType.Remove);

  // ...and the existing ids...
  expect((convertedChanges.chs[0] as ITokenAdd).feature.id).toBe("TID1");
  expect((convertedChanges.chs[1] as ITokenMove).tokenId).toBe("TID2");
  expect((convertedChanges.chs[2] as ITokenRemove).tokenId).toBe("TID3");

  // I should have incidentally filled in "noteVisibleToPlayers" as false
  expect((convertedChanges.chs[0] as ITokenAdd).feature.noteVisibleToPlayers).toBe(false);

  // ...and I should have filled in the default x
  expect((convertedChanges.chs[2] as ITokenRemove).position.x).toBe(defaultGridCoord.x);
  expect((convertedChanges.chs[2] as ITokenRemove).position.y).toBe(4);
});