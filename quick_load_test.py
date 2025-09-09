#!/usr/bin/env python3
"""
Quick Load Test for Critical Areas
==================================

Tests the remaining critical areas for concurrent user stability:
- LLM API rate limits
- Vector DB performance
- Session management 
- API concurrent handling

Usage: python3 quick_load_test.py
"""

import asyncio
import aiohttp
import time
import json
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"

async def test_llm_api_rate_limits():
    """Test LLM API concurrent request handling"""
    logger.info("🧠 Testing LLM API Rate Limits...")
    
    async with aiohttp.ClientSession() as session:
        # Test concurrent CV processing (hits LLM API)
        tasks = []
        
        for i in range(10):  # 10 concurrent LLM requests
            cv_text = f"Test CV {i}\nSoftware Engineer\nPython, JavaScript\n5 years experience"
            data = aiohttp.FormData()
            data.add_field('cv_text', cv_text)
            
            task = session.post(f"{BASE_URL}/api/cv/upload-cv", data=data)
            tasks.append(task)
            
        start_time = time.time()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        success_count = sum(1 for r in responses if hasattr(r, 'status') and r.status in [200, 201])
        
        logger.info(f"   LLM API Test Results:")
        logger.info(f"   ✅ Successful: {success_count}/10")
        logger.info(f"   ⏱️ Duration: {duration:.2f}s")
        logger.info(f"   📊 Rate: {10/duration:.2f} requests/second")
        
        # Close responses
        for r in responses:
            if hasattr(r, 'close'):
                r.close()
        
        return success_count >= 8  # 80% success rate required

async def test_vector_db_performance():
    """Test Qdrant concurrent operations"""
    logger.info("🗄️ Testing Vector DB Performance...")
    
    async with aiohttp.ClientSession() as session:
        # First ensure we have data
        async with session.get(f"{BASE_URL}/api/special/database/status") as resp:
            if resp.status == 200:
                data = await resp.json()
                cv_count = data.get('qdrant_collections', {}).get('cv_structured', {}).get('points_count', 0)
                jd_count = data.get('qdrant_collections', {}).get('jd_structured', {}).get('points_count', 0)
                
                if cv_count < 5 or jd_count < 5:
                    logger.warning(f"   ⚠️ Insufficient data: {cv_count} CVs, {jd_count} JDs")
                    return False
                    
        # Test concurrent matching operations (hits Qdrant heavily)
        match_requests = []
        for i in range(15):  # 15 concurrent vector operations
            request_data = {
                "jd_text": "Software Engineer position requiring Python and JavaScript experience",
                "limit": 10
            }
            task = session.post(f"{BASE_URL}/api/special/match-cv-against-jd", json=request_data)
            match_requests.append(task)
            
        start_time = time.time()
        responses = await asyncio.gather(*match_requests, return_exceptions=True)
        duration = time.time() - start_time
        
        success_count = sum(1 for r in responses if hasattr(r, 'status') and r.status == 200)
        
        logger.info(f"   Vector DB Test Results:")
        logger.info(f"   ✅ Successful: {success_count}/15")
        logger.info(f"   ⏱️ Duration: {duration:.2f}s")
        logger.info(f"   📊 Rate: {15/duration:.2f} operations/second")
        
        # Close responses
        for r in responses:
            if hasattr(r, 'close'):
                r.close()
                
        return success_count >= 12  # 80% success rate required

async def test_api_concurrent_handling():
    """Test API endpoint concurrent handling"""
    logger.info("🌐 Testing API Concurrent Handling...")
    
    async with aiohttp.ClientSession() as session:
        # Test multiple concurrent API calls to different endpoints
        tasks = []
        
        # Mix of different endpoint types
        endpoints = [
            ("/api/health", "GET"),
            ("/api/cv/list", "GET"),
            ("/api/jd/list", "GET"),
            ("/api/special/database/status", "GET"),
            ("/api/special/health/system", "GET"),
            ("/api/special/health/performance", "GET"),
        ]
        
        # Create 30 concurrent requests across different endpoints
        for i in range(30):
            endpoint, method = endpoints[i % len(endpoints)]
            
            if method == "GET":
                task = session.get(f"{BASE_URL}{endpoint}")
            else:
                task = session.post(f"{BASE_URL}{endpoint}")
                
            tasks.append(task)
            
        start_time = time.time()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        success_count = sum(1 for r in responses if hasattr(r, 'status') and r.status == 200)
        
        logger.info(f"   API Handling Test Results:")
        logger.info(f"   ✅ Successful: {success_count}/30")
        logger.info(f"   ⏱️ Duration: {duration:.2f}s")
        logger.info(f"   📊 Rate: {30/duration:.2f} requests/second")
        
        # Close responses
        for r in responses:
            if hasattr(r, 'close'):
                r.close()
                
        return success_count >= 25  # ~83% success rate required

