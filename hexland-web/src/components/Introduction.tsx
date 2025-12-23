import { useContext } from 'react';
import './Introduction.css';

import { FirebaseContext } from './FirebaseContext';

import { Link } from 'react-router-dom';

// This component shows the introductory blurb on the home page.
function Introduction() {
  const { usingLocalEmulators } = useContext(FirebaseContext);

  return (
    <div>
      <img className="Introduction-image" alt="Orc with chest on hex grid" src="/orc_with_chest.png" />
      <h5 className="mt-4">Welcome to Wall &amp; Shadow.</h5>
      <p>
        Wall &amp; Shadow helps you create, share and play on encounter maps for your favourite tabletop roleplaying games, quickly and easily.
        In fact, it's fast enough that you don't always need to prepare -- you can draw your map around your players' character tokens,
        after your game has begun!
      </p>
      <p>To get started, log in through the <Link to="/login">Sign up/Login</Link> link.  (Logging in prevents Wall &amp; Shadow from confusing you with other players.)</p>
      <p>
        As a Game Master, Wall &amp; Shadow enables you to create one or more <b>Adventures</b>, each containing one or more <b>Maps</b>.
        Click the <b>New adventure</b> button to create an adventure and the <b>New map</b> button to create a map.
        To invite players into your adventure, click the <b>Create invite link</b> button and send them the link.
      </p>
      <p>
        As a player, simply follow the link your Game Master sends you and login if you haven't already.  You can see all
        the adventures you've joined in the <b>Shared with me</b> page, and the adventures and maps you've opened most recently
        appear on this home page.
      </p>
      {usingLocalEmulators ? null : // don't show the video in e2e testing
        <iframe className="Introduction-video" title="Demo video" width="560" height="315" src="https://www.youtube.com/embed/B6KjzGrOab8" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
      }
      <h5>The map screen</h5>
      <p>
        The map is where all the action is, but it's blank by default, which means your players won't be able to see anything.
        To enable them to interact with your map, use the <b>Add token</b> option in the context menu (right click) to create a token
        for each of them.
      </p>
      <p>Other features of the map are:</p>
      <dl>
        <dt>Notes</dt>
        <dd>These text labels can be added anywhere and either visible to all players or only the owner of the map.</dd>
        <dt>Areas</dt>
        <dd>
          Choose a colour from the palette on the left and paint the tiles of the map.  Areas can be seen by all players with
          a token but don't affect token movement.  Use them to indicate difficult terrain, water, bees, or whatever fits your scenario.
        </dd>
        <dt>Walls</dt>
        <dd>
          Walls can be painted in between the vertices of the map and are also visible to all players with a token.  However, your players cannot
          see through, or move through, a wall.  Use these to create a layout of rooms or caves, funnel your players through the map,
          and keep things secret from them until you are ready.
        </dd>
      </dl>
      <h5>Happy gaming!</h5>
    </div>
  );
}

export default Introduction;