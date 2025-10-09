#!/bin/bash

# Quick Qdrant Collection Status Checker

echo "=========================================="
echo "📊 QDRANT COLLECTIONS STATUS"
echo "=========================================="
echo ""

# Development
echo "🧪 DEVELOPMENT (Port 6335)"
echo "----------------------------"
for collection in cv_documents cv_embeddings jd_documents jd_embeddings; do
    count=$(curl -s http://localhost:6335/collections/$collection | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null || echo "N/A")
    printf "  %-20s %s documents\n" "$collection:" "$count"
done

echo ""

# Production
echo "🏭 PRODUCTION (Port 6333)"
echo "----------------------------"
for collection in cv_documents cv_embeddings jd_documents jd_embeddings job_postings_structured; do
    count=$(curl -s http://localhost:6333/collections/$collection | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null || echo "N/A")
    printf "  %-25s %s documents\n" "$collection:" "$count"
done

echo ""
echo "=========================================="
echo "✅ Done"
echo ""

