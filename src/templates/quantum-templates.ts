// Quantum Computing 분야 템플릿 - PennyLane 전용

export const QUANTUM_SETUP_CODE = `# 필요한 라이브러리 임포트
import numpy as np
import matplotlib.pyplot as plt

# PennyLane 임포트
import pennylane as qml
from pennylane import numpy as pnp
from pennylane.templates import AngleEmbedding, StronglyEntanglingLayers
from pennylane.optimize import AdamOptimizer, GradientDescentOptimizer

# 재현성을 위한 시드 고정
np.random.seed(42)
pnp.random.seed(42)

# 기본 디바이스 설정 (시뮬레이터)
n_qubits = 4
dev = qml.device('default.qubit', wires=n_qubits)

# 시각화 설정
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = [10, 6]
plt.rcParams['font.size'] = 12

print("PennyLane Quantum Computing Environment Ready!")
print(f"PennyLane version: {qml.__version__}")
print(f"Default device: {dev.name} with {n_qubits} qubits")`;

export const QUANTUM_DATA_TEMPLATES = {
  quantum_state: `# 양자 상태 생성 및 시각화 (PennyLane)
n_qubits = 2
dev = qml.device('default.qubit', wires=n_qubits)

@qml.qnode(dev)
def create_state(params):
    """파라미터화된 양자 상태 생성"""
    for i in range(n_qubits):
        qml.Hadamard(wires=i)
    for i in range(n_qubits):
        qml.RY(params[i], wires=i)
    return qml.state()

# 초기 상태 (params=0)
initial_params = np.zeros(n_qubits)
state = create_state(initial_params)
print("균등 중첩 상태 (Hadamard 적용 후):")
print(state)

# 상태 시각화 - 확률 분포
@qml.qnode(dev)
def measure_probs(params):
    for i in range(n_qubits):
        qml.Hadamard(wires=i)
    for i in range(n_qubits):
        qml.RY(params[i], wires=i)
    return qml.probs(wires=range(n_qubits))

probs = measure_probs(initial_params)
labels = [format(i, f'0{n_qubits}b') for i in range(2**n_qubits)]

plt.figure(figsize=(10, 5))
plt.bar(labels, probs, color='steelblue', edgecolor='black')
plt.xlabel('Basis State')
plt.ylabel('Probability')
plt.title('Quantum State Probability Distribution')
plt.show()`,

  bell_state: `# Bell State (얽힘 상태) 생성 - PennyLane
dev_bell = qml.device('default.qubit', wires=2, shots=1000)

@qml.qnode(dev_bell)
def bell_state_circuit():
    """Bell State 생성: |Φ+⟩ = (|00⟩ + |11⟩) / √2"""
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    return qml.sample(wires=[0, 1])

# 회로 시각화
print("Bell State Circuit:")
print(qml.draw(bell_state_circuit)())

# 측정 수행
samples = bell_state_circuit()

# 결과 집계
from collections import Counter
counts = Counter([tuple(s) for s in samples])
print("\\n측정 결과 (1000 shots):")
for state, count in sorted(counts.items()):
    print(f"  |{''.join(map(str, state))}⟩: {count} ({count/10:.1f}%)")

# 결과 시각화
labels = ['|00⟩', '|01⟩', '|10⟩', '|11⟩']
values = [counts.get((0,0), 0), counts.get((0,1), 0),
          counts.get((1,0), 0), counts.get((1,1), 0)]

plt.figure(figsize=(8, 5))
plt.bar(labels, values, color=['#2ecc71', '#e74c3c', '#e74c3c', '#2ecc71'],
        edgecolor='black')
plt.xlabel('Measurement Outcome')
plt.ylabel('Counts')
plt.title('Bell State Measurement Results\\n(Only |00⟩ and |11⟩ should appear)')
plt.show()`,

  variational: `# Variational Quantum Circuit을 위한 데이터 준비 - PennyLane
from sklearn.datasets import make_moons
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler

# 데이터셋 생성
X, y = make_moons(n_samples=200, noise=0.1, random_state=42)

# 데이터 정규화 (0, π) 범위로
scaler = MinMaxScaler(feature_range=(0, np.pi))
X_scaled = scaler.fit_transform(X)

# 학습/테스트 분할
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.25, random_state=42
)

print(f"Training data shape: {X_train.shape}")
print(f"Test data shape: {X_test.shape}")
print(f"Labels: {np.unique(y)}")

# 데이터 시각화
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 원본 데이터
axes[0].scatter(X[:, 0], X[:, 1], c=y, cmap='coolwarm', edgecolors='black')
axes[0].set_xlabel('Feature 1')
axes[0].set_ylabel('Feature 2')
axes[0].set_title('Original Data')

# 정규화된 데이터
axes[1].scatter(X_scaled[:, 0], X_scaled[:, 1], c=y, cmap='coolwarm', edgecolors='black')
axes[1].set_xlabel('Feature 1 (normalized)')
axes[1].set_ylabel('Feature 2 (normalized)')
axes[1].set_title('Normalized Data (for Quantum Encoding)')

plt.tight_layout()
plt.show()`,

  qubo: `# QUBO 문제를 위한 그래프 설정 - PennyLane
import networkx as nx

# 4노드 그래프 정의 (Max-Cut 문제)
edges = [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3)]
G = nx.Graph(edges)

print("Graph edges:", edges)
print(f"Number of nodes: {G.number_of_nodes()}")
print(f"Number of edges: {G.number_of_edges()}")

# 그래프 시각화
pos = nx.spring_layout(G, seed=42)

plt.figure(figsize=(8, 6))
nx.draw(G, pos, with_labels=True, node_color='lightblue',
        node_size=700, font_size=16, font_weight='bold',
        edge_color='gray', width=2)
plt.title('Graph for Max-Cut Problem')
plt.show()

# QAOA를 위한 Cost Hamiltonian 정의
def cost_hamiltonian(graph):
    """Max-Cut 비용 해밀토니안 생성"""
    coeffs = []
    obs = []
    for edge in graph.edges():
        coeffs.append(0.5)
        obs.append(qml.PauliZ(edge[0]) @ qml.PauliZ(edge[1]))
    return qml.Hamiltonian(coeffs, obs)

H_cost = cost_hamiltonian(G)
print("\\nCost Hamiltonian:")
print(H_cost)`,
};

