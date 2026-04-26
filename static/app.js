import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e1e);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
});
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1));
const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(1, 1, 2);
scene.add(light);

let headMesh = null;
let modelRoot = null;
let targetInfluences = {};

let currentEmotion = "Нейтральна";
let baseIntensity = 0;

// ЗАВАНТАЖЕННЯ МОДЕЛІ
const loader = new GLTFLoader();
loader.load('/static/model_facs.glb', (gltf) => {
    modelRoot = gltf.scene;

    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    modelRoot.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(0, 0, maxDim * 1.2);

    scene.add(modelRoot);

    modelRoot.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {
            headMesh = child;
            for (const key in headMesh.morphTargetDictionary) {
                targetInfluences[key] = 0;
            }
        }
    });
});

// АНІМАЦІЯ
function animate() {
    requestAnimationFrame(animate);

    if (headMesh) {
        for (const key in headMesh.morphTargetDictionary) {
            const i = headMesh.morphTargetDictionary[key];
            const target = targetInfluences[key] || 0;
            const current = headMesh.morphTargetInfluences[i];

            headMesh.morphTargetInfluences[i] += (target - current) * 0.1;
        }
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}
animate();

// ОНОВЛЕННЯ ЗНАЧЕНЬ ЕМОЦІЇ
function updateMorphs() {
    const sliderValue = parseFloat(document.getElementById('intensitySlider').value);

    for (const k in targetInfluences) {
        if (currentEmotion === "Нейтральна") {
            targetInfluences[k] = 0;
        } else {
            targetInfluences[k] = (k === currentEmotion) ? (baseIntensity * sliderValue) : 0;
        }
    }
}

// ВСТАНОВЛЕННЯ НОВОЇ ЕМОЦІЇ
window.setEmotion = function(name, val) {
    if (!headMesh) return;

    currentEmotion = name;
    baseIntensity = val;

    document.getElementById('intensitySlider').value = 1;
    updateMorphs();

    if (name === "Нейтральна") {
        setStatus("😐 Нейтральна");
    } else {
        setStatus(name);
    }
}

document.getElementById('intensitySlider').addEventListener('input', () => {
    if (currentEmotion !== "Нейтральна") {
        updateMorphs();
    }
});

// ЗАВАНТАЖЕННЯ JSON ТА ХРЕСТИК
const jsonInput = document.getElementById('jsonInput');
const fileNameSpan = document.getElementById('fileName');
const clearJsonBtn = document.getElementById('clearJsonBtn');

jsonInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    // Оновлюємо текст кнопки і показуємо хрестик
    fileNameSpan.innerText = '📄 ' + f.name;
    clearJsonBtn.style.display = 'block';

    const fd = new FormData();
    fd.append("file", f);

    try {
        const res = await fetch('/analyze', { method: 'POST', body: fd });
        const data = await res.json();
        setEmotion(data.emotion, data.intensity);
    } catch (error) {
        setStatus("❌ Помилка аналізу");
        console.error(error);
    }
});

// Клік по хрестику (очищення файлу)
clearJsonBtn.addEventListener('click', () => {
    jsonInput.value = ""; // Очищаємо input
    fileNameSpan.innerText = '📁 Вибрати файл...'; // Повертаємо старий текст
    clearJsonBtn.style.display = 'none'; // Ховаємо хрестик
    setEmotion('Нейтральна', 0); // Скидаємо емоцію аватара
});

// ПЕРЕМИКАННЯ ТЕМИ
document.getElementById('themeSelect').onchange = (e) => {
    const theme = e.target.value;
    document.body.className = theme;

    if (theme === "light") {
        scene.background = new THREE.Color(0xffffff);
    } else {
        scene.background = new THREE.Color(0x1e1e1e);
    }
};

// СТАТУС
function setStatus(text) {
    document.getElementById('status').innerText = text;
}

// ЗБЕРЕЖЕННЯ PNG З ПРАВИЛЬНОЮ НАЗВОЮ
document.getElementById('downloadPNG').onclick = () => {
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL("image/png");

    // Беремо назву з нашої змінної currentEmotion
    a.download = `${currentEmotion}.png`;
    a.click();
};