#!/usr/bin/env python3
"""
Test concurrent requests to verify system stability.
"""

import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://localhost:8000/api"

def test_health_endpoint():
    """Test health endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        return response.status_code == 200
    except:
        return False

def test_categories_endpoint():
    """Test categories endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/cv/categories", timeout=10)
        return response.status_code == 200
    except:
        return False

def test_cv_listing():
    """Test CV listing endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/cv/cvs", timeout=10)
        return response.status_code == 200
    except:
        return False

def test_jd_listing():
    """Test JD listing endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/jd/jds", timeout=10)
        return response.status_code == 200
    except:
        return False

def worker_function(worker_id, num_requests=10):
    """Worker function for concurrent testing."""
    results = {
        'worker_id': worker_id,
        'health_success': 0,
        'categories_success': 0,
        'cv_listing_success': 0,
        'jd_listing_success': 0,
        'total_requests': num_requests * 4
    }
    
    for i in range(num_requests):
        # Test health
        if test_health_endpoint():
            results['health_success'] += 1
        
        # Test categories
        if test_categories_endpoint():
            results['categories_success'] += 1
        
        # Test CV listing
        if test_cv_listing():
            results['cv_listing_success'] += 1
        
        # Test JD listing
        if test_jd_listing():
            results['jd_listing_success'] += 1
        
        # Small delay between requests
        time.sleep(0.1)
    
    return results

def main():
    """Run concurrent request tests."""
    print("🚀 Testing Concurrent Request Stability")
    print("=" * 50)
    
    num_workers = 10
    requests_per_worker = 5
    
    print(f"📊 Configuration:")
    print(f"   • Workers: {num_workers}")
    print(f"   • Requests per worker: {requests_per_worker}")
    print(f"   • Total requests: {num_workers * requests_per_worker * 4}")
    print()
    
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Submit all worker tasks
        futures = [
            executor.submit(worker_function, i, requests_per_worker) 
            for i in range(num_workers)
        ]
        
        # Collect results
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
                print(f"✅ Worker {result['worker_id']} completed")
            except Exception as e:
                print(f"❌ Worker failed: {e}")
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Calculate totals
    total_health = sum(r['health_success'] for r in results)
    total_categories = sum(r['categories_success'] for r in results)
    total_cv_listing = sum(r['cv_listing_success'] for r in results)
    total_jd_listing = sum(r['jd_listing_success'] for r in results)
    total_requests = sum(r['total_requests'] for r in results)
    total_successful = total_health + total_categories + total_cv_listing + total_jd_listing
    
    print("\n" + "=" * 50)
    print("📊 CONCURRENT REQUEST TEST RESULTS")
    print("=" * 50)
    print(f"⏱️  Total Duration: {duration:.2f} seconds")
    print(f"📈 Total Requests: {total_requests}")
    print(f"✅ Successful Requests: {total_successful}")
    print(f"📊 Success Rate: {(total_successful/total_requests)*100:.1f}%")
    print()
    print("📋 Endpoint Breakdown:")
    print(f"   • Health: {total_health}/{num_workers * requests_per_worker} ({(total_health/(num_workers * requests_per_worker))*100:.1f}%)")
    print(f"   • Categories: {total_categories}/{num_workers * requests_per_worker} ({(total_categories/(num_workers * requests_per_worker))*100:.1f}%)")
    print(f"   • CV Listing: {total_cv_listing}/{num_workers * requests_per_worker} ({(total_cv_listing/(num_workers * requests_per_worker))*100:.1f}%)")
    print(f"   • JD Listing: {total_jd_listing}/{num_workers * requests_per_worker} ({(total_jd_listing/(num_workers * requests_per_worker))*100:.1f}%)")
    print()
    
    # System stability assessment
    if total_successful / total_requests >= 0.95:
        print("🎉 EXCELLENT: System handled concurrent load very well!")
        stability = "EXCELLENT"
    elif total_successful / total_requests >= 0.90:
        print("✅ GOOD: System handled concurrent load well!")
        stability = "GOOD"
    elif total_successful / total_requests >= 0.80:
        print("⚠️  FAIR: System handled concurrent load with some issues.")
        stability = "FAIR"
    else:
        print("❌ POOR: System struggled with concurrent load.")
        stability = "POOR"
    
    print(f"\n🏆 System Stability Rating: {stability}")
    
    return stability

if __name__ == "__main__":
    main()
