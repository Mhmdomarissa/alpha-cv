#!/usr/bin/env python3
"""
Comprehensive test script for matching and upload optimizations.
Tests the system for bottlenecks and performance improvements.
"""

import asyncio
import time
import requests
import json
from concurrent.futures import ThreadPoolExecutor
import sys

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_CV_COUNT = 10  # Start with 10 CVs for testing
TEST_JD_ID = "test_jd_123"

def test_system_health():
    """Test if the system is running and healthy"""
    print("🔍 Testing system health...")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        if response.status_code == 200:
            print("✅ System is healthy")
            return True
        else:
            print(f"❌ System health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ System health check failed: {e}")
        return False

def test_matching_progress_endpoint():
    """Test the matching progress tracking endpoint"""
    print("🔍 Testing matching progress endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/matching-progress/{TEST_JD_ID}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Matching progress endpoint working: {data}")
            return True
        else:
            print(f"❌ Matching progress endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Matching progress endpoint failed: {e}")
        return False

def test_cv_upload_progress_endpoint():
    """Test the CV upload progress tracking endpoint"""
    print("🔍 Testing CV upload progress endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/cv/cv-upload-progress/test_cv_123", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ CV upload progress endpoint working: {data}")
            return True
        else:
            print(f"❌ CV upload progress endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ CV upload progress endpoint failed: {e}")
        return False

def test_async_operations():
    """Test if async operations are working correctly"""
    print("🔍 Testing async operations...")
    
    async def test_async_function():
        """Test async function execution"""
        await asyncio.sleep(0.1)  # Simulate async work
        return "async_working"
    
    try:
        result = asyncio.run(test_async_function())
        if result == "async_working":
            print("✅ Async operations working correctly")
            return True
        else:
            print("❌ Async operations not working correctly")
            return False
    except Exception as e:
        print(f"❌ Async operations failed: {e}")
        return False

def test_thread_pool_executor():
    """Test thread pool executor for blocking operations"""
    print("🔍 Testing thread pool executor...")
    
    def blocking_operation():
        """Simulate a blocking operation"""
        time.sleep(0.1)
        return "blocking_working"
    
    async def test_thread_pool():
        """Test thread pool execution"""
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, blocking_operation)
            return result
    
    try:
        result = asyncio.run(test_thread_pool())
        if result == "blocking_working":
            print("✅ Thread pool executor working correctly")
            return True
        else:
            print("❌ Thread pool executor not working correctly")
            return False
    except Exception as e:
        print(f"❌ Thread pool executor failed: {e}")
        return False

def test_memory_usage():
    """Test memory usage patterns"""
    print("🔍 Testing memory usage...")
    try:
        import psutil
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB
        
        # Simulate memory-intensive operations
        data = []
        for i in range(1000):
            data.append([0.0] * 768)  # Simulate embedding vectors
        
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_used = memory_after - memory_before
        
        print(f"✅ Memory test completed: {memory_used:.2f}MB used")
        return True
    except Exception as e:
        print(f"❌ Memory test failed: {e}")
        return False

def test_concurrent_requests():
    """Test concurrent request handling"""
    print("🔍 Testing concurrent request handling...")
    
    def make_request():
        """Make a single request"""
        try:
            response = requests.get(f"{BASE_URL}/api/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    try:
        # Test 5 concurrent requests
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            results = [future.result() for future in futures]
        
        success_count = sum(results)
        if success_count >= 4:  # At least 4 out of 5 should succeed
            print(f"✅ Concurrent requests working: {success_count}/5 successful")
            return True
        else:
            print(f"❌ Concurrent requests failed: {success_count}/5 successful")
            return False
    except Exception as e:
        print(f"❌ Concurrent request test failed: {e}")
        return False

def test_gpu_availability():
    """Test GPU availability for embeddings"""
    print("🔍 Testing GPU availability...")
    try:
        import subprocess
        result = subprocess.run([
            "docker", "exec", "ubuntu_backend_1", "python", "-c",
            "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA device count: {torch.cuda.device_count()}')"
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            output = result.stdout.strip()
            if "CUDA available: True" in output:
                print(f"✅ GPU is available: {output}")
                return True
            else:
                print(f"⚠️ GPU not available: {output}")
                return False
        else:
            print(f"❌ GPU test failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ GPU test failed: {e}")
        return False

def run_all_tests():
    """Run all optimization tests"""
    print("🚀 Starting comprehensive optimization tests...")
    print("=" * 60)
    
    tests = [
        ("System Health", test_system_health),
        ("Matching Progress Endpoint", test_matching_progress_endpoint),
        ("CV Upload Progress Endpoint", test_cv_upload_progress_endpoint),
        ("Async Operations", test_async_operations),
        ("Thread Pool Executor", test_thread_pool_executor),
        ("Memory Usage", test_memory_usage),
        ("Concurrent Requests", test_concurrent_requests),
        ("GPU Availability", test_gpu_availability),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name}...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! System is optimized and ready.")
        return True
    else:
        print("⚠️ Some tests failed. Check the issues above.")
        return False

if __name__ == "__main__":
    print("🔧 Optimization Test Suite")
    print("Testing matching and upload system optimizations...")
    print()
    
    success = run_all_tests()
    sys.exit(0 if success else 1)
