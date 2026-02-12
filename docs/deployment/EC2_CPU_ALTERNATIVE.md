# EC2 CPU-only alternative (no GPU)

Use this when you **don’t want a GPU** and are fine running embeddings and matching on CPU. The app is tuned for **up to ~20 users** and runs on a single CPU instance.

## Recommended instances (up to ~20 users)

| Type            | vCPU | RAM   | Use case              | Approx. cost (on-demand) |
|-----------------|------|-------|------------------------|---------------------------|
| **m6i.2xlarge** | 8    | 32 GB | **Recommended** – steady CPU | ~\$0.384/hr               |
| **t3.2xlarge**  | 8    | 32 GB | Lower cost, burstable CPU    | ~\$0.333/hr               |
| **m6i.xlarge**  | 4    | 16 GB | Lighter load (~10 users)     | ~\$0.192/hr               |

- **m6i.2xlarge**: best default for “prod can handle 20 users easily” on CPU.
- **t3.2xlarge**: cheaper; ensure sufficient CPU credits for your traffic pattern.

## What’s different from g4dn.xlarge (GPU)

- No NVIDIA driver or Docker GPU runtime.
- Backend uses **CPU-only PyTorch** (built with `TORCH_GPU=0`).
- Same features (matching, LLM, careers, DB); embedding/matching is a bit slower but fine for ~20 users.
- Lower cost than g4dn.xlarge (no GPU).

## 1. Launch EC2 (CPU)

1. In **EC2 → Launch instance**:
   - **AMI**: Ubuntu 22.04 LTS.
   - **Instance type**: e.g. **m6i.2xlarge** (8 vCPU, 32 GB).
   - **Storage**: 100 GB gp3 (or more if you need space for CVs/JDs).
   - **Security group**: allow 22 (SSH), 80 (HTTP), 443 (HTTPS) from your IP / load balancer.
2. Connect: `ssh -i your-key.pem ubuntu@<instance-ip>`.

## 2. One-time setup on the instance (CPU, no GPU)

From the repo on the instance:

```bash
cd /home/ubuntu/alpha-cv   # or your clone path
./scripts/setup-ec2-cpu.sh prod
```

This script:

- Installs Docker and Docker Compose (no NVIDIA Docker).
- Clones/updates the repo, creates dirs, prepares `.env`.
- Does **not** install any GPU drivers or runtimes.

When prompted, start the app with the **CPU** stack (it will use `docker-compose.cpu.yml`).

## 3. Run the app (CPU stack)

Always use the CPU compose file and the CPU start script:

```bash
cd /home/ubuntu/alpha-cv
./scripts/start-cpu.sh
```

Rebuild after code/image changes:

```bash
./scripts/start-cpu.sh rebuild
```

## 4. Compose file and scripts

| File                     | Purpose |
|--------------------------|--------|
| `docker-compose.cpu.yml` | Production stack **without** GPU (backend built with CPU-only PyTorch). |
| `scripts/start-cpu.sh`   | Starts (and optionally rebuilds) using `docker-compose.cpu.yml`. |
| `scripts/setup-ec2-cpu.sh` | One-time EC2 setup for CPU-only (no NVIDIA). |

**Do not** use `docker-compose.yml` (GPU) on a CPU-only instance; use `docker-compose.cpu.yml` and `start-cpu.sh` only.

## 5. Switching from GPU (g4dn) to CPU on the same server

If the instance is currently running the GPU stack:

```bash
cd /home/ubuntu/alpha-cv
docker compose -f docker-compose.yml down
./scripts/start-cpu.sh rebuild
```

Then use `./scripts/start-cpu.sh` for all future starts.

## 6. Summary

- **Instance**: m6i.2xlarge (or t3.2xlarge) for ~20 users, CPU-only.
- **Setup**: `./scripts/setup-ec2-cpu.sh prod` (once).
- **Run**: `./scripts/start-cpu.sh` (uses `docker-compose.cpu.yml`, no GPU).
