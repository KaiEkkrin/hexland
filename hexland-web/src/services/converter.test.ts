import * as Convert from './converter';
import { ChangeType, ChangeCategory, ITokenAdd, ITokenMove, ITokenRemove } from '../data/change';
import { defaultGridCoord } from '../data/coord';

// I'm not going to pedantically go through all the possible conversions, but just
// target a few I want to verify:

test('A token operation without id receives the a fresh id', () => {
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
      position: { x: 0, y: 4 }
    }],
    timestamp: 0,
    incremental: true,
    user: "user1"
  };

  const convertedChanges = Convert.createChangesConverter().convert(rawChanges);

  // I should have retained the basics:
  expect(convertedChanges.user).toBe("user1");
  
  convertedChanges.chs.forEach(ch => expect(ch.cat).toBe(ChangeCategory.Token));

  expect(convertedChanges.chs[0].ty).toBe(ChangeType.Add);
  expect(convertedChanges.chs[1].ty).toBe(ChangeType.Move);
  expect(convertedChanges.chs[2].ty).toBe(ChangeType.Remove);

  // The token changes should now have gained their own rolling id:
  const tokenAdd0 = convertedChanges.chs[0] as ITokenAdd;
  const tokenMove1 = convertedChanges.chs[1] as ITokenMove;
  const tokenRemove2 = convertedChanges.chs[2] as ITokenRemove;
  expect(tokenAdd0.feature.id).not.toBeUndefined();
  expect(tokenMove1.tokenId).not.toBeUndefined();
  expect(tokenRemove2.tokenId).not.toBeUndefined();

  expect(tokenAdd0.feature.id).not.toBe("");
  expect(tokenMove1.tokenId).toBe(tokenAdd0.feature.id);
  expect(tokenRemove2.tokenId).toBe(tokenMove1.tokenId);

  // I should have incidentally filled in "noteVisibleToPlayers" as false
  expect((convertedChanges.chs[0] as ITokenAdd).feature.noteVisibleToPlayers).toBe(false);

  // ...and my remove position should have been correct
  expect((convertedChanges.chs[2] as ITokenRemove).position.x).toBe(0);
  expect((convertedChanges.chs[2] as ITokenRemove).position.y).toBe(4);

  // Oh, and it should have been assigned the default token size
  expect((convertedChanges.chs[0] as ITokenAdd).feature.size).toBe("1");
});

test('A token operation with two id-less tokens receives two fresh ids', () => {
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
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 3, y: 5 },
        colour: 1,
        players: ["user2"],
        text: "TO2",
        note: "Token 2",
      }
    }, {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: 0, y: 4 },
      oldPosition: { x: 3, y: 4 },
    }, {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: 0, y: 5 },
      oldPosition: { x: 3, y: 5 },
    }],
    timestamp: 0,
    incremental: true,
    user: "user1"
  };

  const convertedChanges = Convert.createChangesConverter().convert(rawChanges);

  // I should have retained the basics:
  expect(convertedChanges.user).toBe("user1");
  
  convertedChanges.chs.forEach(ch => expect(ch.cat).toBe(ChangeCategory.Token));

  expect(convertedChanges.chs[0].ty).toBe(ChangeType.Add);
  expect(convertedChanges.chs[1].ty).toBe(ChangeType.Add);
  expect(convertedChanges.chs[2].ty).toBe(ChangeType.Move);
  expect(convertedChanges.chs[3].ty).toBe(ChangeType.Move);

  // The token changes should now have gained their own rolling id:
  const tokenAdd0 = convertedChanges.chs[0] as ITokenAdd;
  const tokenAdd1 = convertedChanges.chs[1] as ITokenAdd;
  const tokenMove2 = convertedChanges.chs[2] as ITokenMove;
  const tokenMove3 = convertedChanges.chs[3] as ITokenMove;
  expect(tokenAdd0.feature.id).not.toBeUndefined();
  expect(tokenAdd1.feature.id).not.toBeUndefined();
  expect(tokenMove2.tokenId).not.toBeUndefined();
  expect(tokenMove3.tokenId).not.toBeUndefined();

  expect(tokenAdd0.feature.id).not.toBe("");
  expect(tokenAdd1.feature.id).not.toBe("");

  // which should be distinct
  expect(tokenAdd1.feature.id).not.toBe(tokenAdd0.feature.id);
  expect(tokenMove2.tokenId).toBe(tokenAdd0.feature.id);
  expect(tokenMove3.tokenId).toBe(tokenAdd1.feature.id);
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

  const convertedChanges = Convert.createChangesConverter().convert(rawChanges);

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

test('The size in a token add is parsed correctly', () => {
  const acceptedSizes = ["1", "2", "2 (left)", "2 (right)", "3", "4 (left)", "4 (right)"];
  for (const size of acceptedSizes) {
    const rawChanges = {
      chs: [{
        ty: ChangeType.Add,
        cat: ChangeCategory.Token,
        feature: {
          position: { x: 3, y: 4 },
          colour: 1,
          players: ["user2"],
          size: size,
          text: "TO1",
          note: "Token 1",
        }
      }]
    };

    const convertedChanges = Convert.createChangesConverter().convert(rawChanges);
    expect((convertedChanges.chs[0] as ITokenAdd).feature.size).toBe(size);
  }

  const invalidSizes = [
    "", "5", "0", " 3", "2 (leftright)", "4 (light)", "4(left)", "3 (right)", "4 (rightleft)",
    "2 (left", "right)"
  ];
  for (const size of invalidSizes) {
    const rawChanges = {
      chs: [{
        ty: ChangeType.Add,
        cat: ChangeCategory.Token,
        feature: {
          position: { x: 3, y: 4 },
          colour: 1,
          players: ["user2"],
          size: size,
          text: "TO1",
          note: "Token 1",
        }
      }]
    };

    const convertedChanges = Convert.createChangesConverter().convert(rawChanges);
    expect((convertedChanges.chs[0] as ITokenAdd).feature.size).toBe("1");
  }
});