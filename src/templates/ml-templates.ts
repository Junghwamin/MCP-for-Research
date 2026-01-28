// Machine Learning 분야 템플릿

export const ML_SETUP_CODE = `# 필요한 라이브러리 임포트
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib.pyplot as plt
from typing import Optional, Tuple, List

# 재현성을 위한 시드 고정
np.random.seed(42)
torch.manual_seed(42)

# GPU 사용 가능 여부 확인
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# 시각화 설정
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = [10, 6]
plt.rcParams['font.size'] = 12`;

export const ML_DATA_TEMPLATES = {
  classification: `# 분류 문제를 위한 예시 데이터 생성
from sklearn.datasets import make_moons, make_circles

# 비선형 분류 데이터 생성
X, y = make_moons(n_samples=200, noise=0.1, random_state=42)
X = torch.FloatTensor(X)
y = torch.LongTensor(y)

print(f"Data shape: {X.shape}")
print(f"Labels: {torch.unique(y)}")

# 데이터 시각화
plt.figure(figsize=(8, 6))
plt.scatter(X[:, 0], X[:, 1], c=y, cmap='coolwarm', edgecolors='black')
plt.xlabel('Feature 1')
plt.ylabel('Feature 2')
plt.title('Classification Dataset')
plt.colorbar(label='Class')
plt.show()`,

  regression: `# 회귀 문제를 위한 예시 데이터 생성
X = torch.linspace(-5, 5, 100).unsqueeze(1)
y = torch.sin(X) + 0.1 * torch.randn_like(X)  # sin + noise

print(f"X shape: {X.shape}")
print(f"y shape: {y.shape}")

# 데이터 시각화
plt.figure(figsize=(8, 6))
plt.scatter(X.numpy(), y.numpy(), alpha=0.7, label='Data')
plt.plot(X.numpy(), np.sin(X.numpy()), 'r-', label='True function', linewidth=2)
plt.xlabel('X')
plt.ylabel('y')
plt.title('Regression Dataset')
plt.legend()
plt.show()`,

  sequence: `# 시퀀스 데이터를 위한 예시 생성
seq_length = 50
batch_size = 32
d_model = 64

# 랜덤 시퀀스 생성
X = torch.randn(batch_size, seq_length, d_model)

# Attention mask (패딩 마스크 예시)
attention_mask = torch.ones(batch_size, seq_length)

print(f"Sequence shape: {X.shape}")
print(f"Mask shape: {attention_mask.shape}")

# 시퀀스 시각화 (첫 번째 샘플)
plt.figure(figsize=(12, 4))
plt.imshow(X[0].numpy().T, aspect='auto', cmap='viridis')
plt.xlabel('Position')
plt.ylabel('Dimension')
plt.title('Sequence Visualization (First Sample)')
plt.colorbar(label='Value')
plt.show()`,

  image: `# 이미지 데이터를 위한 예시 생성
batch_size = 16
channels = 3
height, width = 32, 32

# 랜덤 이미지 생성 (CIFAR-10 스타일)
images = torch.randn(batch_size, channels, height, width)

# 정규화
images = (images - images.min()) / (images.max() - images.min())

print(f"Image batch shape: {images.shape}")

# 일부 이미지 시각화
fig, axes = plt.subplots(2, 4, figsize=(12, 6))
for i, ax in enumerate(axes.flat):
    if i < batch_size:
        img = images[i].permute(1, 2, 0).numpy()
        ax.imshow(img)
        ax.axis('off')
        ax.set_title(f'Sample {i+1}')
plt.suptitle('Sample Images')
plt.tight_layout()
plt.show()`,
};

export const ML_COMMON_PATTERNS = {
  attention: `# Self-Attention 구현
class SelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0

        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size, seq_len, _ = x.shape

        # Query, Key, Value 계산
        Q = self.W_q(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        K = self.W_k(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        V = self.W_v(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)

        # Attention Score 계산
        scores = torch.matmul(Q, K.transpose(-2, -1)) / np.sqrt(self.d_k)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attention_weights = F.softmax(scores, dim=-1)

        # Output 계산
        context = torch.matmul(attention_weights, V)
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, self.d_model)
        output = self.W_o(context)

        return output, attention_weights`,

  mlp: `# Multi-Layer Perceptron (MLP) 구현
class MLP(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, output_dim: int, dropout: float = 0.1):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, output_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)`,

  training_loop: `# 학습 루프
def train_model(model, train_loader, optimizer, criterion, epochs=10):
    model.train()
    history = {'loss': [], 'accuracy': []}

    for epoch in range(epochs):
        total_loss = 0
        correct = 0
        total = 0

        for batch_idx, (data, target) in enumerate(train_loader):
            data, target = data.to(device), target.to(device)

            optimizer.zero_grad()
            output = model(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            pred = output.argmax(dim=1)
            correct += (pred == target).sum().item()
            total += target.size(0)

        avg_loss = total_loss / len(train_loader)
        accuracy = 100 * correct / total
        history['loss'].append(avg_loss)
        history['accuracy'].append(accuracy)

        print(f'Epoch {epoch+1}/{epochs}: Loss = {avg_loss:.4f}, Accuracy = {accuracy:.2f}%')

    return history`,
};

export const ML_VISUALIZATION = {
  attention_heatmap: `# Attention Heatmap 시각화
def plot_attention_heatmap(attention_weights, tokens=None):
    """
    attention_weights: [seq_len, seq_len] 형태의 어텐션 가중치
    tokens: 시퀀스의 토큰 리스트 (옵션)
    """
    plt.figure(figsize=(10, 8))
    plt.imshow(attention_weights, cmap='Blues', aspect='auto')

    if tokens is not None:
        plt.xticks(range(len(tokens)), tokens, rotation=45, ha='right')
        plt.yticks(range(len(tokens)), tokens)

    plt.xlabel('Key Position')
    plt.ylabel('Query Position')
    plt.title('Attention Weights')
    plt.colorbar(label='Attention Weight')
    plt.tight_layout()
    plt.show()`,

  loss_curve: `# 학습 곡선 시각화
def plot_training_curves(history):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Loss 곡선
    ax1.plot(history['loss'], 'b-', linewidth=2)
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.set_title('Training Loss')
    ax1.grid(True)

    # Accuracy 곡선
    ax2.plot(history['accuracy'], 'g-', linewidth=2)
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy (%)')
    ax2.set_title('Training Accuracy')
    ax2.grid(True)

    plt.tight_layout()
    plt.show()`,

  embedding_tsne: `# t-SNE를 이용한 임베딩 시각화
from sklearn.manifold import TSNE

def plot_embeddings(embeddings, labels):
    """
    embeddings: [n_samples, embedding_dim] 형태
    labels: [n_samples] 형태의 레이블
    """
    # t-SNE 적용
    tsne = TSNE(n_components=2, random_state=42, perplexity=30)
    embeddings_2d = tsne.fit_transform(embeddings)

    # 시각화
    plt.figure(figsize=(10, 8))
    scatter = plt.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1],
                         c=labels, cmap='tab10', alpha=0.7, edgecolors='black')
    plt.colorbar(scatter, label='Class')
    plt.xlabel('t-SNE Dimension 1')
    plt.ylabel('t-SNE Dimension 2')
    plt.title('Embedding Visualization (t-SNE)')
    plt.show()`,
};
