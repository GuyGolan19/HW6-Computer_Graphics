import {OrbitControls} from './OrbitControls.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

// Create basketball court
function createBasketballCourt() {
  const courtGeometry = new THREE.BoxGeometry(30, 0.2, 15);
  const courtMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xc68642,  // Brown wood color
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  scene.add(court);
  
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
  
  // Center line 
  const centerLineGeometry = new THREE.BufferGeometry();
  const centerLinePoints = [
    new THREE.Vector3(0, 0.11, -7.5),
    new THREE.Vector3(0, 0.11, 7.5)
  ];
  centerLineGeometry.setFromPoints(centerLinePoints);
  const centerLine = new THREE.Line(centerLineGeometry, lineMaterial);
  scene.add(centerLine);
  
  // Create center circle 
  const centerCirclePoints = [];
  const radius = 2.0;
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    centerCirclePoints.push(new THREE.Vector3(x, 0.11, z));
  }
  const centerCircleGeometry = new THREE.BufferGeometry();
  centerCircleGeometry.setFromPoints(centerCirclePoints);
  const centerCircle = new THREE.Line(centerCircleGeometry, lineMaterial);
  scene.add(centerCircle);
  
  // Three-point lines 
  createMyThreePointLine(-14, lineMaterial);
  createMyThreePointLine(14, lineMaterial);
  
  // Court boundaries
  createCourtBoundaries(lineMaterial);
}

// Create three-point arc 
function createMyThreePointLine(xPosition, material) {
  const points = [];
  const arcRadius = 6.75;
  const startAngle = -Math.PI/2;
  const endAngle = Math.PI/2;

  // Create arc points mathematically
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const angle = startAngle + (endAngle - startAngle) * t;
    
    // For right side, we need to mirror the X coordinate to curve inward
    let x, z;
    if (xPosition > 0) {
      // Right side: mirror the arc horizontally so it curves inward
      x = xPosition - Math.cos(angle) * arcRadius;  
      z = Math.sin(angle) * arcRadius;
    } else {
      // Left side: normal arc
      x = xPosition + Math.cos(angle) * arcRadius;
      z = Math.sin(angle) * arcRadius;
    }
    
    points.push(new THREE.Vector3(x, 0.11, z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}

// Create court boundary lines
function createCourtBoundaries(material) {
  const boundaryPoints = [
    new THREE.Vector3(-15, 0.11, -7.5),
    new THREE.Vector3(15, 0.11, -7.5),
    new THREE.Vector3(15, 0.11, 7.5),
    new THREE.Vector3(-15, 0.11, 7.5),
    new THREE.Vector3(-15, 0.11, -7.5)
  ];
  
  const boundaryGeometry = new THREE.BufferGeometry();
  boundaryGeometry.setFromPoints(boundaryPoints);
  const boundaryLine = new THREE.Line(boundaryGeometry, material);
  scene.add(boundaryLine);
}

// Create basketball hoop assembly 
function createBasketballHoop(xPosition, facingDirection) {
  const hoopGroup = new THREE.Group();
  
  // Support pole
  const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 4, 8);
  const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(xPosition - (facingDirection * 1.5), 2, 0);  // Away from center
  pole.castShadow = true;
  hoopGroup.add(pole);
  
  // Support arm 
  const armGeometry = new THREE.BoxGeometry(1.2, 0.1, 0.1);
  const arm = new THREE.Mesh(armGeometry, poleMaterial);
  arm.position.set(xPosition - (facingDirection * 0.75), 3.5, 0);  // Between pole and backboard
  arm.castShadow = true;
  hoopGroup.add(arm);
  
  // Backboard 
  const backboardGeometry = new THREE.BoxGeometry(0.1, 1.8, 1.2);
  const backboardMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.9 
  });
  const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
  backboard.position.set(xPosition, 3.5, 0);  // At baseline
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  hoopGroup.add(backboard);
  
  // Rim 
  const rimGeometry = new THREE.TorusGeometry(0.45, 0.03, 8, 32);
  const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.set(xPosition + (facingDirection * 0.5), 3.05, 0);  // Toward center
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  hoopGroup.add(rim);
  
  // Net at same position as rim  
  createMyNet(xPosition + (facingDirection * 0.5), hoopGroup);
  
  scene.add(hoopGroup);
}

