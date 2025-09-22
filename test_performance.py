#!/usr/bin/env python3
"""
Performance testing script for the optimized CV analyzer system.
Tests concurrent uploads, matching, and system stability.
"""

import asyncio
import aiohttp
import time
import json
import random
import string
from concurrent.futures import ThreadPoolExecutor
import psutil
import subprocess

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

# Test data
SAMPLE_CV_TEXT = """
John Doe
Software Engineer
Email: john.doe@email.com
Phone: +1-555-0123

EXPERIENCE:
- 5 years of software development
- Python, JavaScript, React, Node.js
- Database design and optimization
- API development and integration

SKILLS:
- Programming Languages: Python, JavaScript, Java, C++
- Frameworks: React, Node.js, Django, Flask
- Databases: PostgreSQL, MongoDB, Redis
- Cloud: AWS, Docker, Kubernetes

EDUCATION:
Bachelor of Computer Science, University of Technology, 2018
"""

SAMPLE_JD_TEXT = """
Senior Software Engineer Position

We are looking for a Senior Software Engineer to join our team.

REQUIREMENTS:
- 5+ years of software development experience
- Strong knowledge of Python and JavaScript
- Experience with React and Node.js
- Database design and optimization skills
- API development experience
- Cloud platform experience (AWS preferred)

RESPONSIBILITIES:
- Develop and maintain web applications
- Design and implement APIs
- Optimize database performance
- Collaborate with cross-functional teams
- Mentor junior developers
"""

