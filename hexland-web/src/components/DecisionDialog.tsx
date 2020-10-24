/*
 * Dialog for presenting an "accept"/"cancel" decision
 */
import React from 'react';
import { createStyles, makeStyles, Theme, withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import MuiDialogTitle from '@material-ui/core/DialogTitle';
import MuiDialogContent from '@material-ui/core/DialogContent';
import MuiDialogActions from '@material-ui/core/DialogActions';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme: Theme) => createStyles({
    root: {
      margin: 0,
      padding: theme.spacing(2),
    },
    closeButton: {
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1),
      color: theme.palette.grey[500],
    },
}));

interface IDialogTitleProps {
  children: React.ReactNode;
  onClose: () => void;
}

function DialogTitle(
  { children, onClose, ...other }: IDialogTitleProps
) {
  const classes = useStyles();
  return (
    <MuiDialogTitle disableTypography className={classes.root} {...other}>
      <Typography variant="h6">{children}</Typography>
      {onClose ? (
        <IconButton aria-label="close" className={classes.closeButton} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      ) : null}
    </MuiDialogTitle>
  );
}

const DialogContent = withStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))(MuiDialogContent);

const DialogActions = withStyles((theme: Theme) => ({
  root: {
    margin: 0,
    padding: theme.spacing(1),
  },
}))(MuiDialogActions);

// User-specified props
export interface IDecisionDialogProps {
  children: React.ReactNode;

  // Variable indicating whether the dialog is open or not.
  // Set to True to open the dialog. The onAccept() and onCancel() handlers should set this to
  // False
  open: boolean;

  // Text for the "accept" and "cancel" buttons
  textAccept?: string;
  textCancel?: string;

  // Text for the title of the dialog
  title?: string;

  // Click handlers for the "accept" and "cancel" buttons
  onAccept: () => void;
  onCancel: () => void;
}

export default function DecisionDialog(
  { children, open, textAccept, textCancel, title, onAccept, onCancel, ...other }: IDecisionDialogProps
) {
  return (
    <Dialog onClose={onCancel} aria-labelledby="customized-dialog-title" open={open} {...other}>
      <DialogTitle onClose={onCancel}>
        {title ?? "Alert"}
      </DialogTitle>
      <DialogContent dividers>
        {children}
      </DialogContent>
      <DialogActions>
        <Button autoFocus variant="contained" color="primary" onClick={onCancel}>
          {textCancel ?? "Cancel"}
        </Button>
        <Button variant="contained" color="secondary" onClick={onAccept}>
          {textAccept ?? "Okay"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}