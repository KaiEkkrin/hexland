import React, { useContext, useState, useEffect } from 'react';
import '../App.css';
import { StatusContext } from './StatusContextProvider';
import { IToast } from './interfaces';
import { IIdentified } from '../data/identified';

import Toast from 'react-bootstrap/Toast';

// Reports the toasts in the status context.

interface IToastElementProps {
  toast: IToast;
  remove: () => void;
}

function ToastElement(props: IToastElementProps) {
  return (
    <Toast onClose={props.remove}>
      <Toast.Header>
        <strong className="mr-auto">{props.toast.title}</strong>
      </Toast.Header>
      <Toast.Body>
        {props.toast.message}
      </Toast.Body>
    </Toast>
  );
}

function ToastCollection() {
  const statusContext = useContext(StatusContext);
  const [toasts, setToasts] = useState([] as IIdentified<IToast>[]);

  useEffect(() => {
    const sub = statusContext?.toasts.subscribe(t => {
      if (t.record === undefined) {
        setToasts(ts => ts.filter(t2 => t2.id !== t.id));
      } else {
        var newToast = { id: t.id, record: t.record };
        setToasts(ts => [newToast, ...ts]);
      }
    });
    return () => { sub?.unsubscribe(); };
  }, [statusContext]);

  return (
    <div className="App-toast-container">
      {toasts.map(t => (
        <ToastElement key={t.id} toast={t.record} remove={() => setToasts(toasts.filter(t2 => t2.id !== t.id))} />
      ))
      }
    </div>
  );
}

export default ToastCollection;