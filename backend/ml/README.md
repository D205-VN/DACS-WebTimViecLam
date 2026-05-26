# APTCV Local Model

This folder contains a small decoder-only Transformer for CV generation.

## Pipeline

Run from `backend/ml`:

```bash
python3 prepare_cv_data.py
python3 train_tokenizer.py --vocab_size 4096 data/pretrain_corpus.txt
python3 pretrain.py \
  --data_path data/pretrain_corpus.txt \
  --max_steps 2000 \
  --batch_size 4 \
  --gradient_accumulation 4
python3 finetune_cv.py \
  --pretrained_path checkpoints/latest.pt \
  --num_epochs 10 \
  --batch_size 4
python3 serve.py \
  --model models/aptcv_cv_best.pt \
  --tokenizer tokenizer/aptcv_tokenizer.json \
  --port 8000
```

Point the Node backend at this server with:

```env
AI_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://127.0.0.1:8000/v1
LMSTUDIO_MODEL=aptcv-model
```

For a fast sanity check on a laptop:

```bash
python3 pretrain.py \
  --data_path data/pretrain_corpus.txt \
  --max_steps 2 \
  --warmup_steps 0 \
  --batch_size 1 \
  --gradient_accumulation 1 \
  --hidden_dim 64 \
  --num_layers 2 \
  --num_heads 4 \
  --ffn_dim 256 \
  --max_seq_len 128 \
  --log_interval 1 \
  --save_interval 2 \
  --num_workers 0 \
  --device cpu \
  --checkpoint_dir checkpoints/smoke
python3 finetune_cv.py \
  --pretrained_path checkpoints/smoke/latest.pt \
  --num_epochs 1 \
  --batch_size 2 \
  --max_samples 24 \
  --num_workers 0 \
  --device cpu \
  --output_dir models/smoke
```

The smoke model only proves that the code path works. Use the full pipeline,
more data, and a GPU for useful generation quality.
