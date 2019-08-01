class Game {
  constructor() {
    //create variables for ThreeJs

    if (!Detector.webgl) Detector.addGetWebGLMessage(); //detect if WebGL is enabled with the help of detector.js lib

    const game = this;

    this.controls;
    this.camera;
    this.scene;
    this.renderer;
    this.fixedTimeStep = 1.0 / 60.0; //simulate world 60 time steps per 1 second.
    // This number determines how much time one simulation step is to simulate.
    //The smaller the number, the slower and better the simulation.
    this.assetsPath = "assets/"; //path to fbx files and textures

    this.canvas;
    this.canvas = document.createElement("div");
    this.canvas.style.height = "100%";
    document.body.appendChild(this.canvas);

    const options = { assets: [] }; //object for options

    document.getElementById("play-btn").onclick = function() {
      game.startGame();
    }; //button PLAY
  }

  startGame() {
    document.getElementById("play-btn").style.display = "none"; //hide Play button

    this.initThreejs();
    this.animate();
  }

  initThreejs() {
    //init of threeJs the lights camera scene render.

    // perspective amera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      500
    );
    //position
    this.camera.position.set(0, 6, -15);

    //scene
    this.scene = new THREE.Scene();

    // lights type ambient
    const ambient = new THREE.AmbientLight(0xaaaaaa);
    this.scene.add(ambient);

    //direction ,like sunn ligh far infinit
    const light = new THREE.DirectionalLight(0xaaaaaa);
    light.position.set(30, 100, 40);
    light.castShadow = true;
    this.sun = light;
    this.scene.add(light);
    //to display
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    //Sets device pixel ratio
    this.renderer.setPixelRatio(window.devicePixelRatio);
    //resizes the canvas with device pixel ratio taken into account
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.renderer.shadowMap.enabled = true;

    //canvas element
    this.canvas.appendChild(this.renderer.domElement);

    //function for load 3d objects from fbx file
    this.loadAssets();

    //fit camera and renderer for resized window
    window.addEventListener(
      "resize",
      function() {
        game.onWindowResize();
      },
      false
    );
  }

  loadAssets() {
    const game = this;
    //FBXloader initialisation
    const loader = new THREE.FBXLoader();

    loader.load(
      "assets/car_racing_obj_2.fbx",
      object => {
        //traverse. callback.
        object.traverse(function(child) {
          let receiveShadow = true;
          if (child.isMesh) {
            if (child.name.includes("SkyBox")) {
            } else if (child.name == "Carbody") {
              //create car's parts hierarchy
              game.car = {
                chassis: child,
                bonnet: [],
                engine: [],
                wheel: [],
                seat: [],
                selected: {}
              }; //game.car object

              game.followCam = new THREE.Object3D();

              // for manipulating objects in 3D space.
              game.followCam.position.copy(game.camera.position); //add init camera pos to followCam
              game.scene.add(game.followCam); //add followCam object to scene
              game.followCam.parent = child; //car body is a parent node for followCam so the car movement will be together with the followCamera
              game.sun.target = child; //carBody as target for light
              child.castShadow = true;
              receiveShadow = false; //no shadow for the car
              //the look of the car constant
            } else if (child.name.includes("Bonnet")) {
              game.car.selected.bonnet = child;
              child.castShadow = true;
              receiveShadow = false;
            } else if (child.name.includes("Engine")) {
              game.car.selected.engine = child;
              child.castShadow = true;
              receiveShadow = false;
            } else if (child.name.includes("Seat")) {
              game.car.selected.seat = child;
              receiveShadow = false;
            } else if (child.name.includes("Wheel")) {
              game.car.selected.wheel = child;
              child.parent = game.scene;
              child.castShadow = true;
              receiveShadow = false;
            }

            child.receiveShadow = receiveShadow; //visible objects recieve shadow
          }
        });

        game.assets = object;
        game.scene.add(object);

        //cube for environment world and the their texture
        const tloader = new THREE.CubeTextureLoader();
        tloader.setPath("assets/images/");
        var textureCube = tloader.load([
          "px.jpg",
          "nx.jpg",
          "py.jpg",
          "ny.jpg",
          "pz.jpg",
          "nz.jpg"
        ]);
        game.scene.background = textureCube; //all objects inside this cube

        //init CannonJs world simulation
        game.initCannon();
      },
      null,
      function(error) {
        console.error(error);
      }
    );
  }
  //from github source
  initCannon() {
    //create the needed variable
    this.physics = {};

    const game = this;
    const mass = 150;
    const world = new CANNON.World();
    this.world = world;

    //Broadphase algorithm to the world it can find colliding bodies
    world.broadphase = new CANNON.NaiveBroadphase(world);
    //gravity Y axis
    world.gravity.set(0, -10, 0);

    //add Listener for keyboard the user interaction
    window.addEventListener(
      "keydown",
      event => {
        this.racing(event);
      },
      false
    );
    window.addEventListener(
      "keyup",
      event => {
        this.racing(event);
      },
      false
    );

    //defines interacting materials (ground and wheels)
    const groundMaterial = new CANNON.Material("groundMaterial");
    const wheelMaterial = new CANNON.Material("wheelMaterial");
    //what happens when two materials meet.
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(
      wheelMaterial,
      groundMaterial,
      {
        friction: 0.3, //Friction coefficient
        restitution: 0, //the ratio of the final to initial relative velocity between 2 objects after they collide.
        contactEquationStiffness: 1000 //Stiffness of the produced contact equations.
        //Stiffness is the extent to which an object resists
      }
    );

    //  add the materials to the world
    world.addContactMaterial(wheelGroundContactMaterial);

    //car
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2)); //3-dimensional vector define parametrs of BoxShape. BoxShape - car chassis
    const chassisBody = new CANNON.Body({ mass: mass }); //Base class for all body types.
    const pos = this.car.chassis.position.clone();
    pos.y += 1; //car height
    chassisBody.addShape(chassisShape); //add car shape to car body
    chassisBody.position.copy(pos); // set car in place
    chassisBody.threemesh = this.car.chassis; //add car's meshs hierarchy to threemesh

    //driving behavior properties
    const options = {
      radius: 0.3, //wheel radius
      directionLocal: new CANNON.Vec3(0, -1, 0), //wheels position
      suspensionStiffness: 45, //wheels stiffness
      suspensionRestLength: 0.3, //height of suspension
      frictionSlip: 5, //friction slip
      dampingRelaxation: 2.3, //physical mechanism of energy loss
      dampingCompression: 4.5, //Compression damping helps the suspension absorb bumps or road irregularity as the wheel moves upward in the stroke
      maxSuspensionForce: 200000,
      rollInfluence: 0.01, //when turning
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 5, 0), //point of shassi connection
      maxSuspensionTravel: 0.1, //max suspension travel (amortisation)
      customSlidingRotationalSpeed: -30, //custom Sliding Rotational Speed
      useCustomSlidingRotationalSpeed: true //boolean
    };

    // Create the car

    // towards the ground and applies forces.
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: chassisBody,
      //Axis  x=0, y=1, z=2
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    }); //Vehicle helper class that casts rays from the wheel positions and set points of wheels

    const axlewidth = 0.8; //wheels x position
    options.chassisConnectionPointLocal.set(axlewidth, 0, -1);
    vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(-axlewidth, 0, -1);
    vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(axlewidth, 0, 1);
    vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(-axlewidth, 0, 1);
    vehicle.addWheel(options);

    vehicle.addToWorld(world); //add vehicle to world

    //create copies of wheels and add it to scene
    const wheelBodies = [];
    let index = 0;
    const wheels = [this.car.selected.wheel]; //get wheel
    this.car.selected.wheel.children[0].visible = true; //make wheel visible
    this.car.selected.wheel.children[0].castShadow = true; //make wheel casts shadow
    for (let i = 0; i < 3; i++) {
      let wheel = this.car.selected.wheel.clone(); //clone wheel and
      this.scene.add(wheel); //add it to scene
      wheels.push(wheel); //add wheel clone to wheels
    }

    //wheels rigging
    vehicle.wheelInfos.forEach(function(wheel) {
      const cylinderShape = new CANNON.Cylinder(
        wheel.radius,
        wheel.radius,
        wheel.radius / 2,
        20
      ); //cylinder shape for wheel
      const wheelBody = new CANNON.Body({ mass: 1 });
      wheelBody.addShape(cylinderShape);
      wheelBodies.push(wheelBody);
      wheelBody.threemesh = wheels[index++];
    });
    game.car.wheels = wheelBodies;

    // Update wheels
    world.addEventListener("postStep", function() {
      let index = 0;
      game.vehicle.wheelInfos.forEach(function(wheel) {
        game.vehicle.updateWheelTransform(index); //updates one of the wheel transform.
        const t = wheel.worldTransform; //to get the pos and the quaternion
        //set coordinates of new position
        wheelBodies[index].threemesh.position.copy(t.position); //set new position of wheel
        wheelBodies[index].threemesh.quaternion.copy(t.quaternion); //describes a rotation in 3D space.

        index++;
      });
    });

    this.vehicle = vehicle;

    this.createColliders();
  }

  racing(event) {
    var up = event.type == "keyup";

    const maxSteerVal = 0.6; //maximum angle of rotation of wheels
    const wheelForce = 500; // how fast
    const brakeForce = 10; //braking force

    //set Brake 0 for each whel
    this.vehicle.setBrake(0, 0);
    this.vehicle.setBrake(0, 1);
    this.vehicle.setBrake(0, 2);
    this.vehicle.setBrake(0, 3);

    //Set the wheel force to apply on one of the wheels each time step
    switch (event.keyCode) {
      case 38: // forward
        this.vehicle.applyEngineForce(up ? 0 : -wheelForce, 0);
        this.vehicle.applyEngineForce(up ? 0 : -wheelForce, 1);
        break;

      case 40: // backward
        this.vehicle.applyEngineForce(up ? 0 : wheelForce, 2);
        this.vehicle.applyEngineForce(up ? 0 : wheelForce, 3);
        break;

      case 66: // b
        this.vehicle.setBrake(brakeForce, 0);
        this.vehicle.setBrake(brakeForce, 1);
        this.vehicle.setBrake(brakeForce, 2);
        this.vehicle.setBrake(brakeForce, 3);
        break;

      case 39: // right
        this.vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 2);
        this.vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 3);
        break;

      case 37: // left
        this.vehicle.setSteeringValue(up ? 0 : maxSteerVal, 2);
        this.vehicle.setSteeringValue(up ? 0 : maxSteerVal, 3);
        break;
    }
  }

  createColliders() {
    const world = this.world;
    const scaleAdjust = 0.9;
    const divisor = 2 / scaleAdjust;
    this.assets.children.forEach(function(child) {
      //get each object from assets (from fbx file)
      //its name begins with "Collider"
      if (child.isMesh && child.name.includes("Collider")) {
        child.visible = false; //not visible on scene
        const halfExtents = new CANNON.Vec3(
          child.scale.x / divisor,
          child.scale.y / divisor,
          child.scale.z / divisor
        );
        //rigging colliders
        const box = new CANNON.Box(halfExtents);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(box);
        body.position.copy(child.position); //pos on the scene
        body.quaternion.copy(child.quaternion); //angle
        world.add(body); //add body to CannonJs world
      }
    });
  }

  onWindowResize() {
    //if window resized changed windows size
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix(); //update camera view
    this.renderer.setSize(window.innerWidth, window.innerHeight); //render window with new size
  }

  updateCamera() {
    //to follow the car
    if (this.followCam === undefined) return;
    const pos = this.car.chassis.position.clone(); //get pos of car
    pos.y += 0.6; //height of followCam
    if (this.controls !== undefined) {
      //if target defined
      this.controls.target.copy(pos); //set new coordinates to camera target
      this.controls.update(); //update
    } else {
      //if target not dofined
      this.camera.position.lerp(
        this.followCam.getWorldPosition(new THREE.Vector3()),
        0.05
      ); //set new camera position
      this.camera.lookAt(pos); //look at car
    }

    if (this.sun != undefined) {
      this.sun.position.copy(this.camera.position); //set sun position
      this.sun.position.y += 10; // higher than the camera by 10
    }
  }

  animate() {
    const game = this;

    //The method takes a callback as an argument to be invoked before the repaint.
    requestAnimationFrame(function() {
      game.animate();
    });

    //time between two calls
    const now = Date.now();
    if (this.lastTime === undefined) this.lastTime = now;
    const dt = (Date.now() - this.lastTime) / 1000.0;
    //delta time in second btw two calls
    this.lastTime = now;

    //cycle of simulation
    if (this.world !== undefined) {
      this.world.step(this.fixedTimeStep, dt, 10);
      //get all element the car body
      this.world.bodies.forEach(function(body) {
        if (body.threemesh != undefined) {
          body.threemesh.position.copy(body.position); //set new position to car parts
          body.threemesh.quaternion.copy(body.quaternion); //set new quaternion
        }
      });
    }

    this.updateCamera();

    if (this.debugRenderer !== undefined) this.debugRenderer.update();

    //update scene and camera
    this.renderer.render(this.scene, this.camera);
  }
}
