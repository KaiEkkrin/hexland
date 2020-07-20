import React from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';

function Controls() {
  return (
    <ButtonGroup className="btn-group-vertical" aria-label="Controls">
      <Button>1</Button>
      <Button>2</Button>
      <Button>3</Button>
    </ButtonGroup>
  );
}

interface IMapProps {
}

class Map extends React.Component {
  private canvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: IMapProps) {
    super(props);
    this.canvas = React.createRef();
  }

  componentDidMount() {
    var cc = this.canvas.current;
    var br = cc?.getBoundingClientRect();
    var ctx = cc?.getContext("2d");
    if (cc && br && ctx) {
      cc.width = br.width;
      cc.height = br.height;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, br.width, br.height);

      ctx.fillStyle = "#ff0000";
      ctx.fillRect(100, 100, br.width - 200, br.height - 200);
    }
  }

  render() {
    return (
      <div>
        <Navigation />
        <header className="Map-header">
          <canvas className="Map-canvas" ref={this.canvas} />
        </header>
      </div>
    );
  }
}

export default Map;
