/*
 * Material UI theme for Hexland
 */
import { createMuiTheme } from '@material-ui/core/styles';

/*declare module '@material-ui/core/index' {
  namespace PropTypes {
    type Color |= 'inherit' | 'primary' | 'secondary' | 'warning' | 'info' | 'success' | 'default';
  }
}*/

const theme = createMuiTheme({
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "Roboto",
      "Oxygen",
      "Ubuntu",
      "Cantarell",
      "Fira Sans",
      "Droid Sans",
      "Helvetica Neue",
      "sans-serif",
    ].join(",")
  }
});

export default theme;