export const QUANTUM_COMMON_PATTERNS = {
  basic_gates: `# 기본 양자 게이트 시각화 - PennyLane
dev_single = qml.device('default.qubit', wires=1)

def visualize_gate_effect(gate_name, gate_fn):
    """게이트 효과를 Bloch 구면에서 시각화"""

    @qml.qnode(dev_single)
    def circuit():
        gate_fn(wires=0)
        return qml.state()

    state = circuit()

    # 상태를 Bloch 구면 좌표로 변환
    alpha, beta = state[0], state[1]

    # Bloch vector 계산
    x = 2 * np.real(np.conj(alpha) * beta)
    y = 2 * np.imag(np.conj(alpha) * beta)
    z = np.abs(alpha)**2 - np.abs(beta)**2

    return gate_name, (x, y, z)

# 다양한 게이트 테스트
gates = [
    ('|0⟩ (Initial)', lambda wires: None),
    ('X gate', qml.PauliX),
    ('Y gate', qml.PauliY),
    ('Z gate', qml.PauliZ),
    ('H gate', qml.Hadamard),
    ('S gate', qml.S),
    ('T gate', qml.T),
]

# 결과 시각화
fig = plt.figure(figsize=(15, 5))
for i, (name, gate) in enumerate(gates):
    ax = fig.add_subplot(1, len(gates), i+1, projection='3d')

    # Bloch 구면 그리기
    u = np.linspace(0, 2 * np.pi, 50)
    v = np.linspace(0, np.pi, 50)
    x_sphere = np.outer(np.cos(u), np.sin(v))
    y_sphere = np.outer(np.sin(u), np.sin(v))
    z_sphere = np.outer(np.ones(np.size(u)), np.cos(v))
    ax.plot_surface(x_sphere, y_sphere, z_sphere, alpha=0.1, color='gray')

    # 상태 벡터 표시
    _, bloch = visualize_gate_effect(name, gate)
    ax.quiver(0, 0, 0, bloch[0], bloch[1], bloch[2],
              color='red', arrow_length_ratio=0.1, linewidth=2)

    ax.set_title(name, fontsize=10)
    ax.set_xlim([-1, 1])
    ax.set_ylim([-1, 1])
    ax.set_zlim([-1, 1])

plt.tight_layout()
plt.show()

# 게이트 회로 표시
@qml.qnode(dev_single)
def all_gates():
    qml.Hadamard(wires=0)
    qml.PauliX(wires=0)
    qml.RY(0.5, wires=0)
    qml.PauliZ(wires=0)
    return qml.expval(qml.PauliZ(0))

print("\\n예시 회로:")
print(qml.draw(all_gates)())`,

  vqe: `# Variational Quantum Eigensolver (VQE) - PennyLane
from pennylane import numpy as pnp

# 간단한 분자 해밀토니안 (H2 분자 근사)
coeffs = [-0.5, 0.5, -0.5, 0.5]
obs = [
    qml.Identity(0) @ qml.Identity(1),
    qml.PauliZ(0) @ qml.Identity(1),
    qml.Identity(0) @ qml.PauliZ(1),
    qml.PauliZ(0) @ qml.PauliZ(1)
]
H = qml.Hamiltonian(coeffs, obs)
print("Hamiltonian:")
print(H)

# VQE 회로 정의
n_qubits = 2
n_layers = 2
dev_vqe = qml.device('default.qubit', wires=n_qubits)

@qml.qnode(dev_vqe)
def vqe_circuit(params):
    """Variational ansatz for VQE"""
    # 초기 상태 준비
    for i in range(n_qubits):
        qml.Hadamard(wires=i)

    # 파라미터화된 레이어
    for layer in range(n_layers):
        for i in range(n_qubits):
            qml.RY(params[layer, i, 0], wires=i)
            qml.RZ(params[layer, i, 1], wires=i)
        # 얽힘 레이어
        for i in range(n_qubits - 1):
            qml.CNOT(wires=[i, i+1])

    return qml.expval(H)

# 파라미터 초기화
shape = (n_layers, n_qubits, 2)
init_params = pnp.random.uniform(0, 2*np.pi, shape, requires_grad=True)

print("\\nVQE Circuit:")
print(qml.draw(vqe_circuit)(init_params))

# 최적화
opt = AdamOptimizer(stepsize=0.1)
params = init_params.copy()
energies = []

print("\\nOptimization:")
for step in range(100):
    params, energy = opt.step_and_cost(vqe_circuit, params)
    energies.append(energy)
    if step % 20 == 0:
        print(f"Step {step:3d}: Energy = {energy:.6f}")

print(f"\\nFinal Energy: {energies[-1]:.6f}")
print(f"Exact ground state energy: {min(np.linalg.eigvalsh(qml.matrix(H))):.6f}")

# 수렴 그래프
plt.figure(figsize=(10, 5))
plt.plot(energies, 'b-', linewidth=2)
plt.axhline(y=min(np.linalg.eigvalsh(qml.matrix(H))), color='r',
            linestyle='--', label='Exact ground state')
plt.xlabel('Optimization Step')
plt.ylabel('Energy')
plt.title('VQE Convergence')
plt.legend()
plt.grid(True)
plt.show()`,

  qml_classifier: `# 양자 분류기 (Quantum Classifier) - PennyLane
from sklearn.datasets import make_moons
from sklearn.model_selection import train_test_split

# 데이터 준비
X, y = make_moons(n_samples=200, noise=0.1, random_state=42)
y = 2 * y - 1  # {0, 1} -> {-1, 1}

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42
)

# 데이터 정규화
X_train = np.pi * (X_train - X_train.min()) / (X_train.max() - X_train.min())
X_test = np.pi * (X_test - X_test.min()) / (X_test.max() - X_test.min())

# 양자 분류기 정의
n_qubits = 2
n_layers = 3
dev_clf = qml.device('default.qubit', wires=n_qubits)

@qml.qnode(dev_clf)
def quantum_classifier(inputs, weights):
    """양자 분류 회로"""
    # 입력 인코딩 (Angle Embedding)
    for i in range(n_qubits):
        qml.RY(inputs[i], wires=i)

    # 파라미터화된 레이어
    for layer_weights in weights:
        for i in range(n_qubits):
            qml.RY(layer_weights[i, 0], wires=i)
            qml.RZ(layer_weights[i, 1], wires=i)
        qml.CNOT(wires=[0, 1])

    # 측정
    return qml.expval(qml.PauliZ(0))

# 비용 함수 정의
def cost(weights, X, y):
    predictions = np.array([quantum_classifier(x, weights) for x in X])
    return np.mean((predictions - y) ** 2)

def accuracy(weights, X, y):
    predictions = np.array([quantum_classifier(x, weights) for x in X])
    predicted_labels = np.sign(predictions)
    return np.mean(predicted_labels == y)

# 파라미터 초기화
weights_shape = (n_layers, n_qubits, 2)
weights = pnp.random.uniform(-np.pi, np.pi, weights_shape, requires_grad=True)

print("Quantum Classifier Circuit:")
print(qml.draw(quantum_classifier)(X_train[0], weights))

# 학습
opt = AdamOptimizer(stepsize=0.1)
batch_size = 20
costs = []
train_accs = []
test_accs = []

print("\\nTraining:")
for epoch in range(50):
    # 미니배치 선택
    batch_idx = np.random.choice(len(X_train), batch_size)
    X_batch = X_train[batch_idx]
    y_batch = y_train[batch_idx]

    # 최적화 스텝
    weights, c = opt.step_and_cost(lambda w: cost(w, X_batch, y_batch), weights)
    costs.append(c)

    if epoch % 10 == 0:
        train_acc = accuracy(weights, X_train, y_train)
        test_acc = accuracy(weights, X_test, y_test)
        train_accs.append(train_acc)
        test_accs.append(test_acc)
        print(f"Epoch {epoch:3d}: Cost = {c:.4f}, Train Acc = {train_acc:.2%}, Test Acc = {test_acc:.2%}")

# 최종 정확도
final_train_acc = accuracy(weights, X_train, y_train)
final_test_acc = accuracy(weights, X_test, y_test)
print(f"\\nFinal Train Accuracy: {final_train_acc:.2%}")
print(f"Final Test Accuracy: {final_test_acc:.2%}")

# 결과 시각화
fig, axes = plt.subplots(1, 3, figsize=(15, 4))

# Cost 그래프
axes[0].plot(costs, 'b-', linewidth=1)
axes[0].set_xlabel('Iteration')
axes[0].set_ylabel('Cost')
axes[0].set_title('Training Cost')

# 결정 경계
xx, yy = np.meshgrid(np.linspace(0, np.pi, 50), np.linspace(0, np.pi, 50))
grid = np.c_[xx.ravel(), yy.ravel()]
predictions = np.array([quantum_classifier(x, weights) for x in grid])
predictions = predictions.reshape(xx.shape)

axes[1].contourf(xx, yy, predictions, levels=20, cmap='coolwarm', alpha=0.8)
axes[1].scatter(X_test[:, 0], X_test[:, 1], c=y_test, cmap='coolwarm',
                edgecolors='black', s=50)
axes[1].set_xlabel('Feature 1')
axes[1].set_ylabel('Feature 2')
axes[1].set_title('Decision Boundary')

# 정확도 그래프
epochs_recorded = list(range(0, 50, 10))
axes[2].plot(epochs_recorded, train_accs, 'b-o', label='Train')
axes[2].plot(epochs_recorded, test_accs, 'r-s', label='Test')
axes[2].set_xlabel('Epoch')
axes[2].set_ylabel('Accuracy')
axes[2].set_title('Accuracy over Training')
axes[2].legend()

plt.tight_layout()
plt.show()`,

  qaoa: `# QAOA (Quantum Approximate Optimization Algorithm) - PennyLane
import networkx as nx

# Max-Cut 문제 정의
edges = [(0, 1), (0, 3), (1, 2), (2, 3)]
graph = nx.Graph(edges)
n_qubits = 4

dev_qaoa = qml.device('default.qubit', wires=n_qubits)

# Cost Hamiltonian (Max-Cut)
def cost_layer(gamma):
    for edge in graph.edges():
        qml.CNOT(wires=edge)
        qml.RZ(gamma, wires=edge[1])
        qml.CNOT(wires=edge)

# Mixer Hamiltonian
def mixer_layer(beta):
    for wire in range(n_qubits):
        qml.RX(2 * beta, wires=wire)

@qml.qnode(dev_qaoa)
def qaoa_circuit(gammas, betas):
    """QAOA 회로"""
    # 초기 상태: |+⟩^n
    for wire in range(n_qubits):
        qml.Hadamard(wires=wire)

    # QAOA 레이어
    for gamma, beta in zip(gammas, betas):
        cost_layer(gamma)
        mixer_layer(beta)

    # Max-Cut 비용 측정
    return qml.expval(sum(0.5 * (1 - qml.PauliZ(i) @ qml.PauliZ(j))
                         for i, j in graph.edges()))

# 파라미터 초기화
n_layers = 2
gammas = pnp.random.uniform(0, 2*np.pi, n_layers, requires_grad=True)
betas = pnp.random.uniform(0, np.pi, n_layers, requires_grad=True)

print("QAOA Circuit:")
print(qml.draw(qaoa_circuit)(gammas, betas))

# 최적화
opt = AdamOptimizer(stepsize=0.1)
params = (gammas, betas)
costs = []

print("\\nOptimization:")
for step in range(100):
    params, cost = opt.step_and_cost(lambda p: -qaoa_circuit(p[0], p[1]), params)
    costs.append(-cost)
    if step % 20 == 0:
        print(f"Step {step:3d}: Max-Cut Value = {-cost:.4f}")

print(f"\\nOptimal Max-Cut Value: {costs[-1]:.4f}")

# 최적 해 샘플링
dev_sample = qml.device('default.qubit', wires=n_qubits, shots=1000)

@qml.qnode(dev_sample)
def sample_qaoa(gammas, betas):
    for wire in range(n_qubits):
        qml.Hadamard(wires=wire)
    for gamma, beta in zip(gammas, betas):
        cost_layer(gamma)
        mixer_layer(beta)
    return qml.sample(wires=range(n_qubits))

samples = sample_qaoa(params[0], params[1])

# 결과 분석
from collections import Counter
bitstrings = [''.join(map(str, s)) for s in samples]
counts = Counter(bitstrings)
print("\\nTop 5 solutions:")
for bitstring, count in counts.most_common(5):
    cut_value = sum(1 for i, j in graph.edges() if bitstring[i] != bitstring[j])
    print(f"  {bitstring}: count={count}, cut value={cut_value}")

# 시각화
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 수렴 그래프
axes[0].plot(costs, 'b-', linewidth=2)
axes[0].set_xlabel('Optimization Step')
axes[0].set_ylabel('Max-Cut Value')
axes[0].set_title('QAOA Convergence')
axes[0].grid(True)

# 그래프와 최적 해
best_solution = counts.most_common(1)[0][0]
colors = ['#e74c3c' if bit == '1' else '#3498db' for bit in best_solution]
pos = nx.spring_layout(graph, seed=42)

nx.draw(graph, pos, ax=axes[1], with_labels=True, node_color=colors,
        node_size=700, font_size=14, font_weight='bold',
        edge_color='gray', width=2)
axes[1].set_title(f'Best Solution: {best_solution}\\n(Red and Blue are different partitions)')

plt.tight_layout()
plt.show()`,
};

