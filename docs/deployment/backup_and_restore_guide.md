# 🔒 COMPLETE BACKUP & RESTORE GUIDE
## How to Safely Delete Volumes and Restore All Data

---

## 📋 **WHAT GETS BACKED UP**

### ✅ **ALL Collections Data (Qdrant)**
- **cv_documents** - All raw CV text (compressed)
- **cv_structured** - All structured CV data (skills, responsibilities, contact info)
- **cv_embeddings** - All 32 vectors per CV (for matching)
- **jd_documents** - All job description text
- **jd_structured** - All structured JD data
- **jd_embeddings** - All JD vectors
- **job_postings_structured** - All career page job postings
- **All job applications** - All CVs linked to job postings
- **All relationships** - CV-to-job links, application data

### ✅ **PostgreSQL Database**
- Email processing metadata
- Processed email IDs
- User authentication data
- Email processing statistics

### ✅ **Redis Cache**
- Cached embeddings
- Cached match results

### ✅ **Configuration Files**
- `.env` files (API keys, passwords)
- `docker-compose.yml`
- Qdrant configuration
- Nginx configuration

---

## 🚀 **STEP 1: BACKUP EVERYTHING (Run This FIRST)**

### **Option A: Use Existing Backup Script (Recommended)**

```bash
# Make sure script is executable
chmod +x /home/ubuntu/backup_system.sh

# Run full backup (backs up EVERYTHING)
/home/ubuntu/backup_system.sh
```

**What it does:**
- ✅ Creates Qdrant snapshot via API
- ✅ Backs up entire Qdrant storage directory
- ✅ Backs up all PostgreSQL databases
- ✅ Backs up Redis data
- ✅ Backs up all configuration files
- ✅ Backs up Docker volumes directly
- ✅ Creates backup manifest with restore instructions

**Backup Location:** `/home/ubuntu/backups/backup_YYYYMMDD_HHMMSS/`

**Time Required:** 10-15 minutes (for ~100GB Qdrant data)

---

### **Option B: Manual Backup (If script doesn't work)**

```bash
# Create backup directory
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups/backup_${BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"

# 1. Backup Qdrant (MOST CRITICAL - Contains ALL CVs, JDs, Job Postings)
echo "Backing up Qdrant..."
docker exec ubuntu_qdrant_1 curl -X POST 'http://localhost:6333/snapshots' 
sleep 5
docker exec ubuntu_qdrant_1 tar -czf /tmp/qdrant_backup.tar.gz /qdrant/storage
docker cp ubuntu_qdrant_1:/tmp/qdrant_backup.tar.gz "$BACKUP_DIR/qdrant_backup.tar.gz"
docker exec ubuntu_qdrant_1 rm /tmp/qdrant_backup.tar.gz

# Get collection stats (verify all collections are backed up)
docker exec ubuntu_qdrant_1 curl -s 'http://localhost:6333/collections' > "$BACKUP_DIR/qdrant_collections.json"
echo "✅ Qdrant backed up"

# 2. Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker exec ubuntu_postgres_1 pg_dump -U cv_user cv_database > "$BACKUP_DIR/postgres_backup.sql"
docker exec ubuntu_postgres_1 pg_dump -U cv_user auth_db > "$BACKUP_DIR/postgres_auth_backup.sql"
echo "✅ PostgreSQL backed up"

# 3. Backup Redis
echo "Backing up Redis..."
docker exec ubuntu_redis_1 redis-cli SAVE
docker exec ubuntu_redis_1 tar -czf /tmp/redis_backup.tar.gz /data
docker cp ubuntu_redis_1:/tmp/redis_backup.tar.gz "$BACKUP_DIR/redis_backup.tar.gz"
docker exec ubuntu_redis_1 rm /tmp/redis_backup.tar.gz
echo "✅ Redis backed up"

# 4. Backup Docker Volumes (Full backup)
echo "Backing up Docker volumes..."
sudo tar -czf "$BACKUP_DIR/docker_volumes.tar.gz" \
    /var/lib/docker/volumes/ubuntu_qdrant_data \
    /var/lib/docker/volumes/ubuntu_postgres_data \
    /var/lib/docker/volumes/ubuntu_redis_data
sudo chown ubuntu:ubuntu "$BACKUP_DIR/docker_volumes.tar.gz"
echo "✅ Docker volumes backed up"

# 5. Backup Config Files
echo "Backing up configuration files..."
cd /home/ubuntu
tar -czf "$BACKUP_DIR/configs.tar.gz" \
    .env \
    docker-compose.yml \
    qdrant-optimized.yaml \
    nginx.conf \
    2>/dev/null || echo "Some config files not found"
echo "✅ Config files backed up"

echo ""
echo "=========================================="
echo "✅ BACKUP COMPLETE!"
echo "Location: $BACKUP_DIR"
echo "Total Size: $(du -sh "$BACKUP_DIR" | awk '{print $1}')"
echo "=========================================="
```

