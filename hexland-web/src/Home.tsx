import React, { useContext, useEffect, useMemo, useReducer } from 'react';

import {
  Box,
  //Container,
  Grid,
  //GridList,
  //GridListBar,
  //GridListTile,
  //Paper,
  //Theme,
  Typography,
  //createStyles,
  //makeStyles
} from "@material-ui/core";

import AdventureCollection from './components/AdventureCollection';
import ChangeList from './components/ChangeList';
import Introduction from './components/Introduction';
import MapCollection from './components/MapCollection';
import { ProfileContext } from './components/ProfileContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IPageProps } from './components/interfaces';

//const useStyles = makeStyles((theme: Theme) => createStyles({
//}));

function LatestColumn() {
  const { user } = useContext(UserContext);
  const { profile } = useContext(ProfileContext);

  const myAdventures = useMemo(
    () => profile?.adventures?.filter(a => a.owner === user?.uid) ?? [],
    [profile, user]
  );

  const showNewMap = useMemo(() => myAdventures.length > 0, [myAdventures]);
  const adventures = useMemo(() => profile?.adventures ?? [], [profile]);
  const latestMaps = useMemo(() => profile?.latestMaps ?? [], [profile]);

  return (
    <Grid item xs={6} key="latest">
      <Box pt={2}>
      <Grid item xs={12}>
        <Typography variant="h6">Latest maps</Typography>
        <MapCollection
          adventures={myAdventures}
          maps={latestMaps}
          showNewMap={showNewMap}
          />
      </Grid>
      </Box>
      <Box pt={2}>
      <Grid item xs={12}>
        <Typography variant="h6">Latest adventures</Typography>
        <AdventureCollection
          uid={user?.uid}
          adventures={adventures} showNewAdventure={true} />
      </Grid>
      </Box>
    </Grid>
  );
}

function Home({ navbarTitle, setNavbarTitle }: IPageProps) {
  const { user } = useContext(UserContext);
  //const classes = useStyles();

  useEffect(() => {
    if (navbarTitle !== "") {
      setNavbarTitle("");
    }
  }, [navbarTitle, setNavbarTitle]);

  // We keep the change list state here
  const [changeCount, toggleChangeCount] = useReducer(
    (state: number | undefined, action: void) => state === undefined ? 1 : undefined,
    1
  );

  return (
    <Box>
      <Box mx={2}>
        <Grid container justify="center" spacing={4}>
          <Grid item xs={6} key="intro">
            <ChangeList count={changeCount} toggleCount={() => toggleChangeCount()} />
            <Introduction />
          </Grid>
          {user ? <LatestColumn/> : null }
        </Grid>
      </Box>
    </Box>
  );
}

export default Home;