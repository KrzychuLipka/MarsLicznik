const T_E = 365;
const T_M = 687;
const R_E = 1.0;
const R_M = 1.52;

let t = 0;

const container = document.getElementById("mars-distance-widget");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(0, 8, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 1.5);
scene.add(light);

const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
scene.add(sun);

const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 32, 32),
    new THREE.MeshPhongMaterial({ color: 0x3366ff })
);
scene.add(earth);

const mars = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 32, 32),
    new THREE.MeshPhongMaterial({ color: 0xff5533 })
);
scene.add(mars);

function addOrbit(r, color) {
    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(r * Math.cos(a), r * Math.sin(a), 0);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color })));
}

addOrbit(R_E, 0x3333ff);
addOrbit(R_M, 0xff3333);

function animate() {
    requestAnimationFrame(animate);

    t += 0.4;

    const aE = (2 * Math.PI * t) / T_E;
    const aM = (2 * Math.PI * t) / T_M;

    earth.position.set(R_E * Math.cos(aE), R_E * Math.sin(aE), 0);
    mars.position.set(R_M * Math.cos(aM), R_M * Math.sin(aM), 0);

    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
}

animate();