// Create basketball net 
function createMyNet(xPosition, parentGroup) {
  const netMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const netRadius = 0.45;  // Match our rim radius
  const netSegments = 12;
  const netHeight = 0.8;
  
  // Create vertical net segments 
  for (let i = 0; i < netSegments; i++) {
    const angle = (i / netSegments) * Math.PI * 2;
    
    const points = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      const currentRadius = netRadius * (1 - t * 0.3);  
      const currentX = Math.cos(angle) * currentRadius;
      const currentZ = Math.sin(angle) * currentRadius;
      const currentY = -t * netHeight; 
      points.push(new THREE.Vector3(currentX, currentY, currentZ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, netMaterial);
    line.position.set(xPosition, 3.05, 0);
    parentGroup.add(line);
  }
  
  // Horizontal connecting rings 
  for (let j = 1; j <= 4; j++) {
    const t = j / 8;
    const currentRadius = netRadius * (1 - t * 0.3);  
    const currentY = -t * netHeight;
    
    const points = [];
    for (let i = 0; i <= netSegments; i++) {
      const angle = (i / netSegments) * Math.PI * 2;
      const currentX = Math.cos(angle) * currentRadius;
      const currentZ = Math.sin(angle) * currentRadius;
      points.push(new THREE.Vector3(currentX, currentY, currentZ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, netMaterial);
    line.position.set(xPosition, 3.05, 0);
    parentGroup.add(line);
  }
}

// Create basketball with seam lines
function createBasketball() {
  const ballGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const ballMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff6600,
    shininess: 30
  });
  const basketball = new THREE.Mesh(ballGeometry, ballMaterial);
  basketball.position.set(0, 0.4, 0);
  basketball.castShadow = true;
  
  const seamMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const seamPoints = [];
    
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      const theta = t * Math.PI;
      const x = Math.cos(angle) * Math.sin(theta) * 0.31;
      const y = Math.cos(theta) * 0.31;
      const z = Math.sin(angle) * Math.sin(theta) * 0.31;
      seamPoints.push(new THREE.Vector3(x, y, z));
    }
    
    const seamGeometry = new THREE.BufferGeometry().setFromPoints(seamPoints);
    const seamLine = new THREE.Line(seamGeometry, seamMaterial);
    seamLine.position.copy(basketball.position);
    scene.add(seamLine);
  }
  
  scene.add(basketball);
}

// Create simple stadium atmosphere for bonus points
function createStadiumAtmosphere() {
  createSimpleStands();
  createHangingScoreboard();
  createStadiumLighting();
}

// Create realistic stands with individual seats
function createSimpleStands() {
  // Stadium structure base
  const standBaseGeometry = new THREE.BoxGeometry(25, 4, 4);
  const standBaseMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 }); // Saddle brown
  
  // Left side stand base
  const leftStandBase = new THREE.Mesh(standBaseGeometry, standBaseMaterial);
  leftStandBase.position.set(0, 2, -18);
  leftStandBase.castShadow = true;
  leftStandBase.receiveShadow = true;
  scene.add(leftStandBase);
  
  // Right side stand base
  const rightStandBase = new THREE.Mesh(standBaseGeometry, standBaseMaterial);
  rightStandBase.position.set(0, 2, 18);
  rightStandBase.castShadow = true;
  rightStandBase.receiveShadow = true;
  scene.add(rightStandBase);
  
  // Create realistic seating for both sides
  for (let side = -1; side <= 1; side += 2) {
    createRealisticSeating(side);
  }
  
  // Add railings
  createStadiumRailings();
}

// Create realistic individual seats
function createRealisticSeating(side) {
  const rows = 4;
  const seatsPerRow = 12;
  const seatWidth = 1.8;
  const seatDepth = 1.2;
  const rowHeight = 1.2;
  
  for (let row = 0; row < rows; row++) {
    for (let seat = 0; seat < seatsPerRow; seat++) {
      // Seat cushion
      const seatGeometry = new THREE.BoxGeometry(seatWidth * 0.8, 0.2, seatDepth * 0.7);
      const seatColor = (row + seat) % 3 === 0 ? 0x4169E1 : 
                        (row + seat) % 3 === 1 ? 0x1E90FF : 0x6495ED; // Three shades of blue
      const seatMaterial = new THREE.MeshPhongMaterial({ color: seatColor });
      const seatCushion = new THREE.Mesh(seatGeometry, seatMaterial);
      
      // Position seat
      const seatX = -11 + seat * 2;
      const seatY = 4.2 + row * rowHeight;
      const seatZ = side * (18 - row * 0.3); // Slight angle inward
      
      seatCushion.position.set(seatX, seatY, seatZ);
      seatCushion.castShadow = true;
      scene.add(seatCushion);
      
      // Seat backrest
      const backrestGeometry = new THREE.BoxGeometry(seatWidth * 0.8, 0.8, 0.15);
      const backrestMaterial = new THREE.MeshPhongMaterial({ color: seatColor });
      const backrest = new THREE.Mesh(backrestGeometry, backrestMaterial);
      backrest.position.set(seatX, seatY + 0.5, seatZ + side * seatDepth * 0.35);
      backrest.castShadow = true;
      scene.add(backrest);
      
      // Seat armrests 
      if (seat % 2 === 0) {
        for (let armSide = -1; armSide <= 1; armSide += 2) {
          const armrestGeometry = new THREE.BoxGeometry(0.15, 0.6, seatDepth * 0.6);
          const armrestMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
          const armrest = new THREE.Mesh(armrestGeometry, armrestMaterial);
          armrest.position.set(
            seatX + armSide * seatWidth * 0.4, 
            seatY + 0.3, 
            seatZ
          );
          armrest.castShadow = true;
          scene.add(armrest);
        }
      }
    }
    
    // Row separator/step
    const stepGeometry = new THREE.BoxGeometry(25, 0.3, 0.8);
    const stepMaterial = new THREE.MeshPhongMaterial({ color: 0x696969 });
    const step = new THREE.Mesh(stepGeometry, stepMaterial);
    step.position.set(0, 4 + row * rowHeight, side * (18.5 - row * 0.3));
    step.castShadow = true;
    scene.add(step);
  }
}