async def test_session_management():
    """Test session handling under load"""
    logger.info("👥 Testing Session Management...")
    
    # Create multiple sessions simultaneously
    sessions = []
    try:
        for i in range(20):
            session = aiohttp.ClientSession()
            sessions.append(session)
            
        # Test concurrent requests from different sessions
        tasks = []
        for i, session in enumerate(sessions):
            task = session.get(f"{BASE_URL}/api/health")
            tasks.append(task)
            
        start_time = time.time()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        success_count = sum(1 for r in responses if hasattr(r, 'status') and r.status == 200)
        
        logger.info(f"   Session Management Test Results:")
        logger.info(f"   ✅ Successful: {success_count}/20")
        logger.info(f"   ⏱️ Duration: {duration:.2f}s")
        
        # Close responses
        for r in responses:
            if hasattr(r, 'close'):
                r.close()
                
        return success_count >= 18  # 90% success rate required
        
    finally:
        # Clean up sessions
        for session in sessions:
            await session.close()

async def check_system_resources():
    """Check current system resources"""
    logger.info("📊 Checking System Resources...")
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/api/special/health/load-test-status") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    logger.info(f"   Memory Available: {data.get('memory_available_gb', 0):.2f}GB")
                    logger.info(f"   Memory Usage: {data.get('memory_used_percent', 0):.1f}%")
                    logger.info(f"   Load Test Ready: {data.get('load_test_ready', False)}")
                    logger.info(f"   CV Count: {data.get('cv_count', 0)}")
                    logger.info(f"   JD Count: {data.get('jd_count', 0)}")
                    
                    return data.get('load_test_ready', False)
                    
        except Exception as e:
            logger.error(f"   ❌ Resource check failed: {str(e)}")
            return False

async def main():
    """Run all quick load tests"""
    print("🚀 Quick Load Test for Concurrent User Stability")
    print("="*60)
    
    # Check initial system state
    system_ready = await check_system_resources()
    if not system_ready:
        logger.warning("⚠️ System may not be ready for testing")
    
    # Run all tests
    tests = [
        ("LLM API Rate Limits", test_llm_api_rate_limits),
        ("Vector DB Performance", test_vector_db_performance), 
        ("API Concurrent Handling", test_api_concurrent_handling),
        ("Session Management", test_session_management),
    ]
    
    results = {}
    total_start = time.time()
    
    for test_name, test_func in tests:
        try:
            logger.info(f"\n🧪 Running: {test_name}")
            result = await test_func()
            results[test_name] = result
            
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"   Result: {status}")
            
        except Exception as e:
            logger.error(f"   💥 Test failed: {str(e)}")
            results[test_name] = False
            
    total_duration = time.time() - total_start
    
    # Generate summary report
    print(f"\n" + "="*60)
    print("📋 QUICK LOAD TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    print(f"Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    print(f"Duration: {total_duration:.2f} seconds")
    
    print(f"\nDetailed Results:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        
    # Overall assessment
    if passed == total:
        print(f"\n🟢 EXCELLENT - All systems ready for concurrent users")
    elif passed >= total * 0.75:
        print(f"\n🟡 GOOD - Most systems ready, monitor closely")
    else:
        print(f"\n🔴 POOR - Significant issues found, address before user testing")
        
    print("="*60)
    
    # Final resource check
    await check_system_resources()

if __name__ == "__main__":
    asyncio.run(main())
