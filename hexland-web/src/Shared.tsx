import React from 'react';
import './App.css';

import AdventureCollection from './AdventureCollection';
import { AppContext, AppState } from './App';
import Navigation from './Navigation';

import { IPlayer } from './data/adventure';
import { IDataService } from './services/interfaces';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { RouteComponentProps } from 'react-router-dom';

interface ISharedProps {
  dataService: IDataService | undefined;
}

class SharedState {
  adventures: IPlayer[] = [];
}

class Shared extends React.Component<ISharedProps, SharedState> {
  private _stopWatchingAdventures: (() => void) | undefined;

  constructor(props: ISharedProps) {
    super(props);
    this.state = new SharedState();
  }

  private watchAdventures() {
    this._stopWatchingAdventures?.();
    this._stopWatchingAdventures = this.props.dataService?.watchSharedAdventures(
      a => {
        console.log("Received " + a.length + " shared adventures");
        this.setState({ adventures: a.filter(a2 => a2.playerId !== a2.owner) });
      },
      e => console.error("Error watching shared adventures:", e)
    );
  }

  componentDidMount() {
    this.watchAdventures();
  }

  componentDidUpdate(prevProps: ISharedProps) {
    if (this.props.dataService !== prevProps.dataService) {
      this.watchAdventures();
    }
  }

  componentWillUnmount() {
    this._stopWatchingAdventures?.();
    this._stopWatchingAdventures = undefined;
  }

  render() {
    return (
      <div>
        <Navigation getTitle={() => "Adventures shared with me"}/>
        <Container fluid>
          <Row>
            <Col>
              <AdventureCollection uid={this.props.dataService?.getUid()}
                getAdventures={() => this.state.adventures} setAdventure={undefined} />
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

interface ISharedPageProps {}

function SharedPage(props: RouteComponentProps<ISharedPageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <Shared dataService={context.dataService} />
      )}
    </AppContext.Consumer>
  );
}

export default SharedPage;