---

## ✅ **STEP 2: VERIFY BACKUP**

```bash
BACKUP_DIR="/home/ubuntu/backups/backup_YYYYMMDD_HHMMSS"  # Use your backup date

# Check backup files exist
ls -lh "$BACKUP_DIR"

# Verify Qdrant collections are backed up
cat "$BACKUP_DIR/qdrant_collections.json" | grep -E "(cv_|jd_|job_postings)"

# Check backup sizes (should be significant)
du -sh "$BACKUP_DIR"/*
```

**Expected Output:**
```
✅ qdrant_backup.tar.gz - Should be 50-100GB (contains ALL data)
✅ postgres_backup.sql - Should be 1-10MB
✅ redis_backup.tar.gz - Varies
✅ docker_volumes.tar.gz - Full backup
✅ configs.tar.gz - Small, contains configs
```

---

## 🔄 **STEP 3: SAFELY DELETE VOLUMES (Only After Backup!)**

### **Method 1: Using docker-compose (Recommended)**

```bash
# Stop all containers
docker-compose down

# Now volumes are stopped and can be safely deleted
docker volume rm ubuntu_qdrant_data ubuntu_postgres_data ubuntu_redis_data

# Verify volumes are deleted
docker volume ls | grep -E "(qdrant|postgres|redis)"
# Should show nothing (volumes deleted)

# Restart with fresh volumes
docker-compose up -d
```

### **Method 2: Using docker volume prune (Removes ALL unused volumes)**

```bash
# Stop containers first
docker-compose down

# Remove ALL unused volumes (be careful!)
docker volume prune -f

# Restart
docker-compose up -d
```

**⚠️ WARNING:** Only run this AFTER backup is verified!

---

## 🔧 **STEP 4: RESTORE ALL DATA**

### **Restore Script (Run this after volumes are deleted)**

```bash
# Set your backup directory
BACKUP_DIR="/home/ubuntu/backups/backup_YYYYMMDD_HHMMSS"  # Use your actual backup date

# Make sure containers are running
docker-compose up -d

# Wait for containers to be healthy
sleep 30

# 1. Restore Qdrant (MOST CRITICAL)
echo "Restoring Qdrant..."
docker cp "$BACKUP_DIR/qdrant_backup.tar.gz" ubuntu_qdrant_1:/tmp/qdrant_backup.tar.gz
docker exec ubuntu_qdrant_1 tar -xzf /tmp/qdrant_backup.tar.gz -C /
docker exec ubuntu_qdrant_1 rm /tmp/qdrant_backup.tar.gz

# Restart Qdrant to load restored data
docker restart ubuntu_qdrant_1
sleep 20

# Verify collections are restored
docker exec ubuntu_qdrant_1 curl -s 'http://localhost:6333/collections' | jq
echo "✅ Qdrant restored"

# 2. Restore PostgreSQL
echo "Restoring PostgreSQL..."
docker cp "$BACKUP_DIR/postgres_backup.sql" ubuntu_postgres_1:/tmp/postgres_backup.sql
docker exec ubuntu_postgres_1 psql -U cv_user -d cv_database < /tmp/postgres_backup.sql

# Restore auth database if exists
if [ -f "$BACKUP_DIR/postgres_auth_backup.sql" ]; then
    docker cp "$BACKUP_DIR/postgres_auth_backup.sql" ubuntu_postgres_1:/tmp/postgres_auth_backup.sql
    docker exec ubuntu_postgres_1 psql -U cv_user -d auth_db < /tmp/postgres_auth_backup.sql
fi
echo "✅ PostgreSQL restored"

# 3. Restore Redis
echo "Restoring Redis..."
docker cp "$BACKUP_DIR/redis_backup.tar.gz" ubuntu_redis_1:/tmp/redis_backup.tar.gz
docker exec ubuntu_redis_1 tar -xzf /tmp/redis_backup.tar.gz -C /
docker exec ubuntu_redis_1 rm /tmp/redis_backup.tar.gz
docker restart ubuntu_redis_1
echo "✅ Redis restored"

# 4. Restore Docker Volumes (Alternative method - if above doesn't work)
echo "Restoring Docker volumes (alternative method)..."
docker-compose down
sudo tar -xzf "$BACKUP_DIR/docker_volumes.tar.gz" -C /
docker-compose up -d
echo "✅ Docker volumes restored"

echo ""
echo "=========================================="
echo "✅ RESTORE COMPLETE!"
echo "=========================================="
echo "Verifying restore..."
echo ""

# Verify Qdrant collections
echo "Qdrant Collections:"
docker exec ubuntu_qdrant_1 curl -s 'http://localhost:6333/collections' | jq -r '.result.collections[].name'

# Verify PostgreSQL
echo ""
echo "PostgreSQL Databases:"
docker exec ubuntu_postgres_1 psql -U cv_user -l

echo ""
echo "✅ All data restored successfully!"
```

