import React, { RefObject } from 'react';
import './App.css';
import Navigation from './Navigation';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';

import * as THREE from 'three';

function Controls() {
  return (
    <ButtonGroup className="btn-group-vertical" aria-label="Controls">
      <Button>1</Button>
      <Button>2</Button>
      <Button>3</Button>
    </ButtonGroup>
  );
}

interface IDrawingProps {
}

class Drawing extends React.Component {
  mount: RefObject<HTMLDivElement>;

  constructor(props: IDrawingProps) {
    super(props);
    this.mount = React.createRef();
  }

  componentDidMount() {
    const spacing = 75.0;

    var mount = this.mount.current;
    if (!mount) {
      return;
    }

    var scene = new THREE.Scene();

    const left = window.innerWidth / -2;
    const right = window.innerWidth / 2;
    const top = window.innerHeight / -2;
    const bottom = window.innerHeight / 2;
    var camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // Drawing a square grid looks like this:
    var gridMaterial = new THREE.LineBasicMaterial({ color: 0xd0d0d0 });

    // Vertical lines:
    var vPoints = [];
    for (var x = left; x <= right; x += spacing * 2) {
      vPoints.push(new THREE.Vector3(x, top, 1));
      vPoints.push(new THREE.Vector3(x, bottom, 1));
      vPoints.push(new THREE.Vector3(x + spacing, bottom, 1));
      vPoints.push(new THREE.Vector3(x + spacing, top, 1));
    }

    var vGeometry = new THREE.BufferGeometry().setFromPoints(vPoints);
    var vLines = new THREE.LineSegments(vGeometry, gridMaterial);
    scene.add(vLines);

    // Horizontal lines:
    var hPoints = [];
    for (var y = top; y <= bottom; y += spacing * 2) {
      hPoints.push(new THREE.Vector3(left, y, 1));
      hPoints.push(new THREE.Vector3(right, y, 1));
      hPoints.push(new THREE.Vector3(right, y + spacing, 1));
      hPoints.push(new THREE.Vector3(left, y + spacing, 1));
    }

    var hGeometry = new THREE.BufferGeometry().setFromPoints(hPoints);
    var hLines = new THREE.LineSegments(hGeometry, gridMaterial);
    scene.add(hLines);

    camera.position.z = 5;
    renderer.render(scene, camera);
  }

  render() {
    return (
      <div ref={this.mount} />
    );
  }
}

function Map() {
  return (
    <div>
      <Navigation />
      <Drawing />
    </div>
  );
}

export default Map;
