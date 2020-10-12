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