const container = document.getElementById("mars-distance-widget");

//
// SCENA
//

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

scene.fog = new THREE.FogExp2(0x000000, 0.00035);

//
// KAMERA
//

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    10000
);

//
// RENDERER
//

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

container.appendChild(renderer.domElement);

//
// ŚWIATŁO
//

const sunLight = new THREE.PointLight(0xffffff, 3, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

scene.add(new THREE.AmbientLight(0x222222));

//
// GWIAZDY
//

function createStars() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 12000; i++) {
        vertices.push(
            THREE.MathUtils.randFloatSpread(4000),
            THREE.MathUtils.randFloatSpread(4000),
            THREE.MathUtils.randFloatSpread(4000)
        );
    }

    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
    );

    const stars = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.25,
            transparent: true,
            opacity: 0.7
        })
    );

    scene.add(stars);
}

createStars();

//
// SŁOŃCE
//

const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffdd55 })
);
scene.add(sun);

const glow = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 64, 64),
    new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.22
    })
);
scene.add(glow);

//
// PLANETY
//

const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0x3366ff, shininess: 20 })
);
scene.add(earth);

const mars = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0xff5533, shininess: 10 })
);
scene.add(mars);

//
// LINIA ODLEGŁOŚCI (FIX artefaktów)
//

const distanceGeometry = new THREE.BufferGeometry();
const distanceMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25
});

const distanceLine = new THREE.Line(distanceGeometry, distanceMaterial);
scene.add(distanceLine);

//
// LABEL
//

const label = document.createElement("div");
label.style.position = "absolute";
label.style.top = "20px";
label.style.left = "20px";
label.style.color = "white";
label.style.fontFamily = "monospace";
label.style.fontSize = "20px";
label.style.zIndex = "100";
container.appendChild(label);

//
// PARAMETRY
//

const SCALE = 1 / 10000000;
const SIMULATION_SPEED = 1.2;
const ORBIT_STRIDE = 5;

//
// TRAJEKTORIE
//

let earthTrack = [];
let marsTrack = [];

let earthOrbitLine = null;
let marsOrbitLine = null;

//
// STAN
//

let simulationIndex = 0;
let lastTime = performance.now();

function lerp(a, b, t) {
    return a + (b - a) * t;
}

//
// TRAJEKTORIE
//

async function loadTrajectory() {
    try {
        const response = await fetch(
            "http://localhost:5000/trajectory"
        );

        const data = await response.json();

        earthTrack = data.earth || [];
        marsTrack = data.mars || [];

        createOrbitLines();
        frameCamera();

    } catch (err) {
        console.error("Błąd trajektorii:", err);
    }
}

//
// ORBITY (FIX: brak akumulacji + cleanup)
//

function createOrbitLines() {
    const makePoints = (track) =>
        track
            .filter((_, i) => i % ORBIT_STRIDE === 0)
            .map(p =>
                new THREE.Vector3(
                    p.x * SCALE,
                    p.y * SCALE,
                    p.z * SCALE
                )
            );

    const marsPoints = makePoints(marsTrack);
    const earthPoints = makePoints(earthTrack);

    console.log("Mars first:", marsPoints[0]);
    console.log("Mars last:", marsPoints[marsPoints.length - 1]);
    console.log("Earth first:", earthPoints[0]);
    console.log("Earth last:", earthPoints[earthPoints.length - 1]);

    if (earthOrbitLine) {
        scene.remove(earthOrbitLine);
        earthOrbitLine.geometry.dispose();
        earthOrbitLine.material.dispose();
    }

    if (marsOrbitLine) {
        scene.remove(marsOrbitLine);
        marsOrbitLine.geometry.dispose();
        marsOrbitLine.material.dispose();
    }

    earthOrbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(makePoints(earthTrack)),
        new THREE.LineBasicMaterial({
            color: 0x3355ff,
            transparent: true,
            opacity: 0.22
        })
    );

    marsOrbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(makePoints(marsTrack)),
        new THREE.LineBasicMaterial({
            color: 0xff5533,
            transparent: true,
            opacity: 0.22
        })
    );

    scene.add(earthOrbitLine);
    scene.add(marsOrbitLine);
}

//
// CAMERA FIX (to był główny problem “kamera na dole”)
//

function frameCamera() {
    const box = new THREE.Box3();
    const temp = new THREE.Vector3();

    box.makeEmpty();

    for (let p of earthTrack) {
        box.expandByPoint(temp.set(p.x * SCALE, p.y * SCALE, p.z * SCALE));
    }
    for (let p of marsTrack) {
        box.expandByPoint(temp.set(p.x * SCALE, p.y * SCALE, p.z * SCALE));
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.6;

    camera.position.set(
        center.x,
        center.y + distance * 0.25,
        center.z + distance
    );

    camera.lookAt(center);
}

//
// ANIMACJA (FIX stabilności + brak “skoku” po czasie)
//

const distancePositions = new Float32Array(6);

distanceGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(distancePositions, 3)
);

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaMs = now - lastTime;

    if (deltaMs > 100) {
        lastTime = now;
        renderer.render(scene, camera);
        return;
    }

    const delta = deltaMs / 16.666;
    lastTime = now;

    if (earthTrack.length > 1 && marsTrack.length > 1) {
        simulationIndex += SIMULATION_SPEED * delta;

        const maxIndex = earthTrack.length - 2;

        if (simulationIndex >= maxIndex - 1) {
            simulationIndex = 0;
        }

        const i0 = Math.floor(simulationIndex);
        const i1 = i0 + 1;

        const t = simulationIndex - i0;

        const e0 = earthTrack[i0];
        const e1 = earthTrack[i1];
        const m0 = marsTrack[i0];
        const m1 = marsTrack[i1];

        earth.position.set(
            lerp(e0.x, e1.x, t) * SCALE,
            lerp(e0.y, e1.y, t) * SCALE,
            lerp(e0.z, e1.z, t) * SCALE
        );

        mars.position.set(
            lerp(m0.x, m1.x, t) * SCALE,
            lerp(m0.y, m1.y, t) * SCALE,
            lerp(m0.z, m1.z, t) * SCALE
        );

        // FIX: poprawne aktualizowanie linii bez artefaktów
        distancePositions[0] = earth.position.x;
        distancePositions[1] = earth.position.y;
        distancePositions[2] = earth.position.z;

        distancePositions[3] = mars.position.x;
        distancePositions[4] = mars.position.y;
        distancePositions[5] = mars.position.z;

        distanceGeometry.attributes.position.needsUpdate = true;

        const dx = mars.position.x - earth.position.x;
        const dy = mars.position.y - earth.position.y;
        const dz = mars.position.z - earth.position.z;

        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / SCALE;

        label.innerText =
            `ODLEGŁOŚĆ ZIEMIA → MARS\n\n${Math.round(distance).toLocaleString()} km`;

        earth.rotation.y += 0.01 * delta;
        mars.rotation.y += 0.008 * delta;
    }

    renderer.render(scene, camera);
}

//
// RESIZE FIX
//

window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

//
// START
//
loadTrajectory();
animate();