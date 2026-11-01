"""
Script tạo mô hình ONNX dummy với trọng số ngẫu nhiên.
MỤC ĐÍCH: Chỉ để kiểm tra đường ống (pipeline) inference client-side với onnxruntime-web.
KHÔNG BÁO CÁO NHƯ KẾT QUẢ HUẤN LUYỆN.
"""
import os
import json
import numpy as np
import onnx
from onnx import helper, TensorProto

def create_dummy_onnx_model(output_path: str, labels_path: str, seq_len: int = 30, feat_dim: int = 272):
    # Đọc số nhãn từ labels.json
    with open(labels_path, 'r', encoding='utf-8') as f:
        labels = json.load(f)
    num_classes = len(labels)
    print(f"Số lượng nhãn: {num_classes} ({[item['id'] for item in labels]})")

    # Tạo trọng số ngẫu nhiên (Linear projection: mean pooling thời gian -> Linear -> Softmax)
    np.random.seed(42)
    W_val = np.random.randn(feat_dim, num_classes).astype(np.float32) * 0.05
    b_val = np.zeros((num_classes,), dtype=np.float32)

    # Inputs & Outputs Definition
    # Input shape: [1, seq_len, feat_dim]
    input_tensor = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, seq_len, feat_dim])
    output_tensor = helper.make_tensor_value_info('probabilities', TensorProto.FLOAT, [1, num_classes])

    # Initializers (Weights & Biases)
    W_init = helper.make_tensor('W', TensorProto.FLOAT, [feat_dim, num_classes], W_val.flatten().tolist())
    b_init = helper.make_tensor('b', TensorProto.FLOAT, [num_classes], b_val.flatten().tolist())
    # Nodes:
    # 1. ReduceMean qua trục thời gian (seq_len, axis=1) -> [1, feat_dim]
    reduce_node = helper.make_node(
        'ReduceMean',
        inputs=['input'],
        outputs=['reduced_mean'],
        axes=[1],
        keepdims=0
    ) # outputs shape: [1, feat_dim]

    # 2. MatMul: [1, feat_dim] x [feat_dim, num_classes] -> [1, num_classes]
    matmul_node = helper.make_node(
        'MatMul',
        inputs=['reduced_mean', 'W'],
        outputs=['logits_raw']
    )

    # 3. Add: [1, num_classes] + [num_classes] -> [1, num_classes]
    add_node = helper.make_node(
        'Add',
        inputs=['logits_raw', 'b'],
        outputs=['logits']
    )

    # 4. Softmax: [1, num_classes] -> [1, num_classes]
    softmax_node = helper.make_node(
        'Softmax',
        inputs=['logits'],
        outputs=['probabilities'],
        axis=1
    )

    # Graph
    graph_def = helper.make_graph(
        nodes=[reduce_node, matmul_node, add_node, softmax_node],
        name='VSL_Dummy_Sequence_Model',
        inputs=[input_tensor],
        outputs=[output_tensor],
        initializer=[W_init, b_init]
    )

    # Model
    model_def = helper.make_model(graph_def, producer_name='AI4Life_VSL_Pipeline_Test')
    model_def.opset_import[0].version = 14
    # Khắc phục lỗi tương thích: onnxruntime-web (1.31.x) hỗ trợ tối đa IR version <= 13.
    # onnx 1.23.2 mặc định sinh IR version 14. Ta ghim ir_version = 10 (tương thích cao với onnxruntime-web).
    model_def.ir_version = 10

    onnx.checker.check_model(model_def)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    onnx.save(model_def, output_path)
    print(f"[OK] Đã xuất mô hình dummy ONNX thành công tới: {output_path}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_models_dir = os.path.join(base_dir, '..', 'web', 'public', 'models', 'dummy_model.onnx')
    labels_file = os.path.join(base_dir, '..', 'web', 'public', 'labels.json')
    create_dummy_onnx_model(web_models_dir, labels_file, seq_len=30, feat_dim=272)
