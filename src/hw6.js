// hw6.js — interactive basketball shooting game with rim bouncing physics

function waitForSceneInit(callback) {
  const interval = setInterval(() => {
    if (window.scene && window.camera && window.renderer) {
      clearInterval(interval);
      callback();
    } else {
      console.warn("Waiting for hw5.js to load...");
    }
  }, 100);
}

waitForSceneInit(() => {
  const scene = window.scene;
  const camera = window.camera;
  const renderer = window.renderer;
  const controls = window.controls;

  const GRAVITY = -9.8 * 0.03;
  const DAMPING = 0.9;
  const BALL_RADIUS = 0.3;
  const POWER_STEP = 5;
  const MAX_POWER = 100;
  const MIN_POWER = 10;
  const COURT_BOUNDS = { x: 14.5, z: 7 };
  const BACKBOARD_BOUNCE = 0.8;
  const HOOP_HEIGHT = 3.05;
  const HOOP_INNER_RADIUS = 0.45;
  const HOOP_RADIUS = 0.5;
  const RIM_BOUNCE = 0.75;
  const ROTATION_SPEED = 1.2;
  const MOVE_STEP = 0.3;
  
  // Ground bouncing physics constants
  const GROUND_BOUNCE = 0.7;        // How much energy is retained when bouncing
  const GROUND_FRICTION = 0.85;     // Friction coefficient for horizontal movement
  const MIN_BOUNCE_VELOCITY = 0.5;  // Minimum velocity to continue bouncing
  const ROLLING_FRICTION = 0.95;    // Friction when ball is rolling

  let ball, seams = [], ballGroup;
  let velocity = new THREE.Vector3(0, 0, 0);
  let isShot = false;
  let power = 50;
  let score = 0, shots = 0, made = 0;
  let angularVelocity = new THREE.Vector3();
  let scoredThisShot = false;
  let hitRimThisShot = false;
  let gentleRimContact = false;
  let isRolling = false;

  const powerFill = document.getElementById('power-fill');
  const powerText = document.getElementById('power-text');

  function updatePowerBarVisuals() {
    const percent = power;
    if (powerFill) {
      powerFill.style.width = `${percent}%`;
      if (percent >= 80) powerFill.style.background = 'red';
      else if (percent >= 50) powerFill.style.background = 'orange';
      else powerFill.style.background = 'limegreen';
    }
    if (powerText) {
      powerText.textContent = `${percent}%`;
    }
  }

  function createBallGroup() {
    const objects = scene.children.filter(obj => obj.type === 'Mesh' && obj.geometry.type === 'SphereGeometry');
    const lines = scene.children.filter(obj => obj.type === 'Line');
    ball = objects.find(obj => obj.geometry.parameters?.radius === BALL_RADIUS);
    if (!ball) {
      console.error("Ball not found");
      return;
    }
    const ballPosition = ball.position.clone();
    seams = lines.filter(line => {
      const dist = line.position.distanceTo(ballPosition);
      return dist < 0.05 && line.geometry.boundingSphere?.radius < 0.4;
    });
    ballGroup = new THREE.Group();
    ballGroup.add(ball);
    seams.forEach(line => {
      scene.remove(line);
      ballGroup.add(line);
    });
    scene.add(ballGroup);
  }

  function updateUI(msg = '') {
    const accuracy = shots > 0 ? ((made / shots) * 100).toFixed(1) : '0.0';
    const scoreEl = document.getElementById('score');
    const attemptsEl = document.getElementById('shot-attempts');
    const madeEl = document.getElementById('shots-made');
    const accuracyEl = document.getElementById('accuracy');
    if (scoreEl) scoreEl.textContent = score;
    if (attemptsEl) attemptsEl.textContent = shots;
    if (madeEl) madeEl.textContent = made;
    if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;
    updatePowerBarVisuals();
    if (msg) {
      const messageBox = document.getElementById('game-message');
      if (messageBox) {
        messageBox.innerHTML = msg;
        messageBox.style.opacity = 1;
        setTimeout(() => messageBox.style.opacity = 0, 2000);
      }
    }
  }

  function createConfettiExplosion(position) {
    const confettiCount = 80;
    for (let i = 0; i < confettiCount; i++) {
      const geometry = new THREE.PlaneGeometry(0.1, 0.1);
      const color = new THREE.Color(Math.random(), Math.random(), Math.random());
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const confetti = new THREE.Mesh(geometry, material);
      confetti.position.copy(position);
      confetti.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(confetti);
      const confettiVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4,
        (Math.random() - 0.5) * 4
      );
      const life = 1.5 + Math.random() * 1.5;
      const startTime = performance.now();

      function animateConfetti() {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > life) {
          scene.remove(confetti);
          return;
        }
        confetti.position.addScaledVector(confettiVelocity, 0.016);
        confettiVelocity.y -= 0.1;
        confetti.rotation.x += 0.1;
        confetti.rotation.y += 0.1;
        requestAnimationFrame(animateConfetti);
      }
      animateConfetti();
    }
  }
  
  function checkBackboardCollision() {
    const backboardPositions = [-12.5, 12.5];
    
    for (let backboardX of backboardPositions) {
      const ballSide = ballGroup.position.x > 0 ? 1 : -1;
      const backboardSide = backboardX > 0 ? 1 : -1;
      
      if (ballSide === backboardSide) {
        const distanceToBackboard = Math.abs(ballGroup.position.x - backboardX);
        
        if (distanceToBackboard <= BALL_RADIUS + 0.05 && 
            ballGroup.position.y >= 2.6 && ballGroup.position.y <= 4.4 &&
            Math.abs(ballGroup.position.z) <= 0.6) {
          
          const wasMovingTowardBackboard = (backboardSide > 0 && velocity.x > 0) || (backboardSide < 0 && velocity.x < 0);
          
          if (wasMovingTowardBackboard) {
            velocity.x = -velocity.x * BACKBOARD_BOUNCE;
            velocity.y *= 0.9;
            velocity.z *= 0.9;
            
            if (backboardSide > 0) {
              ballGroup.position.x = backboardX - BALL_RADIUS - 0.1;
            } else {
              ballGroup.position.x = backboardX + BALL_RADIUS + 0.1;
            }
            
            angularVelocity.y += Math.random() * 0.3 - 0.15;
            hitRimThisShot = true;
            
            
            console.log("Backboard collision detected!");
            return true;
          }
        }
      }
    }
    return false;
  }

  function checkRimCollision() {
    const hoopPositions = [-12.5, 12.5];
    
    for (let hoopX of hoopPositions) {
      const rimX = hoopX > 0 ? hoopX - 0.5 : hoopX + 0.5;
      const dx = ballGroup.position.x - rimX;
      const dz = ballGroup.position.z;
      const dy = ballGroup.position.y - HOOP_HEIGHT;
      
      const distanceToRim = Math.sqrt(dx * dx + dz * dz);
      
      if (distanceToRim >= HOOP_RADIUS - BALL_RADIUS && 
          distanceToRim <= HOOP_RADIUS + BALL_RADIUS &&
          Math.abs(dy) <= BALL_RADIUS + 0.1) {
        
        const ballToRimX = rimX - ballGroup.position.x;
        const ballToRimZ = 0 - ballGroup.position.z;
        const velocityTowardRim = velocity.x * ballToRimX + velocity.z * ballToRimZ;
        
        if (velocityTowardRim > 0 || Math.abs(dy) < 0.05) {
          const impactSpeed = velocity.length();
          const isGentleContact = impactSpeed < 8.0;
          
          const bounceDirectionX = dx / distanceToRim;
          const bounceDirectionZ = dz / distanceToRim;
          
          const isTopHit = dy > 0.05;
          const isBottomHit = dy < -0.05;
          
          if (isTopHit) {
            // Ball hits top of rim - bounces up and away
            const bounceSpeed = velocity.length() * RIM_BOUNCE;
            velocity.x = bounceDirectionX * bounceSpeed * 0.8;
            velocity.z = bounceDirectionZ * bounceSpeed * 0.8;
            velocity.y = Math.abs(velocity.y) * 0.4 + 1.0;
            
            
            hitRimThisShot = true;
            gentleRimContact = false;
          } else if (isBottomHit) {
            // Ball hits bottom/inside of rim - deflects down and away
            const bounceSpeed = velocity.length() * RIM_BOUNCE * 0.6;
            velocity.x = bounceDirectionX * bounceSpeed;
            velocity.z = bounceDirectionZ * bounceSpeed;
            velocity.y = -Math.abs(velocity.y) * 0.3;
            
            
            hitRimThisShot = true;
            gentleRimContact = false;
          } else {
            if (isGentleContact) {
              // Gentle side contact - ball can still go in!
              const bounceSpeed = velocity.length() * 0.85;
              velocity.x = bounceDirectionX * bounceSpeed * 0.4;
              velocity.z = bounceDirectionZ * bounceSpeed * 0.4;
              velocity.y *= 0.9;
              
              
              gentleRimContact = true;
              hitRimThisShot = false;
            } else {
              // Hard side contact - bounce away
              const bounceSpeed = velocity.length() * RIM_BOUNCE;
              velocity.x = bounceDirectionX * bounceSpeed * 0.7;
              velocity.z = bounceDirectionZ * bounceSpeed * 0.7;
              velocity.y *= 0.8;
              
              
              hitRimThisShot = true;
              gentleRimContact = false;
            }
          }
          
          angularVelocity.x += (dz * 0.2) / BALL_RADIUS;
          angularVelocity.z -= (dx * 0.2) / BALL_RADIUS;
          angularVelocity.y += (Math.random() - 0.5) * 0.3;
          
          if (!gentleRimContact) {
            const pushDistance = HOOP_RADIUS + BALL_RADIUS + 0.1;
            ballGroup.position.x = rimX + bounceDirectionX * pushDistance;
            ballGroup.position.z = bounceDirectionZ * pushDistance;
          }
          
          console.log("Rim collision detected!", { 
            isTopHit, 
            isBottomHit, 
            isGentleContact, 
            impactSpeed,
            distanceToRim 
          });
          return true;
        }
      }
    }
    return false;
  }

  function checkScore() {
    if (hitRimThisShot && !gentleRimContact) {
      return;
    }
    
    const rimX = ballGroup.position.x < 0 ? -12.0 : 12.0;
    const dx = ballGroup.position.x - rimX;
    const dz = ballGroup.position.z;
    const distanceToRim = Math.sqrt(dx * dx + dz * dz);

    const isInHoop = (
      distanceToRim <= HOOP_INNER_RADIUS * 1.05 &&
      Math.abs(ballGroup.position.y - HOOP_HEIGHT) <= 0.8 &&
      velocity.y < -0.3 &&
      ballGroup.position.y > HOOP_HEIGHT - 0.2
    );

    if (isInHoop && isShot && !scoredThisShot) {
      scoredThisShot = true;
      score += 2;
      made++;

      
      updateUI('<span style="color:lightgreen">SHOT MADE!</span>');

      const hoopPos = new THREE.Vector3(rimX, HOOP_HEIGHT, 0);
      createConfettiExplosion(hoopPos);

      velocity.x *= 0.4;
      velocity.z *= 0.4;
      velocity.y *= 0.7;
      velocity.y = Math.max(velocity.y - 0.8, -3.0);
      
      const pullToCenter = 0.05;
      velocity.x += (rimX - ballGroup.position.x) * pullToCenter;
      velocity.z += (0 - ballGroup.position.z) * pullToCenter;
    }
  }

  function resetBall() {
    ballGroup.position.set(0, BALL_RADIUS, 0);
    velocity.set(0, 0, 0);
    angularVelocity.set(0, 0, 0);
    isShot = false;
    scoredThisShot = false;
    hitRimThisShot = false;
    gentleRimContact = false;
    isRolling = false; // Reset rolling state
    updateUI();
  }

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w') {
      power = Math.min(MAX_POWER, power + POWER_STEP);
      updatePowerBarVisuals();
    } else if (key === 's') {
      power = Math.max(MIN_POWER, power - POWER_STEP);
      updatePowerBarVisuals();
    } else if (key === 'r') {
      resetBall();
    } else if (key === ' ') {
      event.preventDefault();
      if (!isShot) {
        const angleDeg = 75;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);
        const speed = power * 0.25;

        const targetX = ballGroup.position.x > 0 ? 12.0 : -12.0;
        const dx = targetX - ballGroup.position.x;
        const dz = 0 - ballGroup.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        const dirX = (dx / distance) * Math.cos(angleRad);
        const dirZ = (dz / distance) * Math.cos(angleRad);

        velocity.set(
          dirX * speed,
          Math.sin(angleRad) * speed,
          dirZ * speed
        );

        // Add realistic shooting spin (backspin for better arc)
        angularVelocity.set(
          -2.0, // Strong backspin (negative X rotation)
          0.1 * (Math.random() - 0.5), // Slight random side spin
          0
        );
        isShot = true;
        scoredThisShot = false;
        hitRimThisShot = false;
        gentleRimContact = false;
        isRolling = false; // Reset rolling state for new shot
        shots++;
        updateUI();
      }
    } else if (!isShot) {
      if (key === 'arrowleft') {
        ballGroup.position.x = Math.max(-COURT_BOUNDS.x, ballGroup.position.x - MOVE_STEP);
        
        ball.rotation.z += 0.2; // Roll left
        seams.forEach(seam => seam.rotation.z += 0.2);
      } else if (key === 'arrowright') {
        ballGroup.position.x = Math.min(COURT_BOUNDS.x, ballGroup.position.x + MOVE_STEP);
         
        ball.rotation.z -= 0.2; // Roll right
        seams.forEach(seam => seam.rotation.z -= 0.2);
      } else if (key === 'arrowup') {
        ballGroup.position.z = Math.max(-COURT_BOUNDS.z, ballGroup.position.z - MOVE_STEP);
        
        ball.rotation.x += 0.2; // Roll forward
        seams.forEach(seam => seam.rotation.x += 0.2);
      } else if (key === 'arrowdown') {
        ballGroup.position.z = Math.min(COURT_BOUNDS.z, ballGroup.position.z + MOVE_STEP);
        
        ball.rotation.x -= 0.2; // Roll backward
        seams.forEach(seam => seam.rotation.x = 0.2);
      }
    }
  });

  const clock = new THREE.Clock();
  function updatePhysics(delta) {
    if (!isShot) return;
    
    velocity.y += GRAVITY;
    ballGroup.position.addScaledVector(velocity, delta);
    
    // Realistic ball rotation based on movement
    // Calculate rotation from velocity (like a real rolling ball)
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
    // Rotation around X-axis for forward/backward movement
    const rotationSpeedX = velocity.z / BALL_RADIUS; // Rolling rotation
    ball.rotation.x += rotationSpeedX * delta;
    
    // Rotation around Z-axis for left/right movement  
    const rotationSpeedZ = -velocity.x / BALL_RADIUS; // Rolling rotation
    ball.rotation.z += rotationSpeedZ * delta;
    
    // Add shooting spin (backspin) and other angular velocities
    ball.rotation.x += angularVelocity.x * delta;
    ball.rotation.y += angularVelocity.y * delta;
    ball.rotation.z += angularVelocity.z * delta;
    
    // Apply same rotations to seams so they follow the ball
    seams.forEach(seam => {
      seam.rotation.x += (rotationSpeedX + angularVelocity.x) * delta;
      seam.rotation.y += angularVelocity.y * delta;
      seam.rotation.z += (rotationSpeedZ + angularVelocity.z) * delta;
    });
    
    let hadCollision = false;
    
    if (checkBackboardCollision()) {
      hadCollision = true;
    }
    
    if (!hadCollision && checkRimCollision()) {
      hadCollision = true;
    }
    
    if (!hadCollision) {
      checkScore();
    }

    // Realistic ground collision with bouncing and energy loss
    if (ballGroup.position.y <= BALL_RADIUS) {
      ballGroup.position.y = BALL_RADIUS;
      
      // Check if ball has enough energy to bounce
      const impactSpeed = Math.abs(velocity.y);
      
      if (impactSpeed > MIN_BOUNCE_VELOCITY && isShot) {
        // Ball bounces - apply energy loss and damping
        velocity.y = -velocity.y * GROUND_BOUNCE; // Bounce with energy loss
        velocity.x *= GROUND_FRICTION; // Apply friction to horizontal movement
        velocity.z *= GROUND_FRICTION;
        
        // Add spin from impact
        angularVelocity.x += velocity.z * 0.1 / BALL_RADIUS;
        angularVelocity.z -= velocity.x * 0.1 / BALL_RADIUS;
        angularVelocity.y *= 0.9; // Reduce spinning over time
        
        console.log("Ball bounced on ground! Impact speed:", impactSpeed.toFixed(2));
      } else {
        // Ball stops bouncing and starts rolling
        velocity.y = 0;
        isRolling = true;
        
        // Apply rolling friction
        velocity.x *= ROLLING_FRICTION;
        velocity.z *= ROLLING_FRICTION;
        
        // Gradually reduce angular velocity when rolling
        angularVelocity.multiplyScalar(0.98);
        
        // Stop the shot if ball is moving very slowly
        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (horizontalSpeed < 0.1) {
          velocity.set(0, 0, 0);
          angularVelocity.set(0, 0, 0);
          // Show missed shot message if ball didn't score
          if (!scoredThisShot && isShot) {
            updateUI('<span style="color:tomato">MISSED SHOT</span>');
          }
          isShot = false;
          isRolling = false;
        }
      }
    }
    
    // Apply additional friction when ball is rolling on ground
    if (isRolling && ballGroup.position.y <= BALL_RADIUS + 0.01) {
      velocity.x *= ROLLING_FRICTION;
      velocity.z *= ROLLING_FRICTION;
      angularVelocity.multiplyScalar(0.99);
      
      // Check if ball has stopped while rolling
      const rollSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      if (rollSpeed < 0.05 && isShot && !scoredThisShot) {
        velocity.set(0, 0, 0);
        angularVelocity.set(0, 0, 0);
        updateUI('<span style="color:tomato">MISSED SHOT</span>');
        isShot = false;
        isRolling = false;
      }
    }
    
    // Show missed shot if ball goes out of bounds
    if (isShot && !scoredThisShot && (
        Math.abs(ballGroup.position.x) > COURT_BOUNDS.x + 2 || 
        Math.abs(ballGroup.position.z) > COURT_BOUNDS.z + 2
    )) {
      updateUI('<span style="color:tomato">MISSED SHOT</span>');
      isShot = false;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updatePhysics(delta);
    controls.update();
    renderer.render(scene, camera);
  }

  createBallGroup();
  resetBall();
  updateUI();
  animate();
});