class PerformanceTester:
    def __init__(self):
        self.results = {
            "uploads": [],
            "matches": [],
            "system_metrics": []
        }
        self.session = None

    async def create_session(self):
        """Create aiohttp session with connection pooling."""
        connector = aiohttp.TCPConnector(
            limit=100,  # Total connection pool size
            limit_per_host=50,  # Per-host connection limit
            ttl_dns_cache=300,  # DNS cache TTL
            use_dns_cache=True,
        )
        timeout = aiohttp.ClientTimeout(total=300)  # 5 minute timeout
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout
        )

    async def close_session(self):
        """Close aiohttp session."""
        if self.session:
            await self.session.close()

    async def upload_cv(self, cv_id: str, cv_text: str = None) -> dict:
        """Upload a CV and measure performance."""
        start_time = time.time()
        
        try:
            # Use sample CV text if none provided
            text = cv_text or SAMPLE_CV_TEXT
            
            data = {
                'cv_text': text
            }
            
            async with self.session.post(f"{API_BASE}/cv/upload-cv", json=data) as response:
                end_time = time.time()
                duration = end_time - start_time
                
                result = {
                    "cv_id": cv_id,
                    "status_code": response.status,
                    "duration": duration,
                    "success": response.status == 200
                }
                
                if response.status == 200:
                    response_data = await response.json()
                    result["response_data"] = response_data
                
                self.results["uploads"].append(result)
                return result
                
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            result = {
                "cv_id": cv_id,
                "status_code": 0,
                "duration": duration,
                "success": False,
                "error": str(e)
            }
            self.results["uploads"].append(result)
            return result

    async def upload_jd(self, jd_id: str, jd_text: str = None) -> dict:
        """Upload a JD and measure performance."""
        start_time = time.time()
        
        try:
            # Use sample JD text if none provided
            text = jd_text or SAMPLE_JD_TEXT
            
            data = {
                'jd_text': text
            }
            
            async with self.session.post(f"{API_BASE}/jd/upload-jd", json=data) as response:
                end_time = time.time()
                duration = end_time - start_time
                
                result = {
                    "jd_id": jd_id,
                    "status_code": response.status,
                    "duration": duration,
                    "success": response.status == 200
                }
                
                if response.status == 200:
                    response_data = await response.json()
                    result["response_data"] = response_data
                
                return result
                
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            result = {
                "jd_id": jd_id,
                "status_code": 0,
                "duration": duration,
                "success": False,
                "error": str(e)
            }
            return result

    async def test_matching(self, jd_id: str, cv_ids: list) -> dict:
        """Test matching performance."""
        start_time = time.time()
        
        try:
            data = {
                "jd_id": jd_id,
                "cv_ids": cv_ids,
                "top_k": min(len(cv_ids), 50)  # Limit to 50 matches
            }
            
            async with self.session.post(f"{API_BASE}/match", json=data) as response:
                end_time = time.time()
                duration = end_time - start_time
                
                result = {
                    "jd_id": jd_id,
                    "cv_count": len(cv_ids),
                    "status_code": response.status,
                    "duration": duration,
                    "success": response.status == 200
                }
                
                if response.status == 200:
                    response_data = await response.json()
                    result["matches_found"] = len(response_data.get("matches", []))
                    result["response_data"] = response_data
                
                self.results["matches"].append(result)
                return result
                
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            result = {
                "jd_id": jd_id,
                "cv_count": len(cv_ids),
                "status_code": 0,
                "duration": duration,
                "success": False,
                "error": str(e)
            }
            self.results["matches"].append(result)
            return result

    def get_system_metrics(self) -> dict:
        """Get current system metrics."""
        return {
            "timestamp": time.time(),
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total": psutil.virtual_memory().total / (1024**3),
                "used": psutil.virtual_memory().used / (1024**3),
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total / (1024**3),
                "used": psutil.disk_usage('/').used / (1024**3),
                "percent": psutil.disk_usage('/').percent
            }
        }

    async def test_concurrent_uploads(self, num_uploads: int = 50):
        """Test concurrent CV uploads."""
        print(f"🚀 Testing {num_uploads} concurrent CV uploads...")
        
        # Record system metrics before
        self.results["system_metrics"].append({
            "phase": "before_uploads",
            "metrics": self.get_system_metrics()
        })
        
        # Create upload tasks
        tasks = []
        for i in range(num_uploads):
            cv_id = f"test_cv_{i}_{int(time.time())}"
            # Add some variation to CV text
            cv_text = SAMPLE_CV_TEXT.replace("John Doe", f"Test User {i}")
            tasks.append(self.upload_cv(cv_id, cv_text))
        
        # Execute uploads concurrently
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # Record system metrics after
        self.results["system_metrics"].append({
            "phase": "after_uploads",
            "metrics": self.get_system_metrics()
        })
        
        # Analyze results
        successful = sum(1 for r in results if isinstance(r, dict) and r.get("success", False))
        failed = len(results) - successful
        total_duration = end_time - start_time
        
        print(f"   ✅ Successful: {successful}")
        print(f"   ❌ Failed: {failed}")
        print(f"   ⏱️  Total duration: {total_duration:.2f}s")
        print(f"   📊 Average per upload: {total_duration/num_uploads:.2f}s")
        
        return {
            "total": num_uploads,
            "successful": successful,
            "failed": failed,
            "total_duration": total_duration,
            "avg_duration": total_duration/num_uploads
        }

    async def test_heavy_matching(self, num_cvs: int = 300):
        """Test heavy matching with many CVs."""
        print(f"🎯 Testing matching with {num_cvs} CVs...")
        
        # First, get existing CVs or create test data
        try:
            async with self.session.get(f"{API_BASE}/cv/cvs") as response:
                if response.status == 200:
                    data = await response.json()
                    existing_cvs = data.get("cvs", [])
                    cv_ids = [cv["id"] for cv in existing_cvs[:num_cvs]]
                else:
                    print("   ⚠️  Could not fetch existing CVs, creating test data...")
                    cv_ids = []
        except Exception as e:
            print(f"   ⚠️  Error fetching CVs: {e}")
            cv_ids = []
        
        if len(cv_ids) < 10:
            print("   ⚠️  Not enough CVs for testing, creating test data...")
            # Create some test CVs
            for i in range(min(10, num_cvs)):
                cv_id = f"test_cv_matching_{i}_{int(time.time())}"
                await self.upload_cv(cv_id)
                cv_ids.append(cv_id)
        
        # Create a test JD
        jd_id = f"test_jd_matching_{int(time.time())}"
        jd_result = await self.upload_jd(jd_id)
        
        if not jd_result.get("success"):
            print("   ❌ Failed to create test JD")
            return
        
        # Record system metrics before matching
        self.results["system_metrics"].append({
            "phase": "before_matching",
            "metrics": self.get_system_metrics()
        })
        
        # Test matching
        start_time = time.time()
        match_result = await self.test_matching(jd_id, cv_ids[:num_cvs])
        end_time = time.time()
        
        # Record system metrics after matching
        self.results["system_metrics"].append({
            "phase": "after_matching",
            "metrics": self.get_system_metrics()
        })
        
        print(f"   ✅ Matching completed: {match_result.get('success', False)}")
        print(f"   ⏱️  Duration: {match_result.get('duration', 0):.2f}s")
        print(f"   📊 CVs processed: {match_result.get('cv_count', 0)}")
        print(f"   🎯 Matches found: {match_result.get('matches_found', 0)}")
        
        return match_result

    async def run_performance_test(self):
        """Run comprehensive performance test."""
        print("🚀 Starting Performance Test Suite")
        print("=" * 60)
        
        await self.create_session()
        
        try:
            # Test 1: Concurrent uploads
            upload_results = await self.test_concurrent_uploads(50)
            
            # Wait a bit for system to stabilize
            await asyncio.sleep(5)
            
            # Test 2: Heavy matching
            match_results = await self.test_heavy_matching(300)
            
            # Test 3: System stability check
            print("\n🔍 System Stability Check...")
            for i in range(5):
                metrics = self.get_system_metrics()
                print(f"   Check {i+1}: CPU {metrics['cpu_percent']:.1f}%, Memory {metrics['memory']['percent']:.1f}%")
                await asyncio.sleep(2)
            
            # Final system metrics
            self.results["system_metrics"].append({
                "phase": "final",
                "metrics": self.get_system_metrics()
            })
            
        finally:
            await self.close_session()
        
        # Generate report
        self.generate_report()

    def generate_report(self):
        """Generate performance test report."""
        print("\n" + "=" * 60)
        print("📊 PERFORMANCE TEST REPORT")
        print("=" * 60)
        
        # Upload statistics
        uploads = self.results["uploads"]
        if uploads:
            successful_uploads = [u for u in uploads if u.get("success")]
            failed_uploads = [u for u in uploads if not u.get("success")]
            
            print(f"\n📤 UPLOAD PERFORMANCE:")
            print(f"   Total uploads: {len(uploads)}")
            print(f"   Successful: {len(successful_uploads)}")
            print(f"   Failed: {len(failed_uploads)}")
            
            if successful_uploads:
                durations = [u["duration"] for u in successful_uploads]
                print(f"   Average duration: {sum(durations)/len(durations):.2f}s")
                print(f"   Min duration: {min(durations):.2f}s")
                print(f"   Max duration: {max(durations):.2f}s")
        
        # Matching statistics
        matches = self.results["matches"]
        if matches:
            successful_matches = [m for m in matches if m.get("success")]
            failed_matches = [m for m in matches if not m.get("success")]
            
            print(f"\n🎯 MATCHING PERFORMANCE:")
            print(f"   Total matches: {len(matches)}")
            print(f"   Successful: {len(successful_matches)}")
            print(f"   Failed: {len(failed_matches)}")
            
            if successful_matches:
                durations = [m["duration"] for m in successful_matches]
                cv_counts = [m["cv_count"] for m in successful_matches]
                print(f"   Average duration: {sum(durations)/len(durations):.2f}s")
                print(f"   Average CVs processed: {sum(cv_counts)/len(cv_counts):.1f}")
        
        # System metrics
        print(f"\n💻 SYSTEM METRICS:")
        for metric in self.results["system_metrics"]:
            phase = metric["phase"]
            m = metric["metrics"]
            print(f"   {phase}: CPU {m['cpu_percent']:.1f}%, Memory {m['memory']['percent']:.1f}%")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if uploads and len([u for u in uploads if u.get("success")]) / len(uploads) > 0.9:
            print("   ✅ Upload performance: EXCELLENT")
        elif uploads and len([u for u in uploads if u.get("success")]) / len(uploads) > 0.8:
            print("   ⚠️  Upload performance: GOOD")
        else:
            print("   ❌ Upload performance: NEEDS IMPROVEMENT")
        
        if matches and len([m for m in matches if m.get("success")]) / len(matches) > 0.9:
            print("   ✅ Matching performance: EXCELLENT")
        elif matches and len([m for m in matches if m.get("success")]) / len(matches) > 0.8:
            print("   ⚠️  Matching performance: GOOD")
        else:
            print("   ❌ Matching performance: NEEDS IMPROVEMENT")

async def main():
    """Main function."""
    tester = PerformanceTester()
    await tester.run_performance_test()

if __name__ == "__main__":
    asyncio.run(main())
