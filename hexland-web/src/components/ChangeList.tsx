import { useMemo } from 'react';
import * as React from 'react';

import Button from 'react-bootstrap/Button';

import fluent from 'fluent-iterable';

// This component presents a built-in change list.
import changes from '../changes.json';

type Version = {
  version: string;
  changes: string[];
};

function ChangeTerm(props: Version) {
  return (
    <dt className="col-sm-3" style={{ textAlign: "right" }}>{props.version}</dt>
  );
}

function ChangeDescription(props: Version) {
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