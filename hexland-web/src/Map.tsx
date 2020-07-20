import React from 'react';
import './App.css';
import './Map.css';
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

interface IMapProps {
}

class Drawing extends React.Component {
  componentDidMount() {
    // From https://blog.bitsrc.io/starting-with-react-16-and-three-js-in-5-minutes-3079b8829817
    // === THREE.JS CODE START ===
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    var geometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    camera.position.z = 5;
    var animate = function () {
      requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();
  }

  render() {
    return (
      <div />
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
