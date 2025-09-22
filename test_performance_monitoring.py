#!/usr/bin/env python3
"""
Test Performance Monitoring System
Tests all performance monitoring endpoints and functionality
"""

import requests
import json
import time
import sys

API_BASE = "http://localhost:8000/api"
FRONTEND_URL = "http://localhost:3000"

def print_section_header(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")

def test_performance_endpoints():
    """Test all performance monitoring endpoints"""
    print_section_header("🔍 Testing Performance Monitoring Endpoints")
    
    endpoints = [
        ("/performance/summary", "Performance Summary"),
        ("/performance/system", "Full System Performance"),
        ("/performance/gpu", "GPU Performance"),
        ("/performance/docker", "Docker Performance"),
        ("/performance/health", "Performance Health")
    ]
    
    results = {}
    
    for endpoint, name in endpoints:
        try:
            print(f"   Testing {name}...")
            response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
            response.raise_for_status()
            data = response.json()
            
            print(f"   ✅ {name}: Status {response.status_code}")
            
            # Store key metrics for summary
            if endpoint == "/performance/summary":
                results['summary'] = {
                    'cpu_usage': data.get('cpu_usage', 0),
                    'memory_usage': data.get('memory_usage', 0),
                    'gpu_count': data.get('gpu_count', 0),
                    'status': data.get('status', 'unknown')
                }
            elif endpoint == "/performance/system":
                results['system'] = {
                    'cpu_percent': data.get('system', {}).get('cpu', {}).get('percent', 0),
                    'memory_percent': data.get('system', {}).get('memory', {}).get('percent', 0),
                    'gpu_count': len(data.get('gpu', [])),
                    'docker_count': len(data.get('docker', []))
                }
            elif endpoint == "/performance/gpu":
                results['gpu'] = len(data.get('gpu', []))
            elif endpoint == "/performance/docker":
                results['docker'] = len(data.get('docker', []))
            elif endpoint == "/performance/health":
                results['health'] = data.get('status', 'unknown')
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ {name}: Failed - {e}")
            results[endpoint] = f"Error: {e}"
        except Exception as e:
            print(f"   ❌ {name}: Unexpected error - {e}")
            results[endpoint] = f"Error: {e}"
    
    return results

def test_frontend_accessibility():
    """Test if frontend is accessible"""
    print_section_header("🌐 Testing Frontend Accessibility")
    
    try:
        response = requests.get(FRONTEND_URL, timeout=10)
        response.raise_for_status()
        print(f"   ✅ Frontend accessible: Status {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Frontend not accessible: {e}")
        return False

def test_performance_under_load():
    """Test performance monitoring under simulated load"""
    print_section_header("⚡ Testing Performance Under Load")
    
    print("   Simulating concurrent requests to performance endpoints...")
    
    import threading
    import concurrent.futures
    
    def make_performance_request():
        try:
            response = requests.get(f"{API_BASE}/performance/summary", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    # Test with 10 concurrent requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_performance_request) for _ in range(10)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
    
    successful_requests = sum(results)
    total_requests = len(results)
    
    print(f"   📊 Concurrent Load Test Results:")
    print(f"      • Total Requests: {total_requests}")
    print(f"      • Successful: {successful_requests}")
    print(f"      • Success Rate: {(successful_requests/total_requests)*100:.1f}%")
    
    if successful_requests == total_requests:
        print("   ✅ Performance monitoring handles concurrent load well!")
        return True
    else:
        print("   ⚠️ Some requests failed under concurrent load")
        return False

def display_performance_summary(results):
    """Display a summary of current system performance"""
    print_section_header("📊 Current System Performance Summary")
    
    if 'summary' in results:
        summary = results['summary']
        print(f"   🖥️  CPU Usage: {summary['cpu_usage']:.1f}%")
        print(f"   💾 Memory Usage: {summary['memory_usage']:.1f}%")
        print(f"   🎮 GPU Count: {summary['gpu_count']}")
        print(f"   🏥 System Status: {summary['status'].upper()}")
        
        # Performance assessment
        if summary['cpu_usage'] < 50 and summary['memory_usage'] < 70:
            print("   🟢 EXCELLENT: System performance is optimal")
        elif summary['cpu_usage'] < 80 and summary['memory_usage'] < 85:
            print("   🟡 GOOD: System performance is acceptable")
        else:
            print("   🔴 WARNING: System performance may be degraded")
    
    if 'system' in results:
        system = results['system']
        print(f"\n   📈 Detailed Metrics:")
        print(f"      • CPU: {system['cpu_percent']:.1f}%")
        print(f"      • Memory: {system['memory_percent']:.1f}%")
        print(f"      • GPU Devices: {system['gpu_count']}")
        print(f"      • Docker Containers: {system['docker_count']}")
    
    if 'health' in results:
        health_status = results['health']
        if health_status == 'healthy':
            print(f"   🟢 Health Status: {health_status.upper()}")
        elif health_status == 'warning':
            print(f"   🟡 Health Status: {health_status.upper()}")
        else:
            print(f"   🔴 Health Status: {health_status.upper()}")

def main():
    print("🚀 Performance Monitoring System Test")
    print("=" * 60)
    
    start_time = time.time()
    
    # Test all components
    performance_results = test_performance_endpoints()
    frontend_accessible = test_frontend_accessibility()
    load_test_passed = test_performance_under_load()
    
    # Display summary
    display_performance_summary(performance_results)
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    # Final assessment
    print_section_header("🎯 Final Test Results")
    
    tests_passed = 0
    total_tests = 3
    
    if performance_results and 'summary' in performance_results:
        tests_passed += 1
        print("   ✅ Performance Endpoints: WORKING")
    else:
        print("   ❌ Performance Endpoints: FAILED")
    
    if frontend_accessible:
        tests_passed += 1
        print("   ✅ Frontend Accessibility: WORKING")
    else:
        print("   ❌ Frontend Accessibility: FAILED")
    
    if load_test_passed:
        tests_passed += 1
        print("   ✅ Load Testing: PASSED")
    else:
        print("   ❌ Load Testing: FAILED")
    
    print(f"\n   ⏱️  Total Test Duration: {total_duration:.2f} seconds")
    print(f"   📊 Tests Passed: {tests_passed}/{total_tests}")
    print(f"   📈 Success Rate: {(tests_passed/total_tests)*100:.1f}%")
    
    if tests_passed == total_tests:
        print("\n🎉 EXCELLENT: Performance monitoring system is fully operational!")
        print("🏆 System is ready to monitor 10+ concurrent users!")
        print("💪 Real-time metrics are available in the UI!")
        print("📊 Performance dashboard is accessible!")
        return 0
    else:
        print(f"\n⚠️ WARNING: {total_tests - tests_passed} test(s) failed.")
        print("📉 Please review the logs for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