export const QUANTUM_VISUALIZATION = {
  circuit: `# 양자 회로 시각화 - PennyLane
@qml.qnode(dev)
def example_circuit(params):
    qml.RX(params[0], wires=0)
    qml.RY(params[1], wires=1)
    qml.CNOT(wires=[0, 1])
    qml.RZ(params[2], wires=1)
    return qml.expval(qml.PauliZ(0))

params = [0.5, 0.3, 0.7]
print("Circuit Diagram:")
print(qml.draw(example_circuit)(params))
print("\\nCircuit (Matplotlib):")
fig, ax = qml.draw_mpl(example_circuit)(params)
plt.show()`,

  bloch: `# Bloch 구면 시각화
def plot_bloch_vector(theta, phi, ax=None):
    """단일 큐비트 상태를 Bloch 구면에 시각화"""
    if ax is None:
        fig = plt.figure(figsize=(8, 8))
        ax = fig.add_subplot(111, projection='3d')

    # Bloch 구면
    u = np.linspace(0, 2 * np.pi, 50)
    v = np.linspace(0, np.pi, 50)
    x = np.outer(np.cos(u), np.sin(v))
    y = np.outer(np.sin(u), np.sin(v))
    z = np.outer(np.ones(np.size(u)), np.cos(v))
    ax.plot_surface(x, y, z, alpha=0.1, color='gray')

    # 축
    ax.quiver(0, 0, 0, 1.5, 0, 0, color='r', arrow_length_ratio=0.1)
    ax.quiver(0, 0, 0, 0, 1.5, 0, color='g', arrow_length_ratio=0.1)
    ax.quiver(0, 0, 0, 0, 0, 1.5, color='b', arrow_length_ratio=0.1)
    ax.text(1.6, 0, 0, 'X', fontsize=12)
    ax.text(0, 1.6, 0, 'Y', fontsize=12)
    ax.text(0, 0, 1.6, 'Z', fontsize=12)

    # 상태 벡터
    bx = np.sin(theta) * np.cos(phi)
    by = np.sin(theta) * np.sin(phi)
    bz = np.cos(theta)
    ax.quiver(0, 0, 0, bx, by, bz, color='purple',
              arrow_length_ratio=0.1, linewidth=3)

    ax.set_xlim([-1.5, 1.5])
    ax.set_ylim([-1.5, 1.5])
    ax.set_zlim([-1.5, 1.5])
    ax.set_title(f'θ={theta:.2f}, φ={phi:.2f}')

    return ax

# 다양한 상태 시각화
fig = plt.figure(figsize=(15, 5))
states = [(0, 0), (np.pi/2, 0), (np.pi/2, np.pi/2), (np.pi/4, np.pi/4)]
titles = ['|0⟩', '|+⟩', '|+i⟩', 'Superposition']

for i, (theta, phi) in enumerate(states):
    ax = fig.add_subplot(1, 4, i+1, projection='3d')
    plot_bloch_vector(theta, phi, ax)
    ax.set_title(titles[i])

plt.tight_layout()
plt.show()`,

  measurement: `# 측정 결과 시각화 - PennyLane
dev_shots = qml.device('default.qubit', wires=3, shots=1000)

@qml.qnode(dev_shots)
def ghz_state():
    """GHZ 상태 생성 및 측정"""
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    qml.CNOT(wires=[1, 2])
    return qml.sample(wires=[0, 1, 2])

samples = ghz_state()

# 결과 집계
from collections import Counter
bitstrings = [''.join(map(str, s)) for s in samples]
counts = Counter(bitstrings)

# 시각화
labels = sorted(counts.keys())
values = [counts[l] for l in labels]

plt.figure(figsize=(10, 5))
colors = ['#2ecc71' if l in ['000', '111'] else '#e74c3c' for l in labels]
plt.bar(labels, values, color=colors, edgecolor='black')
plt.xlabel('Measurement Outcome')
plt.ylabel('Counts')
plt.title('GHZ State Measurements\\n(Green: Expected, Red: Unexpected)')
plt.show()`,

  expectation_landscape: `# 기대값 지형 시각화 (VQE용) - PennyLane
dev_landscape = qml.device('default.qubit', wires=1)

@qml.qnode(dev_landscape)
def simple_circuit(params):
    qml.RY(params[0], wires=0)
    qml.RZ(params[1], wires=0)
    return qml.expval(qml.PauliZ(0))

# 파라미터 공간 탐색
theta_range = np.linspace(0, 2*np.pi, 50)
phi_range = np.linspace(0, 2*np.pi, 50)
theta_grid, phi_grid = np.meshgrid(theta_range, phi_range)

# 기대값 계산
Z = np.zeros_like(theta_grid)
for i in range(len(theta_range)):
    for j in range(len(phi_range)):
        Z[i, j] = simple_circuit([theta_grid[i, j], phi_grid[i, j]])

# 3D 시각화
fig = plt.figure(figsize=(14, 5))

# 3D 표면
ax1 = fig.add_subplot(121, projection='3d')
ax1.plot_surface(theta_grid, phi_grid, Z, cmap='viridis', alpha=0.8)
ax1.set_xlabel('θ (RY)')
ax1.set_ylabel('φ (RZ)')
ax1.set_zlabel('⟨Z⟩')
ax1.set_title('Expectation Value Landscape (3D)')

# 2D 컨투어
ax2 = fig.add_subplot(122)
contour = ax2.contourf(theta_grid, phi_grid, Z, levels=30, cmap='viridis')
plt.colorbar(contour, ax=ax2, label='⟨Z⟩')
ax2.set_xlabel('θ (RY)')
ax2.set_ylabel('φ (RZ)')
ax2.set_title('Expectation Value Landscape (2D)')

plt.tight_layout()
plt.show()`,
};