---

## 📤 **STEP 5: BACKUP TO S3 (Optional but Recommended)**

**Store backup off-server for safety:**

```bash
BACKUP_DIR="/home/ubuntu/backups/backup_YYYYMMDD_HHMMSS"

# Upload to S3 (replace with your bucket)
aws s3 cp "$BACKUP_DIR" s3://your-backup-bucket/backups/ --recursive

# Or upload to external drive/mount
# cp -r "$BACKUP_DIR" /mnt/external-drive/backups/
```

---

## 🔍 **VERIFICATION CHECKLIST**

After restore, verify everything is working:

```bash
# 1. Check Qdrant collections
docker exec ubuntu_qdrant_1 curl -s 'http://localhost:6333/collections' | jq

# Should show:
# - cv_documents (with point count)
# - cv_structured (with point count)
# - cv_embeddings (with point count)
# - jd_documents
# - jd_structured
# - jd_embeddings
# - job_postings_structured

# 2. Check PostgreSQL
docker exec ubuntu_postgres_1 psql -U cv_user -d cv_database -c "SELECT COUNT(*) FROM processed_emails;"

# 3. Test API endpoints
curl http://localhost:8000/api/cvs | jq '.count'
curl http://localhost:8000/api/database/status | jq

# 4. Check job postings
curl http://localhost:8000/api/careers/jobs | jq '.count'
```

---

## 📊 **WHAT GETS RESTORED**

### ✅ **All Collections Data**
- ✅ **cv_documents** - All 615+ CVs with raw text
- ✅ **cv_structured** - All structured CV data
- ✅ **cv_embeddings** - All 32 vectors per CV (for matching)
- ✅ **jd_documents** - All 77+ job descriptions
- ✅ **jd_structured** - All structured JD data
- ✅ **jd_embeddings** - All JD vectors
- ✅ **job_postings_structured** - All career page job postings
- ✅ **All job applications** - All CVs linked to job postings
- ✅ **All relationships** - CV-to-job links preserved

### ✅ **PostgreSQL Data**
- ✅ Email processing metadata
- ✅ Processed email IDs
- ✅ User authentication data

### ✅ **Redis Cache**
- ✅ Cached embeddings
- ✅ Cached match results

---

## ⚠️ **CRITICAL WARNINGS**

1. **ALWAYS BACKUP FIRST** - Never delete volumes without backup
2. **VERIFY BACKUP** - Check backup files exist and are correct size
3. **TEST RESTORE** - Test restore on a test environment first if possible
4. **KEEP BACKUP OFF-SERVER** - Store backup in S3 or external drive
5. **DON'T DELETE BACKUP** - Keep backup until system is 100% verified

---

## 🎯 **QUICK REFERENCE**

### **Backup Everything:**
```bash
/home/ubuntu/backup_system.sh
```

### **Delete Volumes (After Backup!):**
```bash
docker-compose down
docker volume rm ubuntu_qdrant_data ubuntu_postgres_data
docker-compose up -d
```

### **Restore Everything:**
```bash
BACKUP_DIR="/home/ubuntu/backups/backup_YYYYMMDD_HHMMSS"
# Run restore commands from Step 4 above
```

---

## 📞 **SUPPORT**

If restore fails:
1. Check backup files exist and are correct size
2. Check container logs: `docker-compose logs qdrant postgres`
3. Verify collections: `docker exec ubuntu_qdrant_1 curl -s 'http://localhost:6333/collections'`
4. Check PostgreSQL: `docker exec ubuntu_postgres_1 psql -U cv_user -d cv_database -c "\dt"`

---

**✅ With this backup/restore process, you can safely delete volumes and restore ALL data including:**
- All CVs, JDs, embeddings
- All job postings from careers page
- All CV-to-job links and applications
- All email processing data
- All configuration files