// Add safety railings
function createStadiumRailings() {
  for (let side = -1; side <= 1; side += 2) {
    // Top railing
    const railingGeometry = new THREE.BoxGeometry(25, 0.15, 0.15);
    const railingMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const topRailing = new THREE.Mesh(railingGeometry, railingMaterial);
    topRailing.position.set(0, 8.5, side * 16);
    topRailing.castShadow = true;
    scene.add(topRailing);
    
    // Railing posts
    for (let post = -5; post <= 5; post += 2) {
      const postGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.5);
      const postMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
      const railingPost = new THREE.Mesh(postGeometry, postMaterial);
      railingPost.position.set(post * 2, 7.7, side * 16);
      railingPost.castShadow = true;
      scene.add(railingPost);
    }
  }
}

// Create hanging scoreboard
function createHangingScoreboard() {
  const scoreboardGroup = new THREE.Group();
  
  // Hanging scoreboard above center court
  const scoreboardGeometry = new THREE.BoxGeometry(8, 3, 0.3);
  const scoreboardMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x000000,
    emissive: 0x004400 // Green glow
  });
  const scoreboard = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
  scoreboard.position.set(0, 12, 0);
  scoreboard.castShadow = true;
  scoreboardGroup.add(scoreboard);
  
  // Suspension cables
  for (let i = -1; i <= 1; i += 2) {
    const cableGeometry = new THREE.CylinderGeometry(0.02, 0.02, 8);
    const cableMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.position.set(i * 3, 16, 0);
    scoreboardGroup.add(cable);
  }
  
  // Simple display panels
  const displayGeometry = new THREE.BoxGeometry(3, 1, 0.1);
  const displayMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x00FF00,
    emissive: 0x002200
  });
  
  // Home score display
  const homeDisplay = new THREE.Mesh(displayGeometry, displayMaterial);
  homeDisplay.position.set(-2, 12, 0.2);
  scoreboardGroup.add(homeDisplay);
  
  // Away score display  
  const awayDisplay = new THREE.Mesh(displayGeometry, displayMaterial);
  awayDisplay.position.set(2, 12, 0.2);
  scoreboardGroup.add(awayDisplay);
  
  scene.add(scoreboardGroup);
}

// Create stadium lighting poles
function createStadiumLighting() {
  const positions = [
    [-20, 0, -12], [20, 0, -12], // Behind stands
    [-20, 0, 12], [20, 0, 12]
  ];
  
  positions.forEach(pos => {
    // Light pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.3, 15);
    const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(pos[0], 7.5, pos[2]);
    pole.castShadow = true;
    scene.add(pole);
    
    // Light fixture
    const lightGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.8);
    const lightMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xFFFFFF,
      emissive: 0x444444
    });
    const lightFixture = new THREE.Mesh(lightGeometry, lightMaterial);
    lightFixture.position.set(pos[0], 14.5, pos[2]);
    lightFixture.castShadow = true;
    scene.add(lightFixture);
    
    // Add actual light source
    const stadiumLight = new THREE.SpotLight(0xffffff, 0.3);
    stadiumLight.position.set(pos[0], 15, pos[2]);
    stadiumLight.target.position.set(0, 0, 0);
    stadiumLight.angle = Math.PI / 6;
    stadiumLight.penumbra = 0.3;
    scene.add(stadiumLight);
    scene.add(stadiumLight.target);
  });
}

// Create all court elements
createBasketballCourt();

// Create hoops at proper court positions 
createBasketballHoop(-12.5, 1); 
createBasketballHoop(12.5, -1);  

createBasketball();

// Add stadium atmosphere for bonus points
createStadiumAtmosphere();

// Set camera position for better view 
camera.position.set(0, 15, 30);
camera.lookAt(0, 0, 0);

// Orbit controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
let isOrbitEnabled = true;


function handleKeyDown(e) {
  if (e.key === "o") {
    isOrbitEnabled = !isOrbitEnabled;
    console.log('Orbit controls:', isOrbitEnabled ? 'enabled' : 'disabled');
  }
}

document.addEventListener('keydown', handleKeyDown);

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Animation function
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();
  
  renderer.render(scene, camera);
}
animate();

// Expose key objects to global scope for hw6.js
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.controls = controls;