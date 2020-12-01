import React, { useMemo } from 'react';

import Button from 'react-bootstrap/Button';

import fluent from 'fluent-iterable';

// This component presents a built-in change list.

interface IVersion {
  version: string;
  changes: string[];
}

const changes: IVersion[] = [
  {
    version: "1.1.0",
    changes: [
      "Support adding background images to maps"
    ]
  },
  {
    version: "1.0.4",
    changes: [
      "Make token text clearer when drawn on top of dark images"
    ]
  },
  {
    version: "1.0.3",
    changes: [
      "Fix newly created maps appearing blacked-out",
      "Embed animated encounter video"
    ]
  },
  {
    version: "1.0.2",
    changes: [
      "Improved LoS algorithm (should reduce glitches)",
      "Various package updates, testability and maintainability improvements"
    ]
  },
  {
    version: "1.0.0",
    changes: [
      "Support images in tokens",
      "Show token image in player list",
      "Support player-defined characters",
      "Make the LoS calculation more stable",
      "Shorten the invite URL (old invites will no longer be valid)"
    ]
  },
  {
    version: "0.11.6",
    changes: [
      "Shrink the version button on narrow screens",
      "Make the map name in the nav bar a self link"
    ]
  },
  {
    version: "0.11.5",
    changes: [
      "Fix database errors when updating the profile"
    ]
  },
  {
    version: "0.11.4",
    changes: [
      "Reduce the number of unnecessary updates"
    ]
  },
  {
    version: "0.11.3",
    changes: [
      "Add zoom in and out buttons (lets you zoom the map when you don't have a scroll wheel)",
      "Fix panning the map adding the wrong amount at non-default zoom"
    ]
  },
  {
    version: "0.11.2",
    changes: [
      "Support a user avatar (contributed by davey3000)"
    ]
  },
  {
    version: "0.11.0-1",
    changes: [
      "Upload images and attach them to map and adventure cards"
    ]
  },
  {
    version: "0.10.6",
    changes: [
      "Fix a source of \"map corrupt\" errors"
    ]
  },
  {
    version: "0.10.5",
    changes: [
      "Fix dead area on the left-hand side of the map page (contributed by davey3000)",
      "Disable user-select and pointer events on UI components while dragging (contributed by davey3000)"
    ]
  },
  {
    version: "0.10.0-4",
    changes: [
      "Support 2-, 3- and 4-size tokens"
    ]
  },
  {
    version: "0.9.0",
    changes: [
      "Added change list",
      "Added map clone function",
    ]
  }, {
    version: "0.8.20",
    changes: [
      "Last version prior to adding the change list"
    ]
  }
];

function ChangeTerm(props: IVersion) {
  return (
    <dt className="col-sm-3" style={{ textAlign: "right" }}>{props.version}</dt>
  );
}

function ChangeDescription(props: IVersion) {
  const items = useMemo(
    () => props.changes.map((ch, i) => (<li key={i}>{ch}</li>)),
    [props.changes]
  );

  return (
    <dd className="col-sm-9">
      <ul>
        {items}
      </ul>
    </dd>
  );
}

interface IChangeListProps {
  count: number | undefined; // the number of changes to show or undefined for all
  toggleCount: () => void;
}

function ChangeList(props: IChangeListProps) {
  const changesToShow = useMemo(
    () => props.count === undefined ? changes: [...fluent(changes).take(props.count)],
    [props.count]
  );

  const renderedChanges = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (const p of changesToShow) {
      items.push((<ChangeTerm key={p.version + "-term"} {...p} />));
      items.push((<ChangeDescription key={p.version + "-description"} {...p} />));
    }
    return items;
  }, [changesToShow]);

  const buttonText = useMemo(
    () => props.count === undefined ? "Hide changes" : "Show all changes",
    [props.count]
  );

  return (
    <div>
      <div className="mt-4" style={{ textAlign: "center" }}>
        <h5>What's new in Wall &amp; Shadow</h5>
      </div>
      <dl className="row">
        {renderedChanges}
      </dl>
      <div style={{ textAlign: "center" }}>
        <Button variant="link" size="sm" onClick={props.toggleCount}>{buttonText}</Button>
      </div>
    </div>
  );
}

export default ChangeList;